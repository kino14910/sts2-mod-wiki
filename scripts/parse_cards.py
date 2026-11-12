#!/usr/bin/env python3
import json, re, os, glob

CARDS_DIR = r"D:\sts-fgoMod\Slay the Spire 2 decompile\MegaCrit.Sts2.Core.Models.Cards"
SOURCE = r"D:\projects\sts2-mod-wiki\static\mods\sts2\cards.json"
OUT = os.environ.get("CARDS_OUT", SOURCE)

# var type -> default name (used when the constructor's first arg is NOT a string literal)
DEFAULT_NAME = {
    "DamageVar": "Damage",
    "BlockVar": "Block",
    "HealVar": "Heal",
    "EnergyVar": "Energy",
    "StarsVar": "Stars",
    "ExtraDamageVar": "ExtraDamage",
    "GoldVar": "Gold",
    "RepeatVar": "Repeat",
    "SummonVar": "Summon",
    "ForgeVar": "Forge",
    "MaxHpVar": "MaxHp",
    "HpLossVar": "HpLoss",
    "OstyDamageVar": "OstyDamage",
    "CardsVar": "Cards",
    "CalculationBaseVar": "CalculationBase",
    "CalculationExtraVar": "CalculationExtra",
    "CalculatedBlockVar": "CalculatedBlock",
    "CalculatedDamageVar": "CalculatedDamage",
}
# vars that carry no static base value (value is computed at runtime)
COMPUTED = {"CalculatedBlockVar", "CalculatedDamageVar"}
# OnUpgrade property name -> canonical var Name (from DynamicVarSet)
PROP_MAP = {
    "Block": "Block", "CalculatedBlock": "CalculatedBlock", "CalculatedDamage": "CalculatedDamage",
    "CalculationBase": "CalculationBase", "CalculationExtra": "CalculationExtra", "Cards": "Cards",
    "Dexterity": "DexterityPower", "Doom": "DoomPower", "Energy": "Energy", "ExtraDamage": "ExtraDamage",
    "Forge": "Forge", "Gold": "Gold", "Heal": "Heal", "HpLoss": "HpLoss", "MaxHp": "MaxHp",
    "OstyDamage": "OstyDamage", "Poison": "PoisonPower", "Repeat": "Repeat", "Stars": "Stars",
    "Strength": "StrengthPower", "Summon": "Summon", "Vulnerable": "VulnerablePower", "Weak": "WeakPower",
}

NUM_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")
STR_RE = re.compile(r'"([^"]*)"|\'([^\']*)\'')

def num_of(text):
    m = NUM_RE.search(text)
    return m.group(0) if m else None

def to_num(s):
    if s is None:
        return None
    if "." in s:
        return float(s)
    return int(s)

def split_args(inner):
    # split on top-level commas
    parts, depth, cur = [], 0, ""
    for ch in inner:
        if ch == "," and depth == 0:
            parts.append(cur.strip()); cur = ""
        else:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts

def parse_var_ctor(ctor):
    # ctor like: DamageVar(8m, ValueProp.Move)  OR  PowerVar<VulnerablePower>(2m)
    # OR  PowerVar<WeakPower>("SappingWeak", 2m)  OR  DynamicVar("ViolenceHits", 3m)
    m = re.match(r"([A-Za-z_][A-Za-z0-9_]*)(?:<([A-Za-z0-9_]+)>)?\s*\((.*)\)\s*$", ctor, re.S)
    if not m:
        return None
    vtype = m.group(1)
    generic = m.group(2)
    args = m.group(3).strip()
    if not args:
        return None
    sub = split_args(args)
    first_is_str = bool(STR_RE.fullmatch(sub[0].strip())) if sub else False
    name_override = None
    numeric_candidates = sub
    if first_is_str:
        sm = STR_RE.fullmatch(sub[0].strip())
        name_override = sm.group(1) or sm.group(2)
        numeric_candidates = sub[1:]
    # value
    val = None
    for tok in numeric_candidates:
        n = num_of(tok)
        if n is not None:
            val = to_num(n)
            break
    # name
    if name_override:
        name = name_override
    elif generic and vtype == "PowerVar":
        name = generic
    elif vtype in DEFAULT_NAME:
        name = DEFAULT_NAME[vtype]
    else:
        # DynamicVar / IntVar / unknown with string name
        if first_is_str:
            name = name_override
        else:
            name = vtype  # fallback
    if val is None:
        return None  # computed / no value
    return name, val

def parse_vars_block(text):
    out = {}
    # find all new XxxVar(...) , including PowerVar<T>(...)
    for m in re.finditer(r'new\s+([A-Za-z_][A-Za-z0-9_]*)(?:<([A-Za-z0-9_]+)>)?\s*\(', text):
        start = m.end()
        # balance parens
        depth = 1
        i = start
        while i < len(text) and depth > 0:
            if text[i] == '(':
                depth += 1
            elif text[i] == ')':
                depth -= 1
            i += 1
        inner = text[start:i-1]
        ctor = (m.group(1) + (("<"+m.group(2)+">") if m.group(2) else "") + "(" + inner + ")")
        # skip array/list wrappers
        if m.group(1) in ("DynamicVar",) and re.match(r'\d+\s*\]', inner.strip()):
            continue
        if m.group(1) in ("_003C_003Ez__ReadOnlyArray", "_003C_003Ez__ReadOnlySingleElementList"):
            continue
        parsed = parse_var_ctor(ctor)
        if parsed:
            name, val = parsed
            out[name] = val
    return out

def balanced_brace(text, start):
    # text[start] == '{'
    depth = 0
    i = start
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(text)

def without_onupgrade(text):
    # 把 OnUpgrade 函数体替换成等长空白，避免把升级期 AddKeyword 当作基础关键词
    m = re.search(r'void\s+OnUpgrade\s*\(\s*\)', text)
    if not m:
        return text
    bs = text.find('{', m.end())
    if bs == -1:
        return text
    be = balanced_brace(text, bs)
    return text[:bs+1] + " " * (be - bs - 1) + text[be:]

def parse_onupgrade(text):
    deltas = {}  # var name -> delta
    cost_delta = 0
    added = []
    removed = []
    m = re.search(r'void\s+OnUpgrade\s*\(\s*\)', text)
    if not m:
        return deltas, cost_delta, added, removed
    bs = text.find('{', m.end())
    if bs == -1:
        return deltas, cost_delta, added, removed
    be = balanced_brace(text, bs)
    body = text[bs+1:be]
    for um in re.finditer(r'DynamicVars\.([A-Za-z0-9_]+)\.UpgradeValueBy\s*\(\s*([-+]?\d+(?:\.\d+)?)', body):
        prop = um.group(1)
        name = PROP_MAP.get(prop, prop)
        deltas[name] = deltas.get(name, 0) + to_num(um.group(2))
    for um in re.finditer(r'DynamicVars\[\s*"([^"]+)"\s*\]\.UpgradeValueBy\s*\(\s*([-+]?\d+(?:\.\d+)?)', body):
        name = um.group(1)
        deltas[name] = deltas.get(name, 0) + to_num(um.group(2))
    for um in re.finditer(r'EnergyCost\.UpgradeBy\s*\(\s*([-+]?\d+(?:\.\d+)?)', body):
        cost_delta += to_num(um.group(1))
    for km in re.finditer(r'AddKeyword\s*\(\s*CardKeyword\.([A-Za-z0-9_]+)', body):
        added.append(km.group(1))
    for km in re.finditer(r'RemoveKeyword\s*\(\s*CardKeyword\.([A-Za-z0-9_]+)', body):
        removed.append(km.group(1))
    return deltas, cost_delta, added, removed

def parse_keywords(text):
    kws = []
    # CanonicalKeywords region
    m = re.search(r'CanonicalKeywords\s*=>\s*(.*?);', text, re.S)
    if m:
        for km in re.finditer(r'CardKeyword\.([A-Za-z0-9_]+)', m.group(1)):
            kws.append(km.group(1))
    # AddKeyword calls
    for km in re.finditer(r'AddKeyword\s*\(\s*CardKeyword\.([A-Za-z0-9_]+)', text):
        kws.append(km.group(1))
    # dedupe preserve order
    seen = set(); res = []
    for k in kws:
        if k not in seen:
            seen.add(k); res.append(k)
    return res

def parse_constructor(text):
    m = re.search(r'\bbase\s*\(\s*([^)]*)\)', text)
    if not m:
        return None
    args = m.group(1)
    a = split_args(args)
    cost_raw = a[0].strip() if a else None
    ctype = rarity = None
    for tok in a[1:]:
        tm = re.search(r'CardType\.([A-Za-z0-9_]+)', tok)
        if tm: ctype = tm.group(1).lower()
        rm = re.search(r'CardRarity\.([A-Za-z0-9_]+)', tok)
        if rm: rarity = rm.group(1).lower()
    is_x = bool(re.search(r'HasEnergyCostX\s*=>\s*true', text))
    if is_x:
        cost = "X"
    else:
        cost = to_num(num_of(cost_raw)) if cost_raw else None
    return cost, ctype, rarity

def parse_star_cost(text):
    if re.search(r'HasStarCostX\s*=>\s*true', text):
        return "X"
    m = re.search(r'CanonicalStarCost\s*=>\s*(-?\d+)', text)
    if m:
        val = int(m.group(1))
        if val >= 0:
            return val
    return None

def dedupe(values):
    seen, out = set(), []
    for value in values:
        if value not in seen:
            seen.add(value)
            out.append(value)
    return out

EXISTING = {}
if os.path.exists(SOURCE):
    with open(SOURCE, encoding="utf-8") as f:
        EXISTING = {c["id"]: c for c in json.load(f)}

report = []
cards = []
files = sorted(glob.glob(os.path.join(CARDS_DIR, "*.cs")))
for path in files:
    fname = os.path.basename(path)
    cid = os.path.splitext(fname)[0]
    with open(path, encoding="utf-8", errors="replace") as f:
        text = f.read()
    # skip non-card files (must declare : CardModel)
    if not re.search(r'class\s+' + re.escape(cid) + r'\s*:\s*CardModel', text):
        continue
    cost, ctype, rarity = parse_constructor(text)
    # variables: find CanonicalVars region
    m = re.search(r'CanonicalVars\s*=>\s*(.*?);', text, re.S)
    vars_block = m.group(1) if m else ""
    parsed_vars = parse_vars_block(vars_block)
    deltas, cost_delta, added, removed = parse_onupgrade(text)
    parsed_keywords = parse_keywords(without_onupgrade(text))
    star = parse_star_cost(text)
    prev = EXISTING.get(cid, {})

    # 手工校正过的变量与 pool 优先保留，解析结果只补充缺失项
    variables = {**prev.get("variables", {}), **parsed_vars}
    keywords = parsed_keywords if (added or removed) else prev.get("keywords", parsed_keywords)
    if star is None and "secondEnergy" in prev:
        star = prev["secondEnergy"]

    upgraded = {}
    for name, base in variables.items():
        if name in deltas:
            upgraded[name] = base + deltas[name]
    for name, d in deltas.items():
        if name not in upgraded:
            upgraded[name] = d

    prev_upgrade = prev.get("upgrade", {})
    upgrade = {}
    merged_vars = {**upgraded, **prev_upgrade.get("variables", {})}
    if merged_vars:
        upgrade["variables"] = merged_vars
    if cost_delta and isinstance(cost, int):
        upgrade["cost"] = cost + cost_delta
    upgraded_keywords = dedupe([k for k in keywords + added if k not in removed])
    if upgraded_keywords != keywords:
        upgrade["keywords"] = upgraded_keywords
    for key in ("cost", "keywords", "secondEnergy"):
        if key in prev_upgrade and key not in upgrade:
            upgrade[key] = prev_upgrade[key]

    issues = []
    if cost is None: issues.append("no cost")
    if ctype is None: issues.append("no type")
    if rarity is None: issues.append("no rarity")
    if "pool" not in prev: issues.append("no pool")
    if issues:
        report.append(f"{cid}: " + ", ".join(issues))

    card = {"id": cid}
    if "pool" in prev:
        card["pool"] = prev["pool"]
    card["type"] = ctype
    card["rarity"] = rarity
    card["fullArt"] = bool(prev.get("fullArt", rarity == "ancient"))
    card["cost"] = cost
    if star is not None:
        card["secondEnergy"] = star
    card["variables"] = variables
    card["keywords"] = keywords
    if upgrade:
        card["upgrade"] = upgrade
    cards.append(card)

cards.sort(key=lambda c: c["id"].lower())
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(cards, f, ensure_ascii=False, indent=2)

print(f"Parsed {len(cards)} cards -> {OUT}")
print(f"Files scanned: {len(files)}")
if report:
    print("WARNINGS:")
    for r in report:
        print("  " + r)
else:
    print("No warnings.")
