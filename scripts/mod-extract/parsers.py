"""Conservative extraction of ILSpy C# declarations, without executing mod code.

``parse_assembly(cfg, source_root, images)`` returns all five entity categories
and structured diagnostics. source_root is the decompiled assembly, *not* the
PCK stage in cfg.source. Missing localization never suppresses an entity.

This is a bounded C# evaluator, not a compiler: unknown expressions are omitted
and diagnosed, never converted to zero or a guessed rarity. Numeric values are
raw BaseValue values (including percentMore ratios). variableMetadata retains
the factory/type, expression and computed/runtime nature for text consumers.
"""

from __future__ import annotations

import ast
import hashlib
import json
import operator
import re
from dataclasses import dataclass, field
from pathlib import Path

from config import ModConfig, asset_key, entry_id

CATEGORIES = ('cards', 'relics', 'potions', 'powers', 'characters')
SINGULAR = dict(zip(CATEGORIES, ('card', 'relic', 'potion', 'power', 'character')))
# Verified against the game's Core/Entities enum declarations. An unknown numeric
# value (especially a dynamically registered mod enum) is deliberately an error.
ENUMS = {
    'CardType': 'None Attack Skill Power Status Curse Quest'.split(),
    'CardRarity': 'None Basic Common Uncommon Rare Ancient Event Token Status Curse Quest'.split(),
    'TargetType': 'None Self AnyEnemy AllEnemies RandomEnemy AnyPlayer AnyAlly AllAllies TargetedNoCreature Osty'.split(),
    'CardKeyword': 'None Exhaust Ethereal Innate Unplayable Retain Sly Eternal'.split(),
    'RelicRarity': 'None Starter Common Uncommon Rare Shop Event Ancient'.split(),
    'PotionRarity': 'None Common Uncommon Rare Event Token'.split(),
    'PowerType': 'None Buff Debuff'.split(),
    'PowerStackType': 'None Counter Single'.split(),
    'CharacterGender': 'Neutral Feminine Masculine Tree'.split(),
    'PotionUsage': 'None CombatOnly AnyTime Automatic'.split(),
}
# DynamicVarSet's typed accessors use the power class name as dictionary key.
DYNAMIC_ALIASES = {name: name + 'Power' for name in
                   ('Dexterity', 'Doom', 'Poison', 'Strength', 'Vulnerable', 'Weak')}
VAR_NAMES = set('Block Damage Heal Energy Stars Gold Cards Repeat HpLoss HitCount MaxHp '
                'Forge Summon OstyDamage ExtraDamage CalculationBase CalculationExtra '
                'CalculatedDamage CalculatedBlock CalculatedHitCount'.split())
ROOTS = {
    'CardModel': 'cards', 'ModCardTemplate': 'cards',
    'RelicModel': 'relics', 'ModRelicTemplate': 'relics',
    'PotionModel': 'potions', 'ModPotionTemplate': 'potions',
    'PowerModel': 'powers', 'ModPowerTemplate': 'powers',
    'ModTemporaryAppliedPowerTemplate': 'powers', 'ModTemporaryPowerTemplate': 'powers',
    'CharacterModel': 'characters', 'ModCharacterTemplate': 'characters',
}
STRING = r'@"(?:""|[^"])*"|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\''
LEXICAL = re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|' + STRING)
NUM = r'-?\d+(?:\.\d+)?[mMdDfFlL]?'


def _mask(text: str, *, strings: bool = True) -> str:
    def replace(m):
        if not strings and not m.group().startswith(('/',)):
            return m.group()
        return re.sub(r'[^\n]', ' ', m.group())
    return LEXICAL.sub(replace, text)


def _matching(text: str, start: int) -> int:
    """Find a matching delimiter, ignoring comments and string literals."""
    masked = _mask(text)
    opening = masked[start]
    closing = {'(': ')', '[': ']', '{': '}', '<': '>'}[opening]
    depth = 1
    for i in range(start + 1, len(masked)):
        if masked[i] == opening:
            depth += 1
        elif masked[i] == closing:
            depth -= 1
            if depth == 0:
                return i
    raise ValueError(f'unclosed {opening} at offset {start}')


def _split_args(text: str) -> list[str]:
    masked = _mask(text)
    stack: list[str] = []
    parts = []
    start = 0
    for i, ch in enumerate(masked):
        if ch in '([{':
            stack.append({'(': ')', '[': ']', '{': '}'}[ch])
        elif ch == '<' and i and re.match(r'[\w>]', masked[i - 1]) and '>' in masked[i:]:
            stack.append('>')
        elif stack and ch == stack[-1]:
            stack.pop()
        elif ch == ',' and not stack:
            parts.append(text[start:i].strip())
            start = i + 1
    if text[start:].strip():
        parts.append(text[start:].strip())
    return parts


def _substitute(expression: str, bindings: dict[str, str]) -> str:
    masked = _mask(expression)
    return re.sub(r'\b\w+\b', lambda m: bindings.get(m.group(), m.group())
                  if masked[m.start():m.end()].strip() else m.group(), expression)


def _simple_name(name: str) -> str:
    return name.replace('global::', '').split('<', 1)[0].strip().split('.')[-1]


@dataclass
class Member:
    name: str
    header: str
    body: str
    kind: str


def _members(body: str, class_name: str) -> list[Member]:
    """Read only direct class members; nested lambda/helper declarations stay scoped."""
    result = []
    masked = _mask(body)
    cursor = 0
    while cursor < len(body):
        while cursor < len(body) and masked[cursor].isspace():
            cursor += 1
        start = cursor
        while cursor < len(body) and masked[cursor] == '[':
            cursor = _matching(body, cursor) + 1
            while cursor < len(body) and masked[cursor].isspace():
                cursor += 1
        declaration = cursor
        paren = square = 0
        expression = False
        while cursor < len(body):
            ch = masked[cursor]
            if ch == '(':
                paren += 1
            elif ch == ')':
                paren -= 1
            elif ch == '[':
                square += 1
            elif ch == ']':
                square -= 1
            elif not paren and not square and ch == '=':
                expression = True
            elif ch == '{':
                end = _matching(body, cursor)
                if not paren and not square and not expression:
                    header = body[declaration:cursor].strip()
                    inner = body[cursor + 1:end]
                    cursor = end + 1
                    break
                cursor = end
            elif ch == ';' and not paren and not square:
                header = body[declaration:cursor].strip()
                inner = ''
                cursor += 1
                break
            cursor += 1
        else:
            break
        if not header:
            continue
        if re.search(r'\b(class|struct|enum|interface)\b', _mask(header)):
            continue
        signature = header.split('=>', 1)[0].split('=', 1)[0].strip()
        method = re.search(r'(\w+)\s*\(', signature)
        if method:
            name = method.group(1)
            kind = 'constructor' if name == class_name else 'method'
        else:
            names = re.findall(r'\b\w+\b', signature)
            if not names:
                continue
            name = names[-1]
            kind = 'property' if inner or '=>' in header or '{' in body[declaration:cursor] else 'field'
        result.append(Member(name, header, inner, kind))
        if cursor <= start:
            raise ValueError('member scanner made no progress')
    return result


@dataclass
class ClassInfo:
    name: str
    namespace: str
    base: str
    header: str
    body: str
    attributes: str
    path: Path
    line: int
    abstract: bool
    members: list[Member] = field(default_factory=list)

    @property
    def qualified(self) -> str:
        return f'{self.namespace}.{self.name}' if self.namespace else self.name


class Unknown(ValueError):
    pass


class UpgradeUnknown(Unknown):
    """An unverified upgrade invalidates the entire level, not just one field."""

    def __init__(self, code, message, expression):
        super().__init__(message)
        self.code, self.expression = code, expression


def _scan(source_root: Path) -> list[ClassInfo]:
    classes = []
    for path in sorted(source_root.rglob('*.cs')):
        # Build outputs and linked copies are not part of a source assembly.
        if any(part in ('obj', 'bin', '.git') for part in path.relative_to(source_root).parts):
            continue
        text = _mask(path.read_text(encoding='utf-8-sig'), strings=False)
        masked = _mask(text)
        namespace = re.search(r'\bnamespace\s+([\w.]+)', masked)
        ns = namespace.group(1) if namespace else ''
        consumed = -1
        for match in re.finditer(r'\bclass\s+(\w+)\s*(?:<[^{};]+?>)?', masked):
            if match.start() < consumed:
                continue
            brace = masked.find('{', match.end())
            if brace < 0:
                continue
            end = _matching(text, brace)
            consumed = end
            header = text[match.start():brace]
            # A colon inside a primary parameter default is not a base separator.
            tail = header[match.end() - match.start():].strip()
            if tail.startswith('('):
                tail = tail[_matching(tail, 0) + 1:].strip()
            base = ''
            if tail.startswith(':'):
                base = re.split(r'\s+where\b', tail[1:].strip(), maxsplit=1)[0]
                stop = base.find('(')
                if stop >= 0:
                    base = base[:stop]
                base = _split_args(base)[0]
            line_start = text.rfind('\n', 0, match.start()) + 1
            before = text[:line_start].rstrip()
            attrs = ''
            while before.endswith(']'):
                attr_start = before.rfind('[')
                if attr_start < 0:
                    break
                attrs = before[attr_start:] + '\n' + attrs
                before = before[:attr_start].rstrip()
            line_prefix = text[line_start:match.start()]
            attrs += line_prefix[:line_prefix.rfind(']') + 1] if ']' in line_prefix else ''
            info = ClassInfo(match.group(1), ns, base, header, text[brace + 1:end],
                             attrs, path, text.count('\n', 0, match.start()) + 1,
                             bool(re.search(r'\babstract\b', line_prefix)))
            info.members = _members(info.body, info.name)
            classes.append(info)
    return classes


def _member_expression(member: Member) -> str:
    if '=>' in member.header:
        return member.header.split('=>', 1)[1].strip()
    if member.kind == 'field':
        if '=' in member.header:
            return member.header.split('=', 1)[1].strip()
        if re.search(r'\bstatic\b', member.header):
            raise Unknown(f'static field {member.name} requires initialization evidence')
        # CLR default values of explicitly declared primitive fields are known,
        # unlike arbitrary missing variables. Do not infer a type from the name.
        if re.search(r'\b(bool)\s+' + re.escape(member.name) + r'$', member.header):
            return 'false'
        if re.search(r'\b(int|decimal|float|double|long|short|byte)\s+' + re.escape(member.name) + r'$', member.header):
            return '0'
    getter = re.search(r'\bget\s*=>\s*(.*?);', member.body, re.S)
    if getter:
        return getter.group(1).strip()
    returns = re.findall(r'\breturn\s+([^;]+);', member.body)
    if len(returns) == 1 and not re.search(r'\b(if|switch|for|while|throw)\b', _mask(member.body)):
        return returns[0].strip()
    raise Unknown(f'nonconstant {member.kind} {member.name}')


class AssemblyParser:
    def __init__(self, cfg: ModConfig, root: Path, images: dict):
        self.cfg, self.root, self.images = cfg, root, images
        self.classes = _scan(root)
        self.index = {c.qualified: c for c in self.classes}
        self.short: dict[str, list[ClassInfo]] = {}
        for c in self.classes:
            self.short.setdefault(c.name, []).append(c)
        self.diagnostics: list[dict] = []
        self._diagnostic_keys: set[tuple] = set()

    def diagnostic(self, info: ClassInfo, code: str, message: str, *, severity='warning',
                   field=None, expression=None):
        key = (info.qualified, code, field, expression, message)
        if key in self._diagnostic_keys:
            return
        self._diagnostic_keys.add(key)
        item = dict(severity=severity, code=code, entity=info.name, message=message,
                    source=dict(path=info.path.relative_to(self.root).as_posix(), line=info.line))
        if field is not None:
            item['field'] = field
        if expression is not None:
            item['expression'] = expression
        self.diagnostics.append(item)

    def lookup(self, name: str, owner: ClassInfo) -> ClassInfo | None:
        bare = name.replace('global::', '').split('<', 1)[0].strip()
        for full in (bare, f'{owner.namespace}.{bare}'):
            if full in self.index:
                return self.index[full]
        candidates = self.short.get(_simple_name(bare), [])
        if len(candidates) > 1:
            raise Unknown(f'ambiguous type {name}')
        return candidates[0] if candidates else None

    def chain(self, info: ClassInfo) -> list[ClassInfo]:
        chain = []
        while info:
            if info in chain:
                raise Unknown('inheritance cycle')
            chain.append(info)
            info = self.lookup(info.base, info) if info.base else None
        return chain

    def category(self, info: ClassInfo) -> str | None:
        for c in self.chain(info):
            if _simple_name(c.base) in ROOTS:
                return ROOTS[_simple_name(c.base)]
        return None

    def member(self, chain: list[ClassInfo], name: str) -> tuple[ClassInfo, Member] | None:
        for c in chain:
            for member in c.members:
                if member.name == name and member.kind != 'constructor':
                    return c, member
        return None

    def evaluate(self, expression: str, chain: list[ClassInfo], seen=()):
        value = expression.strip()
        value = re.sub(r'^\w+\s*:\s*(?!:)', '', value)  # named argument
        # ILSpy emits casts to primitive values, enums and object wrappers.
        value = re.sub(r'\((?:decimal|int|float|double|long|object|bool|string|'
                       + '|'.join(ENUMS) + r')\??\)\s*', '', value)
        if value.startswith('(') and _matching(value, 0) == len(value) - 1:
            return self.evaluate(value[1:-1], chain, seen)
        if value in ('true', 'false'):
            return value == 'true'
        if re.fullmatch(NUM, value):
            n = value.rstrip('mMdDfFlL')
            return float(n) if '.' in n else int(n)
        if re.fullmatch(r'"(?:\\.|[^"\\])*"', value):
            try:
                return json.loads(value)
            except ValueError as exc:
                raise Unknown(f'unsupported C# string {value}') from exc
        nameof = re.fullmatch(r'nameof\((?:[\w.]+\.)?(\w+)\)', value)
        if nameof:
            return nameof.group(1)
        identifier = re.fullmatch(r'(?:this\.)?(\w+)', value)
        qualified = re.fullmatch(r'([\w.]+)\.(\w+)', value)
        target_chain = chain
        name = identifier.group(1) if identifier else None
        if qualified and not identifier:
            owner_name, name = qualified.groups()
            if owner_name in ENUMS and name in ENUMS[owner_name]:
                return name
            target = self.lookup(owner_name, chain[0])
            if target:
                target_chain = self.chain(target)
            else:
                raise Unknown(f'unresolved reference {value}')
        if name:
            identity = (target_chain[0].qualified, name)
            if identity in seen:
                raise Unknown(f'cyclic expression {value}')
            member = self.member(target_chain, name)
            if member:
                if member[1].kind == 'field' and any(
                    re.search(r'\b' + re.escape(name) + r'\s*=(?!=)', ctor.body)
                    for c in target_chain for ctor in c.members if ctor.kind == 'constructor'
                ):
                    raise Unknown(f'field {name} is assigned by a constructor; initialization order requires review')
                return self.evaluate(_member_expression(member[1]), target_chain, (*seen, identity))
        # Only arithmetic with proven scalar operands; never eval() mod code.
        normalized = re.sub(r'(?<=\d)[mMdDfF]\b', '', value)
        try:
            node = ast.parse(normalized, mode='eval').body
            return self._arithmetic(node, chain, seen)
        except (SyntaxError, ValueError, TypeError, ZeroDivisionError, OverflowError) as exc:
            raise Unknown(f'unresolved expression {expression}') from exc

    def _arithmetic(self, node, chain, seen):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float, str, bool):
            return node.value
        if isinstance(node, ast.Name):
            member = self.member(chain, node.id)
            if member:
                return self.evaluate(node.id, chain, seen)
        # Division/modulo require full C# operand typing (integer truncation,
        # decimal promotion, negative remainder). Diagnose them rather than
        # accidentally applying Python's different numeric semantics.
        ops = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul}
        if isinstance(node, ast.BinOp) and type(node.op) in ops:
            return ops[type(node.op)](self._arithmetic(node.left, chain, seen),
                                      self._arithmetic(node.right, chain, seen))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            v = self._arithmetic(node.operand, chain, seen)
            return -v if isinstance(node.op, ast.USub) else +v
        raise Unknown('unsupported arithmetic')

    def scalar(self, info, chain, name, *, required=False):
        found = self.member(chain, name)
        if found:
            try:
                return self.evaluate(_member_expression(found[1]), chain)
            except Unknown as exc:
                self.diagnostic(info, 'unresolved_expression', str(exc), field=name,
                                expression=found[1].header + found[1].body)
        elif required:
            self.diagnostic(info, 'missing_field', f'{name} is unavailable in the assembly', field=name)
        return None

    def enum(self, info, chain, enum_name, expression, *, field):
        raw = expression.strip()
        member = re.fullmatch(r'(?:global::)?(?:[\w.]+\.)?' + enum_name + r'\.(\w+)', raw)
        if member:
            if member.group(1) in ENUMS[enum_name]:
                return member.group(1)
        cast = re.fullmatch(r'\(' + enum_name + r'\)\s*(-?\d+)', raw)
        if cast:
            n = int(cast.group(1))
            if 0 <= n < len(ENUMS[enum_name]):
                return ENUMS[enum_name][n]
        # Custom enum values are accepted only with explicit display config or
        # a matching RegisterDynamicEnumValue declaration in this assembly.
        custom = raw.split('.')[-1]
        if enum_name == 'CardRarity' and re.fullmatch(r'[\w.]+', raw):
            registered = any(re.search(r'\b' + re.escape(custom) + r'\s*=\s*'
                r'[\w.]*RegisterDynamicEnumValue<CardRarity>\([^;]*"' + re.escape(custom) + r'"', c.body)
                for c in self.classes)
            configured = self.cfg.custom_rarity(custom)
            if registered or configured:
                return configured or custom
        self.diagnostic(info, 'unknown_enum', f'Cannot resolve {enum_name}: {raw}',
                        severity='error', field=field, expression=raw)
        return None

    @staticmethod
    def constructors(info):
        constructors = []
        # Primary constructors and ordinary : base / : this constructors use
        # exactly the same argument binding rules, including optional args.
        primary = re.search(r'\bclass\s+' + re.escape(info.name) + r'(?:<[^>]+>)?\s*\(', info.header)
        if primary:
            p = primary.end() - 1
            end = _matching(info.header, p)
            tail = info.header[end + 1:]
            init = re.search(r':\s*[\w.]+(?:<[^>]+>)?\s*\(', tail)
            args = ''
            if init:
                a = init.end() - 1
                args = tail[a + 1:_matching(tail, a)]
            constructors.append((info.header[p + 1:end], 'base', args))
        for member in info.members:
            if member.kind != 'constructor':
                continue
            p = member.header.find('(')
            end = _matching(member.header, p)
            init = re.search(r':\s*(base|this)\s*\(', member.header[end + 1:])
            args, target = '', 'base'
            if init:
                tail = member.header[end + 1:]
                a = init.end() - 1
                args, target = tail[a + 1:_matching(tail, a)], init.group(1)
            constructors.append((member.header[p + 1:end], target, args))
        return constructors or [('', 'base', '')]

    def constructor_args(self, info, incoming=None, seen=()):
        incoming = incoming or []
        identity = (info.qualified, tuple(incoming))
        if identity in seen:
            raise Unknown('constructor cycle')
        candidates = []
        for parameters, target, args in self.constructors(info):
            specs = _split_args(parameters)
            bound = {}
            positional = [x for x in incoming if not re.match(r'^\w+\s*:', x)]
            named = dict(re.findall(r'^(\w+)\s*:\s*(.*)$', x, re.S)[0]
                         for x in incoming if re.match(r'^\w+\s*:', x))
            names = []
            valid = len(positional) <= len(specs)
            for i, spec in enumerate(specs):
                declaration, _, default = spec.partition('=')
                name = declaration.strip().split()[-1]
                names.append(name)
                value = positional[i] if i < len(positional) else named.get(name, default.strip())
                if not value:
                    valid = False
                # Substitution must preserve precedence across constructor
                # forwarding, e.g. Base(cost * 2) with cost=(1 + 2).
                simple = re.fullmatch(NUM + r'|[A-Za-z_][\w.]*|"(?:\\.|[^"\\])*"', value)
                bound[name] = value if simple else '(' + value + ')'
            if set(named) - set(names):
                valid = False
            if valid:
                candidates.append((target, [_substitute(x, bound) for x in _split_args(args)]))
        if len(candidates) != 1:
            raise Unknown(f'{info.name}: {len(candidates)} matching constructors for {incoming}')
        target, forwarded = candidates[0]
        if target == 'this':
            return self.constructor_args(info, forwarded, (*seen, identity))
        parent = self.lookup(info.base, info) if info.base else None
        if parent:
            return self.constructor_args(parent, forwarded, (*seen, identity))
        return forwarded

    def property_block(self, chain, name, seen=()):
        if name in seen:
            raise Unknown(f'cyclic collection {name}')
        found = self.member(chain, name)
        if not found:
            return ''
        owner, member = found
        block = member.header.split('=>', 1)[1] if '=>' in member.header else member.body
        if 'base.' + name in block:
            base = self.property_block(chain[chain.index(owner) + 1:], name, seen)
            block = block.replace('base.' + name, base)
        # Cooldown base classes compose a virtual AdditionalCanonicalVars
        # collection through Prepend; evaluation uses the concrete class.
        for ref in dict.fromkeys(re.findall(r'\b(\w*CanonicalVars)\b', _mask(block))):
            if ref != name:
                block += '\n' + self.property_block(chain, ref, (*seen, name))
        return block

    def variables(self, info, chain):
        block = self.property_block(chain, 'CanonicalVars')
        variables, metadata = {}, {}
        calls = re.compile(r'\bModCardVars\.(\w+)(?:<([\w.]+)>)?\s*\(|'
                           r'\bnew\s+(\w*Var)(?:<([\w.]+)>)?\s*\(')
        for match in calls.finditer(block):
            method, generic, constructed, generic2 = match.groups()
            factory = method or constructed
            generic = generic or generic2
            known = (factory.removesuffix('Var') in VAR_NAMES
                     or factory in ('Int', 'String', 'Bool', 'IntVar', 'StringVar', 'BoolVar', 'DynamicVar', 'Power', 'PowerVar')
                     or factory in ('Computed', 'ComputedDynamicVar', 'ComputedPowerAmountGiven')
                     or factory.removesuffix('Var').removeprefix('Computed') in VAR_NAMES | {'Power', 'PowerAmountGiven'})
            if not known:
                self.diagnostic(info, 'unsupported_variable_type', f'Unknown variable constructor/factory {factory}; its key semantics are unavailable')
                continue
            end = _matching(block, match.end() - 1)
            args = _split_args(block[match.end():end])
            if not args:
                self.diagnostic(info, 'unsupported_variable', f'{factory} has no supported arguments')
                continue
            try:
                first = self.evaluate(args[0], chain)
            except Unknown:
                first = None
            named = isinstance(first, str)
            key = first if named else (_simple_name(generic) if generic else factory.removesuffix('Var'))
            tokens = args[1:] if named else args
            if factory in ('Int', 'String', 'Bool', 'IntVar', 'StringVar', 'BoolVar', 'DynamicVar') and not named:
                self.diagnostic(info, 'unresolved_variable_name', f'{factory} requires a resolvable name', expression=args[0])
                continue
            computed = factory.startswith('Computed')
            value_expression = tokens[0] if tokens else None
            if computed:
                # Ritsu's context-factory overload is (name, factory, baseValue),
                # older Func overloads are (name, baseValue, factory). Do not
                # search inside lambda bodies for an incidental numeric literal.
                context_factory = value_expression and ('ComputedDynamicVarFactory' in value_expression
                    or 'ComputedDynamicVarContext' in value_expression)
                if context_factory:
                    # The declared context overload default is baseValue=0m;
                    # this is signature evidence, not an unknown-value fallback.
                    value_expression = tokens[1] if len(tokens) > 1 else '0m'
            if value_expression is None and factory in ('String', 'StringVar', 'Bool', 'BoolVar'):
                value_expression = '""' if factory in ('String', 'StringVar') else 'false'
            expression = block[match.start():end + 1].strip()
            meta = dict(type=(f'{factory}<{generic}>' if generic else factory),
                        factory=('ModCardVars.' + factory if method else 'new ' + factory),
                        expression=expression, computed=computed)
            if value_expression is not None:
                meta['valueExpression'] = value_expression
            if computed:
                self.diagnostic(info, 'computed_variable', f'{key} retains its declared base value; runtime calculation is not executed',
                                severity='info', field=f'variables.{key}', expression=expression)
            try:
                if value_expression is None:
                    raise Unknown('missing declared value')
                value = self.evaluate(value_expression, chain)
                if type(value) not in (str, int, float, bool):
                    raise Unknown('value is not scalar')
                variables[key] = value
                meta['valueType'] = ('decimal' if type(value) in (int, float) and
                    (re.search(r'\d[mM]\b|\(decimal\)', value_expression) or
                     method not in ('Cards', 'Energy', 'Gold', 'Repeat', 'Forge', 'Summon'))
                    else {int: 'int', float: 'double', str: 'string', bool: 'bool'}[type(value)])
            except Unknown as exc:
                meta['unresolved'] = True
                self.diagnostic(info, 'unresolved_variable', f'{key}: {exc}',
                                field=f'variables.{key}', expression=value_expression or expression)
            metadata[key] = meta
        if block.strip() and not metadata and not re.search(r'Array.Empty|\[\s*\]|yield break', block):
            self.diagnostic(info, 'unsupported_variable_collection', 'CanonicalVars could not be extracted', expression=block)
        return variables, metadata

    def keywords(self, info, chain):
        block = self.property_block(chain, 'CanonicalKeywords')
        result, custom = [], []
        for owner, name in re.findall(r'\b([\w.]*Keywords?|CardKeyword)\.(\w+)', block):
            if owner == 'CardKeyword' or owner.endswith('.CardKeyword'):
                if name in ENUMS['CardKeyword']:
                    result.append(name)
                else:
                    self.diagnostic(info, 'unknown_keyword', name, expression=owner + '.' + name)
            else:
                custom.append(owner + '.' + name)
        for cast in re.findall(r'\(CardKeyword\)\s*-?\d+', block):
            value = self.enum(info, chain, 'CardKeyword', cast, field='keywords')
            if value:
                result.append(value)
        if block.strip() and not (result or custom) and not re.search(r'Array.Empty|\[\s*\]|yield break', block):
            self.diagnostic(info, 'unsupported_keyword_collection', 'CanonicalKeywords could not be extracted', expression=block)
        if custom:
            self.diagnostic(info, 'custom_keywords', 'Custom keywords retained in keywordRefs: ' + ', '.join(custom), severity='info')
        return list(dict.fromkeys(result)), list(dict.fromkeys(custom))

    # Whole-statement recognition is intentional: searching for calls anywhere
    # in a method also executes unreachable code, lambdas and local functions.
    _upgrade_var = r'DynamicVars\s*(?:\[\s*("(?:\\.|[^"\\])*"|nameof\([^)]*\)|\w+)\s*\]|\.(\w+))'

    @staticmethod
    def _upgrade_receiver(expression):
        for pattern in (r'\(\(CardModel\)(?:\(object\))?this\)\.',
                        r'\b(?:this|base)\.(?=DynamicVars\b|EnergyCost\b|StarCost\b|CurrentUpgradeLevel\b|IsUpgraded\b|AddKeyword\b|RemoveKeyword\b|UpgradeStarCostBy\b)'):
            code = _mask(expression)
            for match in reversed(list(re.finditer(pattern, expression))):
                if code[match.start():match.start() + 1].strip():
                    expression = expression[:match.start()] + expression[match.end():]
        return expression

    def _upgrade_value(self, expression, chain, state, level):
        value = self._upgrade_receiver(expression)
        # evaluate() is also used for ILSpy enum/object wrappers. Its cast
        # stripping cannot establish narrowing/rounding semantics in mutations.
        if re.search(r'\((?:int|long|short|byte|float|double|bool)\)', _mask(value)):
            raise Unknown('upgrade expression contains an unverified numeric cast')

        def read_var(match):
            token, name, accessor = match.groups()
            key = DYNAMIC_ALIASES.get(name, name) if name else self.evaluate(token, chain)
            current = state['variables'].get(key)
            if type(current) not in (int, float):
                raise Unknown(f'base value of {key} is unresolved')
            return str(int(current) if accessor == 'IntValue' else current)

        # Substitute only code, never a variable's quoted name/string literal.
        read = re.compile(self._upgrade_var + r'\s*\.\s*(BaseValue|IntValue)\b')
        matches = list(read.finditer(value))
        for match in reversed(matches):
            if _mask(value)[match.start():match.start() + 1].strip():
                value = value[:match.start()] + read_var(match) + value[match.end():]
        value = _substitute(value, {'CurrentUpgradeLevel': str(level), 'IsUpgraded': 'true'})
        result = self.evaluate(value, chain)
        if type(result) not in (int, float):
            raise Unknown('upgrade value is not numeric')
        return result

    def _execute_upgrade(self, chain, state, level, methods, effects):
        found = self.member(chain, 'OnUpgrade')
        if not found:
            # Verified against current sts2.dll and Ritsu Runtime: CardModel's
            # OnUpgrade is empty and ModCardTemplate does not override it.
            if chain and _simple_name(chain[-1].base) in ('CardModel', 'ModCardTemplate'):
                return
            raise UpgradeUnknown('unresolved_upgrade', 'OnUpgrade belongs to an unavailable dependency', 'base.OnUpgrade()')
        owner, member = found
        active_chain = chain[chain.index(owner):]
        body = member.body
        if not body and '=>' in member.header:
            body = member.header.split('=>', 1)[1] + ';'
        code = _mask(body)
        if re.search(r'\b(if|else|switch|for|foreach|while|do|return|throw|try|catch|finally|goto|break|continue|yield|await|using|lock|fixed|checked|unchecked)\b|[{}]|=>', code):
            raise UpgradeUnknown('conditional_upgrade', 'Upgrade control flow, nested scope or reachability is not statically verified', body)
        methods.append(dict(qualifiedType=owner.qualified, member='OnUpgrade',
                            path=owner.path.relative_to(self.root).as_posix(), line=owner.line,
                            expression=body))
        # Only a flat sequence of complete, recognized statements is supported.
        # Apply to a transaction supplied by upgrade(), discarding it on error.
        if code.strip() and not code.rstrip().endswith(';'):
            raise UpgradeUnknown('unsupported_upgrade_statement', 'Upgrade statement is not terminated', body)
        boundaries = [-1] + [m.start() for m in re.finditer(';', code)] + [len(body)]
        for start, end in zip(boundaries, boundaries[1:]):
            statement = _mask(body[start + 1:end], strings=False)
            statement = self._upgrade_receiver(statement.strip())
            if not statement:
                continue
            # A typed nullable live power is a different receiver from this
            # card. Record the conditional runtime effect without subtracting
            # its operand a second time from the card's static variables.
            live = re.fullmatch(r'(\w+)\?\.' + self._upgrade_var + r'\s*\.\s*(UpgradeValueBy|UpgradeValueTo)\s*\((.*)\)', statement, re.S)
            if live:
                field_name, token, name, operation, expression = live.groups()
                field = self.member(active_chain, field_name)
                declared_type = re.search(r'\b([\w.]+)\??\s+' + re.escape(field_name) + r'\s*$', field[1].header) if field and field[1].kind == 'field' else None
                target = self.lookup(declared_type.group(1), field[0]) if declared_type else None
                if target is None or self.category(target) != 'powers':
                    raise UpgradeUnknown('unresolved_upgrade', 'Conditional receiver is not a verified power-model field', statement)
                try:
                    key = DYNAMIC_ALIASES.get(name, name) if name else self.evaluate(token, active_chain)
                    operand = self._upgrade_value(expression, active_chain, state, level)
                except Unknown as exc:
                    raise UpgradeUnknown('unresolved_upgrade', str(exc), statement) from exc
                effects.append(dict(level=level, receiver=field_name, qualifiedType=target.qualified,
                                    variable=key, operation=operation, operand=operand,
                                    condition='receiver-not-null', evaluated=False, expression=statement,
                                    source=dict(path=owner.path.relative_to(self.root).as_posix(),
                                                line=owner.line, qualifiedType=owner.qualified, member='OnUpgrade')))
                continue
            if re.search(r'[?:]', _mask(statement)):
                raise UpgradeUnknown('conditional_upgrade', 'Conditional upgrade expression is not statically verified', statement)
            if re.fullmatch(r'base\.OnUpgrade\(\s*\)', statement):
                if len(active_chain) == 1 and _simple_name(owner.base) in ('CardModel', 'ModCardTemplate'):
                    continue  # verified external no-op, at this exact call site
                self._execute_upgrade(active_chain[1:], state, level, methods, effects)
                continue
            mutation = re.fullmatch(self._upgrade_var + r'\s*\.\s*(UpgradeValueBy|UpgradeValueTo)\s*\((.*)\)', statement, re.S)
            assignment = re.fullmatch(self._upgrade_var + r'\s*\.\s*BaseValue\s*(=|\+=|-=|\*=)\s*(.+)', statement, re.S)
            if mutation or assignment:
                token, name, operation, expression = (mutation or assignment).groups()
                try:
                    key = DYNAMIC_ALIASES.get(name, name) if name else self.evaluate(token, active_chain)
                    if key not in state['variables']:
                        raise Unknown(f'base value of {key} is unresolved')
                    value = self._upgrade_value(expression, active_chain, state, level)
                    if operation in ('UpgradeValueBy', '+=', '-=', '*='):
                        current = state['variables'][key]
                        if type(current) not in (int, float):
                            raise Unknown(f'base value of {key} is not numeric')
                        value = {'UpgradeValueBy': operator.add, '+=': operator.add,
                                 '-=': operator.sub, '*=': operator.mul}[operation](current, value)
                    state['variables'][key] = value
                except Unknown as exc:
                    raise UpgradeUnknown('unresolved_upgrade', str(exc), statement) from exc
                continue
            cost = re.fullmatch(r'EnergyCost\.(UpgradeBy|UpgradeTo)\s*\((.*)\)', statement, re.S)
            star = re.fullmatch(r'UpgradeStarCostBy\s*\((.*)\)', statement, re.S)
            if cost or star:
                operation, expression = cost.groups() if cost else ('UpgradeBy', star.group(1))
                output = 'cost' if cost else 'secondEnergy'
                try:
                    value = self._upgrade_value(expression, active_chain, state, level)
                    if type(value) is not int:
                        raise Unknown('upgrade cost must have a verified integer value')
                    if cost and state.get(output) == 'X' and operation == 'UpgradeBy':
                        continue  # CardEnergyCost.UpgradeBy is a no-op for X
                    if operation == 'UpgradeBy':
                        if type(state.get(output)) is not int:
                            raise Unknown('base cost is unresolved or not an integer')
                        value += state[output]
                        if cost:
                            value = max(value, 0)  # verified CardEnergyCost clamp
                    state[output] = value
                except Unknown as exc:
                    raise UpgradeUnknown('unresolved_upgrade', str(exc), statement) from exc
                continue
            keyword = re.fullmatch(r'(AddKeyword|RemoveKeyword)\(\s*CardKeyword\.(\w+)\s*\)', statement)
            if keyword:
                operation, value = keyword.groups()
                if value not in ENUMS['CardKeyword']:
                    raise UpgradeUnknown('unresolved_upgrade', f'Unknown keyword {value}', statement)
                if operation == 'AddKeyword' and value not in state['keywords']:
                    state['keywords'].append(value)
                elif operation == 'RemoveKeyword' and value in state['keywords']:
                    state['keywords'].remove(value)
                continue
            raise UpgradeUnknown('unsupported_upgrade_statement', 'Upgrade statement requires semantic review', statement)

    @staticmethod
    def _upgrade_patch(card, state):
        patch = {key: state[key] for key in ('cost', 'secondEnergy', 'keywords')
                 if key in state and state[key] != card.get(key)}
        changed = {key: value for key, value in state['variables'].items()
                   if value != card['variables'].get(key)}
        if changed:
            patch['variables'] = changed
        return patch

    def upgrade(self, info, chain, card):
        """Return first upgrade; retain independently verified cumulative levels.

        upgradeLevels entries are {level, patch, verified}. Every patch is an
        absolute overlay on the *unupgraded* card, never a delta/repeated patch.
        A failed level discards its transaction and stops all later evaluation.
        """
        maximum = card.get('maxUpgradeLevel')
        metadata = dict(status='complete', scope='static-card-fields', patchSemantics='absolute-from-base',
                        verifiedThrough=0, methods=[], runtimeEffects=[])
        card['upgradeLevels'], card['upgradeMetadata'] = [], metadata
        if maximum is None:
            metadata['status'] = 'unresolved'
            return {}
        if type(maximum) is not int or maximum < 0 or maximum > 100:
            self.diagnostic(info, 'unresolved_upgrade_limit', 'MaxUpgradeLevel must be an integer in the supported range 0..100',
                            severity='error', field='maxUpgradeLevel', expression=str(maximum))
            metadata['status'] = 'unresolved'
            return {}
        state = {key: card[key] for key in ('cost', 'secondEnergy') if key in card}
        state.update(variables=dict(card['variables']), keywords=list(card['keywords']))
        for level in range(1, maximum + 1):
            transaction = {**state, 'variables': dict(state['variables']), 'keywords': list(state['keywords'])}
            methods, effects = [], []
            try:
                self._execute_upgrade(chain, transaction, level, methods, effects)
            except UpgradeUnknown as exc:
                metadata.update(status='partial' if level > 1 else 'unresolved', failedLevel=level)
                self.diagnostic(info, exc.code, f'Upgrade level {level}: {exc}', severity='error',
                                field=f'upgradeLevels.{level}', expression=exc.expression)
                break
            state = transaction
            card['upgradeLevels'].append(dict(level=level, patch=self._upgrade_patch(card, state), verified=True))
            metadata['verifiedThrough'] = level
            metadata['runtimeEffects'].extend(effects)
            for effect in effects:
                self.diagnostic(info, 'runtime_upgrade_effect', 'Conditional live power mutation retained separately from static card upgrades',
                                severity='info', field='upgradeMetadata.runtimeEffects', expression=effect['expression'])
            if level == 1:
                metadata['methods'] = methods
        return card['upgradeLevels'][0]['patch'] if card['upgradeLevels'] else {}

    def pool(self, chain, kind):
        singular = SINGULAR[kind].capitalize()
        for c in chain:
            found = self.member([c], 'Pool')
            if found:
                match = re.search(r'ModelDb\.\w+Pool<([\w.]+)>', found[1].header + found[1].body)
                if match:
                    return _simple_name(match.group(1))
            match = re.search(r'\bRegister' + singular + r'\(\s*typeof\(([\w.]+)\)', c.attributes)
            if match and (c == chain[0] or re.search(r'\bInherit\s*=\s*true', c.attributes)):
                return _simple_name(match.group(1))
        return None

    def references(self, chain):
        refs = []
        patterns = [
            (r'ModelDb\.(Card|Relic|Potion|Power|Character)<([\w.]+)>', None),
            (r'(?:PowerCmd\.(?:Apply|Remove)|HoverTipFactory\.FromPower|HasPower|GetPower|ModCardVars\.(?:Power|ComputedPower\w*)|new\s+PowerVar)<([\w.]+)>', 'power'),
            (r'(?:FromCard|CreateCard|GetCard)<([\w.]+)>', 'card'),
        ]
        for c in chain:
            text = c.header + c.body
            code = _mask(text)
            member_starts = []
            cursor = 0
            for member in c.members:
                position = c.body.find(member.header, cursor)
                if position >= 0:
                    cursor = position + len(member.header)
                    member_starts.append((len(c.header) + position, member.name))
            for pattern, fixed_kind in patterns:
                for m in re.finditer(pattern, code):
                    kind, target = (fixed_kind, m.group(1)) if fixed_kind else (m.group(1).lower(), m.group(2))
                    if _simple_name(target) in ('T', 'TCard', 'TPower'):
                        continue
                    ref = next((ref for ref in refs if ref['kind'] == kind and ref['type'] == target), None)
                    if ref is None:
                        # kind remains the target category for importer
                        # compatibility. relationKind is deliberately weaker:
                        # this is syntax evidence, not an applies/creates edge.
                        ref = dict(kind=kind, id=_simple_name(target), type=target,
                                   relationKind='declaration-reference', sources=[])
                        refs.append(ref)
                    member_name = next((name for position, name in reversed(member_starts) if position <= m.start()), None)
                    source = dict(path=c.path.relative_to(self.root).as_posix(),
                                  line=c.line + text[:m.start()].count('\n'),
                                  qualifiedType=c.qualified, member=member_name,
                                  inherited=c != chain[0], expression=text[m.start():m.end()])
                    if source not in ref['sources']:
                        ref['sources'].append(source)
        return refs

    def assets(self, info, chain):
        found = self.member(chain, 'AssetProfile')
        if not found:
            return []
        text = found[1].header + found[1].body
        # Resolve the common GetType().Name concatenation, keeping conditionally
        # selected resource paths as candidates rather than claiming they exist.
        text = re.sub(r'\(\(object\)this\)\.GetType\(\)\.Name|GetType\(\)\.Name', json.dumps(info.name), text)
        # ILSpy often stores GetType().Name in a local before concatenating it.
        locals_ = {}
        for name, expression in re.findall(r'\bstring\s+(\w+)\s*=\s*([^;]+);', text):
            expression = _substitute(expression, locals_)
            while re.search(r'"[^"\n]*"\s*\+\s*"[^"\n]*"', expression):
                expression = re.sub(r'"([^"\n]*)"\s*\+\s*"([^"\n]*)"', lambda m: json.dumps(m.group(1) + m.group(2)), expression)
            if re.fullmatch(r'"[^"\n]*"', expression):
                locals_[name] = expression
        text = _substitute(text, locals_)
        while re.search(r'"[^"\n]*"\s*\+\s*"[^"\n]*"', text):
            text = re.sub(r'"([^"\n]*)"\s*\+\s*"([^"\n]*)"', lambda m: json.dumps(m.group(1) + m.group(2)), text)
        return list(dict.fromkeys(x for x in re.findall(r'"(res://[^"\n]+)"', text) if not x.endswith('/')))

    def card(self, info, chain):
        args = self.constructor_args(info)
        if len(args) < 4:
            self.diagnostic(info, 'unresolved_constructor', f'Expected CardModel arguments, received {args}', severity='error')
            return None
        try:
            cost = self.evaluate(args[0], chain)
            if type(cost) not in (int, float):
                raise Unknown('cost is not numeric')
        except Unknown as exc:
            cost = None
            self.diagnostic(info, 'unresolved_cost', str(exc), severity='error', field='cost', expression=args[0])
        card_type = self.enum(info, chain, 'CardType', args[1], field='type')
        rarity = self.enum(info, chain, 'CardRarity', args[2], field='rarity')
        target = self.enum(info, chain, 'TargetType', args[3], field='target')
        if not card_type or not rarity:
            return None
        keywords, keyword_refs = self.keywords(info, chain)
        variables, metadata = self.variables(info, chain)
        pool_ref = self.pool(chain, 'cards')
        # Preserve existing display pool IDs while retaining the actual C# pool
        # separately for the importer's cardPool presentation mapping.
        pool = self.cfg.card_pool
        pool_info = self.lookup(pool_ref, info) if pool_ref else None
        if pool_info:
            pool = self.scalar(info, self.chain(pool_info), 'EnergyColorName') or pool
        elif pool_ref and pool_ref.endswith('CardPool'):
            pool = pool_ref.removesuffix('CardPool').lower()
        card = dict(id=info.name, pool=pool, type=card_type.lower(), rarity=rarity if rarity not in ENUMS['CardRarity'] else rarity.lower(),
                    cost=cost, variables=variables, keywords=keywords,
                    fullArt=rarity == 'Ancient' or self.cfg.card_rarities.get(rarity, {}).get('base') == 'ancient')
        if target:
            card['target'] = target
        if metadata:
            card['variableMetadata'] = metadata
        if keyword_refs:
            card['keywordRefs'] = keyword_refs
        if pool_ref:
            card['poolRef'] = pool_ref
        if self.scalar(info, chain, 'HasEnergyCostX') is True:
            card['cost'] = 'X'
        star = self.scalar(info, chain, 'CanonicalStarCost')
        if star is not None:
            card['secondEnergy'] = star
        if self.scalar(info, chain, 'HasStarCostX') is True:
            card['secondEnergy'] = 'X'
        maximum_member = self.member(chain, 'MaxUpgradeLevel')
        maximum = self.scalar(info, chain, 'MaxUpgradeLevel')
        if maximum_member is None and _simple_name(chain[-1].base) in ('CardModel', 'ModCardTemplate'):
            # Verified against the installed v0.113.0 game/Ritsu assemblies.
            maximum = 1
            card.setdefault('inheritedFields', {})['maxUpgradeLevel'] = dict(
                value=1, source='MegaCrit.Sts2.Core.Models.CardModel',
                expression='public virtual int MaxUpgradeLevel => 1')
        if maximum is not None:
            card['maxUpgradeLevel'] = maximum
        else:
            self.diagnostic(info, 'unresolved_upgrade_limit', 'MaxUpgradeLevel cannot be verified',
                            severity='error', field='maxUpgradeLevel')
        if self.member(chain, 'CanonicalEnergyCost'):
            effective = self.scalar(info, chain, 'CanonicalEnergyCost')
            if type(effective) in (int, float):
                card['cost'] = effective
            else:
                member = self.member(chain, 'CanonicalEnergyCost')[1]
                card['runtimeOverrides'] = dict(cost=member.header + member.body)
        patch = self.upgrade(info, chain, card)
        if patch:
            card['upgrade'] = patch
        return card

    def collection(self, info, chain, kind):
        rarity_member = self.member(chain, 'Rarity')
        rarity = None
        if rarity_member:
            try:
                expression = _member_expression(rarity_member[1])
                rarity = self.enum(info, chain, 'RelicRarity' if kind == 'relics' else 'PotionRarity', expression, field='rarity')
            except Unknown as exc:
                self.diagnostic(info, 'unresolved_rarity', str(exc), severity='error')
        else:
            self.diagnostic(info, 'missing_rarity', 'No rarity declaration in available inheritance chain', severity='error')
        if rarity is None:
            return None
        variables, metadata = self.variables(info, chain)
        result = dict(id=info.name, rarity=rarity.lower(), character='any', tags=[], variables=variables)
        if metadata:
            result['variableMetadata'] = metadata
        pool = self.pool(chain, kind)
        if pool:
            result['poolRef'] = pool
        for name, output in (('Usage', 'usage'), ('TargetType', 'target')):
            value = self.scalar(info, chain, name)
            if value is not None:
                result[output] = value
        return result

    def temporary_binding(self, chain):
        """Resolve generic origin/applied-power arguments through local bases."""
        bindings = {}
        for c in chain:
            base = _substitute(c.base, bindings)
            generic = re.search(r'<(.+)>', base)
            args = _split_args(generic.group(1)) if generic else []
            if _simple_name(base) == 'ModTemporaryAppliedPowerTemplate' and len(args) == 2:
                return dict(origin=_simple_name(args[0]), power=_simple_name(args[1]))
            parent = self.lookup(c.base, c) if c.base else None
            if parent:
                params = re.search(r'\bclass\s+' + re.escape(parent.name) + r'<([^>]+)>', parent.header)
                bindings = dict(zip(_split_args(params.group(1)), args)) if params else {}
        return None

    def power(self, info, chain):
        variables, metadata = self.variables(info, chain)
        result = dict(id=info.name, variables=variables)
        if metadata:
            result['variableMetadata'] = metadata
        temporary = self.temporary_binding(chain)
        if temporary:
            result['temporaryPower'] = temporary
            positive = self.scalar(info, chain, 'IsPositive')
            if positive is None and not self.member(chain, 'IsPositive'):
                positive = True  # verified template literal, no local override
            result['temporaryPower']['positive'] = positive
            # Verified by decompiling the deployed compat/0.111.0 runtime:
            # ModTemporaryPowerTemplate.BuildCanonicalVars yields this literal.
            if not self.member(chain, 'CanonicalVars'):
                variables['ExtraTurns'] = 0
                result.setdefault('variableMetadata', {})['ExtraTurns'] = dict(
                    type='IntVar', valueType='decimal', computed=False,
                    expression='new IntVar("ExtraTurns", 0m)',
                    inheritedFrom='STS2RitsuLib.Combat.Powers.ModTemporaryPowerTemplate')
            result['inheritedFields'] = dict(
                source='STS2RitsuLib.Combat.Powers.ModTemporaryPowerTemplate',
                title='OriginModel.ResolveTitleOr(InternallyAppliedPower.Title)',
                stack='Counter')
            if positive is not None:
                result['inheritedFields']['group'] = 'Buff' if positive else 'Debuff'
        for prop, enum_name, output in (('Type', 'PowerType', 'group'), ('StackType', 'PowerStackType', 'stack')):
            found = self.member(chain, prop)
            if found:
                try:
                    value = self.enum(info, chain, enum_name, _member_expression(found[1]), field=output)
                    if value is not None:
                        result[output] = value
                except Unknown as exc:
                    self.diagnostic(info, 'unresolved_power_field', str(exc), field=output)
            elif temporary and output in result['inheritedFields']:
                result[output] = result['inheritedFields'][output]
            else:
                self.diagnostic(info, 'external_base_field', f'{prop} belongs to an unavailable dependency base class', field=output)
        visible = self.scalar(info, chain, 'IsVisibleInternal')
        if visible is not None:
            result['visible'] = visible
        return result

    def localization_refs(self, info, chain, kind, row):
        """Text identity is independent of entity identity and presentation.

        A temporary power can display a card's title and a shared game power's
        description. Keep that identity rather than fabricating PCK translations.
        """
        ident = entry_id(self.cfg.dependency, SINGULAR[kind], info.name)
        refs = {field: dict(table=kind, key=f'{ident}.{field}') for field in ('title', 'description')}
        row['localizationId'] = ident
        temporary = row.get('temporaryPower')
        origin = temporary.get('origin') if temporary else None
        origin_member = self.member(chain, 'OriginModel')
        if origin_member:
            found = re.search(r'ModelDb\.Card<([\w.]+)>', origin_member[1].header + origin_member[1].body)
            if found:
                origin = _simple_name(found.group(1))
        for field, prop in (('title', 'Title'), ('description', 'Description')):
            member = self.member(chain, prop)
            block = member[1].header + member[1].body if member else ''
            if field == 'title' and origin and (temporary or 'OriginModel' in block):
                refs[field] = dict(table='cards', key=entry_id(self.cfg.dependency, 'card', origin) + '.title',
                                   entity=origin, inherited=True)
            loc = re.search(r'new\s+LocString\s*\(', block)
            if not loc:
                continue
            args = _split_args(block[loc.end():_matching(block, loc.end() - 1)])
            if len(args) < 2:
                self.diagnostic(info, 'unresolved_localization', f'{prop} has unsupported LocString arguments', field=field, expression=block)
                continue
            try:
                table = self.evaluate(args[0], chain)
                conditional = re.fullmatch(r'(.*?)\?\s*("[^"\n]+")\s*:\s*("[^"\n]+")', args[1], re.S)
                if conditional and 'IsPositive' in conditional.group(1) and temporary:
                    if temporary['positive'] is None:
                        raise Unknown('IsPositive is unresolved; cannot select description key')
                    key = self.evaluate(conditional.group(2) if temporary['positive'] else conditional.group(3), chain)
                else:
                    key = self.evaluate(args[1], chain)
                refs[field] = dict(table=table, key=key, inherited=member[0] != info)
            except Unknown as exc:
                self.diagnostic(info, 'unresolved_localization', str(exc), field=field, expression=args[1])
        row['localizationRefs'] = refs
        if not self.cfg.paths.get('localization', Path('__missing_localization__')).is_dir():
            row['localizationStatus'] = 'unverified'
            return
        missing, external = [], []
        for field, ref in refs.items():
            table = load_table(self.cfg, ref['table'], self.cfg.base_language)
            ref['available'] = ref['key'] in table
            if not ref['available']:
                # A fixed non-mod key in an explicit override refers to the
                # game's localization domain, not a missing mod translation.
                ref['external'] = ref['key'] != f'{ident}.{field}' and not ref['key'].startswith(ident.split('_')[0] + '_')
                (external if ref['external'] else missing).append(field)
        if missing:
            row['localizationStatus'] = 'hidden' if row.get('visible') is False else 'missing'
            self.diagnostic(info, 'hidden_model_localization' if row.get('visible') is False else 'missing_localization',
                            f'No base-language text for {", ".join(missing)}; model retained with explicit text refs',
                            severity='info' if row.get('visible') is False else 'warning')
        elif external:
            row['localizationStatus'] = 'external'
            self.diagnostic(info, 'external_localization', 'Text refers to game localization: ' + ', '.join(refs[f]['key'] for f in external), severity='info')
        else:
            row['localizationStatus'] = 'complete'

    def character(self, info, chain):
        result = dict(id=info.name)
        for prop, output in (('StartingHp', 'startingHp'), ('StartingGold', 'startingGold'),
                             ('MaxEnergy', 'maxEnergy'), ('BaseOrbSlotCount', 'orbSlots'), ('Gender', 'gender')):
            value = self.scalar(info, chain, prop, required=prop in ('StartingHp', 'StartingGold'))
            if value is not None:
                result[output] = value
        for c in chain:
            base = re.search(r'ModCharacterTemplate<([^>]+)>', c.base)
            if base:
                pools = _split_args(base.group(1))
                if len(pools) == 3:
                    result['cardPoolRef'], result['relicPoolRef'], result['potionPoolRef'] = map(_simple_name, pools)
                    break
        # Both standard game ModelDb starting collections and Ritsu additive
        # starter registration are supported. Preserve duplicate deck entries.
        for kind, prop, output in (('Card', 'StartingDeck', 'startingDeck'),
                                   ('Relic', 'StartingRelics', 'startingRelics'),
                                   ('Potion', 'StartingPotions', 'startingPotions')):
            block = self.property_block(chain, prop)
            entries = re.findall(r'ModelDb\.' + kind + r'<([\w.]+)>\s*\(', block)
            for candidate in self.classes:
                pattern = r'RegisterCharacterStarter' + kind + r'\(\s*typeof\(([\w.]+)\)(?:\s*,\s*(\d+))?\s*\)'
                for owner, count in re.findall(pattern, candidate.attributes):
                    if _simple_name(owner) == info.name:
                        entries.extend([candidate.name] * int(count or 1))
            result[output] = [_simple_name(x) for x in entries]
        color = self.member(chain, 'NameColor')
        if color:
            m = re.search(r'new(?:\s+Color)?\(\s*"([a-fA-F0-9]{6,8})"', color[1].header)
            if m:
                result['color'] = '#' + m.group(1)
        if 'maxEnergy' not in result:
            if not self.member(chain, 'MaxEnergy'):
                # Confirmed in the deployed sts2.dll as well as the game source:
                # CharacterModel's virtual property returns the literal 3.
                result['maxEnergy'] = 3
                result.setdefault('inheritedFields', {})['maxEnergy'] = dict(
                    value=3, source='MegaCrit.Sts2.Core.Models.CharacterModel',
                    expression='public virtual int MaxEnergy => 3')
            else:
                self.diagnostic(info, 'unresolved_character_field', 'MaxEnergy override could not be evaluated', field='maxEnergy')
        return result

    def parse(self):
        categories = {kind: [] for kind in CATEGORIES}
        ids: dict[tuple[str, str], ClassInfo] = {}
        for info in self.classes:
            if info.abstract or (self.cfg.namespace and info.namespace != self.cfg.namespace and not info.namespace.startswith(self.cfg.namespace + '.')):
                continue
            try:
                kind = self.category(info)
                if not kind:
                    continue
                chain = self.chain(info)
                if (kind, info.name) in ids:
                    self.diagnostic(info, 'duplicate_entity_id', f'ID also declared by {ids[kind, info.name].qualified}', severity='error')
                    continue
                ids[kind, info.name] = info
                if kind == 'cards':
                    row = self.card(info, chain)
                elif kind in ('relics', 'potions'):
                    row = self.collection(info, chain, kind)
                elif kind == 'powers':
                    row = self.power(info, chain)
                else:
                    row = self.character(info, chain)
                if row is None:
                    continue
                relative = info.path.relative_to(self.root).as_posix()
                row['provenance'] = dict(type='csharp', path=relative, line=info.line,
                    qualifiedType=info.qualified, baseTypes=[c.base for c in chain],
                    sha256=hashlib.sha256(info.path.read_bytes()).hexdigest())
                row['refs'] = self.references(chain)
                if row.get('temporaryPower'):
                    temporary = row['temporaryPower']
                    binding = dict(path=relative, line=info.line, qualifiedType=info.qualified,
                                   member=None, inherited=False, expression='; '.join(c.base for c in chain))
                    row['refs'] += [dict(kind='card', id=temporary['origin'], role='origin',
                                        relationKind='declaration-reference', sources=[binding]),
                                    dict(kind='power', id=temporary['power'], role='wrappedPower',
                                         relationKind='declaration-reference', sources=[binding])]
                if kind == 'characters':
                    for field, ref_kind in (('startingDeck', 'card'), ('startingRelics', 'relic'), ('startingPotions', 'potion')):
                        for ident in dict.fromkeys(row.get(field, [])):
                            sources = [dict(path=c.path.relative_to(self.root).as_posix(), line=c.line,
                                            qualifiedType=c.qualified, member=field, inherited=c != info,
                                            expression=c.attributes or c.header)
                                       for c in self.classes if c.name == ident and 'RegisterCharacterStarter' in c.attributes]
                            if not sources:
                                sources = [dict(path=relative, line=info.line, qualifiedType=info.qualified,
                                                member=field, inherited=False,
                                                expression=self.property_block(chain, 'Starting' + {'card': 'Deck', 'relic': 'Relics', 'potion': 'Potions'}[ref_kind]))]
                            row['refs'].append(dict(kind=ref_kind, id=ident, role='starter', count=row[field].count(ident),
                                                   relationKind='declaration-reference', sources=sources))
                resources = self.assets(info, chain)
                if resources:
                    row['resourceRefs'] = resources
                image = self.images.get(kind, {}).get(asset_key(info.name))
                if image:
                    row['icon' if kind == 'powers' else 'image'] = image
                else:
                    # Shared asset profiles (dishes, temporary powers) need not
                    # use the entity class name as their resource stem.
                    for resource in resources:
                        shared = self.images.get(kind, {}).get(asset_key(Path(resource).stem))
                        if shared:
                            row['icon' if kind == 'powers' else 'image'] = shared
                            break
                try:
                    self.localization_refs(info, chain, kind, row)
                except (ValueError, KeyError):
                    self.diagnostic(info, 'localization_key_rule', f'No localization key rule for {kind}')
                categories[kind].append(row)
            except (Unknown, ValueError) as exc:
                self.diagnostic(info, 'extraction_failed', str(exc), severity='error')
        for rows in categories.values():
            rows.sort(key=lambda row: row['id'])
        return categories, self.diagnostics


def parse_assembly(cfg: ModConfig, source_root: str | Path, images: dict) -> tuple[dict[str, list[dict]], list[dict]]:
    """Extract declarations from an arbitrary ILSpy/source layout, read only.

    Diagnostics have severity/code/entity/message plus optional source, field and
    expression. ``error`` means a required field/entity is unresolved; callers
    should fail validation rather than publish the remaining partial categories.
    ``warning`` means an optional/runtime field could not be evaluated. No files
    are written and cfg.source is never used as the C# input directory.
    """
    root = Path(source_root)
    if not root.is_dir():
        raise FileNotFoundError(f'C# assembly source root does not exist: {root}')
    return AssemblyParser(cfg, root, images).parse()


def load_table(cfg: ModConfig, table: str, lang: str) -> dict:
    # Stage directories can be replaced during incremental imports; never cache
    # by mod id alone (that previously leaked source-tree text into PCK imports).
    path = cfg.loc_file(lang, table)
    return json.loads(path.read_text(encoding='utf-8-sig')) if path else {}


def has_text(cfg: ModConfig, table: str, kind: str, ident: str) -> bool:
    texts = load_table(cfg, table, cfg.base_language)
    key = entry_id(cfg.dependency, kind, ident)
    return f'{key}.title' in texts and f'{key}.description' in texts


def parse_category(cfg: ModConfig, kind: str, images: dict) -> tuple[list[dict], list[str]]:
    """Compatibility entry point for the old source-tree command.

    It retains the old localized-only result and skipped-ID contract, but uses
    assembly semantics. New build imports should call parse_assembly once.
    """
    categories, diagnostics = parse_assembly(cfg, cfg.source, images)
    errors = [d for d in diagnostics if d['severity'] == 'error']
    if errors:
        raise ValueError(json.dumps(errors, ensure_ascii=False))
    rows, skipped = [], []
    table = cfg.categories[kind]['table']
    for row in categories[kind]:
        if has_text(cfg, table, SINGULAR[kind], row['id']):
            rows.append(row)
        else:
            skipped.append(row['id'])
    return rows, skipped
