"""Parse a source-tree mod's C# classes into static/mods/<id>/*.json.

Adapts spire-codex's card_parser.py regex pipeline (decompiled C# -> JSON)
and this project's parse_cards.py schema to ordinary mod source files.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from config import ModConfig, asset_key, entry_id

NUM = r'-?\d+(?:\.\d+)?m?'
CLASS_RE = re.compile(
    r'\bclass\s+(\w+)\s*(?:\([^{}]*?\))?\s*:\s*([A-Za-z_][\w.]*)\s*(\(([^)]*)\))?',
    re.S,
)
METHOD_VAR_NAMES = {
    'Block': 'Block',
    'Damage': 'Damage',
    'Heal': 'Heal',
    'Energy': 'Energy',
    'Stars': 'Stars',
    'Gold': 'Gold',
    'Cards': 'Cards',
    'Repeat': 'Repeat',
}

SINGULAR = {
    'cards': 'card',
    'powers': 'power',
    'relics': 'relic',
    'potions': 'potion',
}


def _num(raw: str):
    value = raw.rstrip('m')
    return float(value) if '.' in value else int(value)


def _balanced(text: str, start: int) -> int:
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return i
    return len(text)


def _upgrade_body(text: str) -> str:
    match = re.search(r'\bvoid\s+OnUpgrade\s*\(\s*\)', text)
    if not match:
        return ''
    brace = text.find('{', match.end())
    if brace < 0:
        return ''
    return text[brace + 1 : _balanced(text, brace)]


def _without_upgrade(text: str) -> str:
    match = re.search(r'\bvoid\s+OnUpgrade\s*\(\s*\)', text)
    if not match:
        return text
    brace = text.find('{', match.end())
    if brace < 0:
        return text
    end = _balanced(text, brace)
    return text[: brace + 1] + ' ' * (end - brace - 1) + text[end:]


VAR_CALL_RE = re.compile(r'ModCardVars\.(?:Power<(\w+)>|(\w+))\s*\(')
DYNAMIC_REF_RE = re.compile(
    r'DynamicVars\[\s*"([^"]+)"\s*\]|DynamicVars\[\s*nameof\(\s*(\w+)\s*\)\s*\]|DynamicVars\.(\w+)'
)


def _split_args(inner: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    current = ''
    for ch in inner:
        if ch in '([{':
            depth += 1
        elif ch in ')]}':
            depth -= 1
        elif ch == ',' and depth == 0:
            parts.append(current.strip())
            current = ''
            continue
        current += ch
    if current.strip():
        parts.append(current.strip())
    return parts


def _balanced_paren(text: str, start: int) -> int:
    depth = 1
    for i in range(start, len(text)):
        if text[i] == '(':
            depth += 1
        elif text[i] == ')':
            depth -= 1
            if depth == 0:
                return i
    return len(text)


def _constants(text: str) -> tuple[dict[str, str], dict[str, int]]:
    strings = dict(re.findall(r'const\s+string\s+(\w+)\s*=\s*"([^"]+)"', text))
    ints = {
        name: int(value)
        for name, value in re.findall(r'const\s+int\s+(\w+)\s*=\s*(-?\d+)', text)
    }
    return strings, ints


def _value_of(token: str | None, ints: dict[str, int]):
    if token is None:
        return 0
    token = token.strip().rstrip('m')
    if re.fullmatch(r'-?\d+(?:\.\d+)?', token):
        return _num(token)
    if token in ints:
        return ints[token]
    return 0


def _vars(block: str, strings: dict[str, str], ints: dict[str, int]) -> dict:
    out: dict = {}
    for m in VAR_CALL_RE.finditer(block):
        end = _balanced_paren(block, m.end())
        args = _split_args(block[m.end() : end])
        if not args:
            continue
        if m.group(1):
            key = m.group(1)
            value_token = args[0]
        else:
            method = m.group(2)
            first = args[0]
            if first.startswith('"'):
                key = first.strip('"')
                value_token = args[1] if len(args) > 1 else None
            elif first in strings:
                key = strings[first]
                value_token = args[1] if len(args) > 1 else None
            else:
                key = METHOD_VAR_NAMES.get(method, method)
                value_token = first
        out[key] = _value_of(value_token, ints)
    for m in re.finditer(r'new\s+\w+Var\(\s*"([^"]+)"\s*,\s*(' + NUM + r')\s*\)', block):
        out[m.group(1)] = _num(m.group(2))
    return out


def _dynamic_refs(text: str, variables: dict) -> None:
    for m in DYNAMIC_REF_RE.finditer(text):
        name = m.group(1) or m.group(2) or m.group(3)
        if name and name not in variables:
            variables[name] = 0


def _keywords(text: str, allowed: list[str]) -> list[str]:
    found: list[str] = []
    block = re.search(r'CanonicalKeywords\s*=>\s*\[(.*?)\]', text, re.S)
    if block:
        found += re.findall(r'CardKeyword\.(\w+)', block.group(1))
    found += re.findall(r'AddKeyword\s*\(\s*CardKeyword\.(\w+)', text)
    return [k for k in dict.fromkeys(found) if k in allowed]


def _upgrade_spec(body: str, cfg: ModConfig, cost, variables: dict, keywords: list[str]) -> dict:
    deltas: dict = {}
    patterns = [
        r'DynamicVars\[\s*nameof\(\s*(\w+)\s*\)\s*\]\.UpgradeValueBy\(\s*(' + NUM + r')',
        r'DynamicVars\[\s*"([^"]+)"\s*\]\.UpgradeValueBy\(\s*(' + NUM + r')',
        r'DynamicVars\.(\w+)\.UpgradeValueBy\(\s*(' + NUM + r')',
    ]
    for pattern in patterns:
        for m in re.finditer(pattern, body):
            deltas[m.group(1)] = deltas.get(m.group(1), 0) + _num(m.group(2))

    cost_delta = sum(
        _num(m.group(1))
        for m in re.finditer(r'EnergyCost\.UpgradeBy\(\s*(' + NUM + r')', body)
    )
    added = re.findall(r'AddKeyword\s*\(\s*CardKeyword\.(\w+)', body)
    removed = re.findall(r'RemoveKeyword\s*\(\s*CardKeyword\.(\w+)', body)

    spec: dict = {}
    if deltas:
        upgraded = {}
        for name, delta in deltas.items():
            base = variables.get(name, 0)
            upgraded[name] = base + delta if isinstance(base, (int, float)) else delta
        spec['variables'] = upgraded
    if cost_delta and isinstance(cost, (int, float)):
        spec['cost'] = cost + cost_delta

    allowed = cfg.enums.get('card_keywords', [])
    merged = [k for k in dict.fromkeys(keywords + added) if k not in removed and k in allowed]
    if merged != keywords:
        spec['keywords'] = merged
    return spec


@dataclass
class ClassInfo:
    name: str
    base: str | None
    abstract: bool
    cost: int | float | None = None
    card_type: str | None = None
    rarity: str | None = None
    variables: dict = field(default_factory=dict)
    keywords: list[str] = field(default_factory=list)
    upgrade: str = ''
    x_cost: bool = False
    star_cost: int | float | None = None
    enum_rarity: str | None = None


def _scan_classes(cfg: ModConfig, kind: str) -> dict[str, ClassInfo]:
    infos: dict[str, ClassInfo] = {}
    allowed_kw = cfg.enums.get('card_keywords', [])
    for path in sorted(cfg.category_dir(kind).rglob('*.cs')):
        text = path.read_text(encoding='utf-8', errors='replace')
        match = CLASS_RE.search(text)
        if not match:
            continue
        name = match.group(1)
        args = match.group(4) or ''
        clean = _without_upgrade(text)

        cost = None
        first = re.match(r'\s*(-?\d+)\s*,', args)
        if first:
            cost = int(first.group(1))
        card_type = None
        type_match = re.search(r'CardType\.(\w+)', args)
        if type_match:
            card_type = type_match.group(1).lower()
        rarity = None
        rarity_match = re.search(r'CardRarity\.(\w+)', args)
        if rarity_match:
            rarity = rarity_match.group(1).lower()
        enum_match = re.search(r'(?:FgoEnums|\w+Enums)\.(\w+)', args)
        enum_rarity = enum_match.group(1) if enum_match else None

        strings, ints = _constants(text)
        vars_block = re.search(r'CanonicalVars\s*=>\s*\[(.*?)\]\s*;', clean, re.S)
        variables = _vars(vars_block.group(1), strings, ints) if vars_block else {}
        _dynamic_refs(clean, variables)

        star = None
        star_match = re.search(r'CanonicalStarCost\s*=>\s*(' + NUM + r')', clean)
        if star_match:
            star = _num(star_match.group(1))
        if re.search(r'HasStarCostX\s*=>\s*true', clean):
            star = 'X'

        infos[name] = ClassInfo(
            name=name,
            base=match.group(2).split('.')[-1],
            abstract=bool(re.search(r'\babstract\s+class\s+' + re.escape(name) + r'\b', text)),
            cost=cost,
            card_type=card_type,
            rarity=rarity,
            variables=variables,
            keywords=_keywords(clean, allowed_kw),
            upgrade=_upgrade_body(text),
            x_cost=bool(re.search(r'HasEnergyCostX\s*=>\s*true', clean)),
            star_cost=star,
            enum_rarity=enum_rarity,
        )
    return infos


def _chain(info: ClassInfo, infos: dict[str, ClassInfo]) -> list[ClassInfo]:
    chain: list[ClassInfo] = []
    current: ClassInfo | None = info
    seen: set[str] = set()
    while current and current.name not in seen:
        seen.add(current.name)
        chain.append(current)
        current = infos.get(current.base)
    return chain


def _resolve_card(cfg: ModConfig, info: ClassInfo, infos: dict[str, ClassInfo]) -> dict | None:
    chain = _chain(info, infos)
    cost = next((c.cost for c in chain if c.cost is not None), cfg.fallback('cards', 'cost'))
    card_type = next((c.card_type for c in chain if c.card_type), cfg.fallback('cards', 'type'))
    rarity = next((c.rarity for c in chain if c.rarity), None)
    if rarity is None:
        enum = next((c.enum_rarity for c in chain if c.enum_rarity), None)
        rarity = cfg.custom_rarity(enum) or (
            cfg.alias('card_rarity', enum).lower() if enum else cfg.fallback('cards', 'rarity')
        )

    card_type = cfg.allowed('card_type', card_type) if card_type else None
    rarity = cfg.custom_rarity(rarity) or (cfg.allowed('card_rarity', rarity) if rarity else None)
    if card_type is None or rarity is None:
        return None

    variables: dict = {}
    keywords: list[str] = []
    for c in reversed(chain):
        variables.update(c.variables)
        keywords = list(dict.fromkeys(keywords + c.keywords))

    if any(c.x_cost for c in chain):
        cost = 'X'
    star = next((c.star_cost for c in chain if c.star_cost is not None), None)
    body = next((c.upgrade for c in chain if c.upgrade), '')

    card = {
        'id': info.name,
        'pool': cfg.card_pool,
        'type': card_type,
        'rarity': rarity,
        'fullArt': rarity == 'ancient' or cfg.card_rarities.get(rarity, {}).get('base') == 'ancient',
        'cost': cost,
        'variables': variables,
        'keywords': [k for k in keywords if k in cfg.enums.get('card_keywords', [])],
    }
    if star is not None:
        card['secondEnergy'] = star
    upgrade = _upgrade_spec(body, cfg, cost, variables, card['keywords'])
    if upgrade:
        card['upgrade'] = upgrade
    return card


def _resolve_collection(cfg: ModConfig, kind: str, path: Path, images: dict, enum: str) -> dict | None:
    text = path.read_text(encoding='utf-8', errors='replace')
    ident = path.stem
    match = re.search(enum + r'\.(\w+)', text)
    rarity = match.group(1).lower() if match else cfg.fallback(kind, 'rarity')
    enum_name = 'relic_rarity' if kind == 'relics' else 'potion_rarity'
    rarity = cfg.allowed(enum_name, rarity)
    if rarity is None:
        return None
    entry = {'id': ident, 'rarity': rarity, 'character': 'any', 'tags': []}
    image = images.get(asset_key(ident))
    if image:
        entry['image'] = image
    return entry


def _resolve_power(cfg: ModConfig, path: Path, images: dict) -> dict | None:
    text = path.read_text(encoding='utf-8', errors='replace')
    ident = path.stem
    entry = {'id': ident}
    group = re.search(r'PowerType\.(\w+)', text)
    if group:
        entry['group'] = group.group(1)
    stack = re.search(r'PowerStackType\.(\w+)', text)
    if stack and cfg.allowed('power_stack', stack.group(1)):
        entry['stack'] = stack.group(1)
    icon = images.get(asset_key(ident))
    if icon:
        entry['icon'] = icon
    return entry


_TABLE_CACHE: dict[tuple[str, str, str], dict] = {}


def load_table(cfg: ModConfig, table: str, lang: str) -> dict:
    key = (cfg.id, table, lang)
    if key not in _TABLE_CACHE:
        path = cfg.loc_file(lang, table)
        _TABLE_CACHE[key] = json.loads(path.read_text(encoding='utf-8')) if path else {}
    return _TABLE_CACHE[key]


def has_text(cfg: ModConfig, table: str, kind: str, ident: str) -> bool:
    texts = load_table(cfg, table, cfg.base_language)
    key = entry_id(cfg.dependency, kind, ident)
    return f'{key}.title' in texts and f'{key}.description' in texts


def parse_category(cfg: ModConfig, kind: str, images: dict) -> tuple[list[dict], list[str]]:
    spec = cfg.categories[kind]
    table = spec['table']
    singular = SINGULAR[kind]
    skipped: list[str] = []
    results: list[dict] = []

    if kind == 'cards':
        infos = _scan_classes(cfg, kind)
        candidates = [(info.name, None) for info in infos.values() if not info.abstract]
        for name, _ in candidates:
            if not has_text(cfg, table, singular, name):
                skipped.append(name)
                continue
            card = _resolve_card(cfg, infos[name], infos)
            if card:
                results.append(card)
    else:
        for path in sorted(cfg.category_dir(kind).rglob('*.cs')):
            text = path.read_text(encoding='utf-8', errors='replace')
            if re.search(r'\babstract\s+class\s+' + re.escape(path.stem) + r'\b', text):
                continue
            if not has_text(cfg, table, singular, path.stem):
                skipped.append(path.stem)
                continue
            if kind == 'powers':
                entry = _resolve_power(cfg, path, images.get('powers', {}))
            else:
                entry = _resolve_collection(
                    cfg, kind, path, images.get(kind, {}),
                    'RelicRarity' if kind == 'relics' else 'PotionRarity',
                )
            if entry:
                results.append(entry)

    results.sort(key=lambda item: item['id'])
    return results, skipped
