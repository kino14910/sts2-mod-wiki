#!/usr/bin/env python3
"""Rebuild the vanilla `static/mods/sts2` dataset from a decompiled game build.

The layout produced by GDRE/ILSpy for recent builds is
`<game>/src/Core/Models/<Kind>/*.cs` plus `<game>/localization/<lang>/*.json`.
Earlier scripts assumed a flat `MegaCrit.Sts2.Core.Models.*` folder under a
separate decompile directory and only regenerated cards.json.

Usage:
  python scripts/generate_vanilla.py
  python scripts/generate_vanilla.py --game "D:/sts-fgoMod/Slay the Spire 2" --dry-run
  python scripts/generate_vanilla.py --only cards,localization
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GAME = Path("D:/sts-fgoMod/Slay the Spire 2")
TARGET = ROOT / "static/mods/sts2"

LANGS = ("eng", "zhs")
TABLES = ("cards", "characters", "potions", "powers", "relics")

MODEL_DIRS = {
    "cards": "Cards",
    "potions": "Potions",
    "powers": "Powers",
    "relics": "Relics",
}
POOL_DIRS = {
    "cards": ("CardPools", "CardPool"),
    "potions": ("PotionPools", "PotionPool"),
    "relics": ("RelicPools", "RelicPool"),
}
BASE_CLASS = {
    "cards": r"CardModel",
    "potions": r"\w*PotionModel",
    "powers": r"[\w, ]*(?:PowerModel|Temporary\w+Power)",
    "relics": r"\w*RelicModel",
}

CARD_KEYWORDS = frozenset({"Exhaust", "Ethereal", "Innate", "Unplayable", "Retain", "Sly", "Eternal"})
RARITY_FALLBACK = {
    "relics": {"None": "special", "Event": "event"},
    "potions": {"None": "special", "Event": "special", "Token": "special"},
}
VALID_RARITY = {
    "relics": frozenset({"starter", "common", "uncommon", "rare", "ancient", "shop", "event", "special"}),
    "potions": frozenset({"common", "uncommon", "rare", "special"}),
}
FALLBACK_CAST = ("Ironclad", "Silent", "Regent", "Necrobinder", "Defect")

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
    "TurnsVar": "Turns",
    "HitCountVar": "HitCount",
}
PROP_MAP = {
    "Block": "Block", "CalculatedBlock": "CalculatedBlock", "CalculatedDamage": "CalculatedDamage",
    "CalculationBase": "CalculationBase", "CalculationExtra": "CalculationExtra", "Cards": "Cards",
    "Dexterity": "DexterityPower", "Doom": "DoomPower", "Energy": "Energy", "ExtraDamage": "ExtraDamage",
    "Forge": "Forge", "Gold": "Gold", "Heal": "Heal", "HpLoss": "HpLoss", "MaxHp": "MaxHp",
    "OstyDamage": "OstyDamage", "Poison": "PoisonPower", "Repeat": "Repeat", "Stars": "Stars",
    "Strength": "StrengthPower", "Summon": "Summon", "Vulnerable": "VulnerablePower", "Weak": "WeakPower",
    "Damage": "Damage", "Turns": "Turns", "HitCount": "HitCount",
}

NUM_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")
STR_RE = re.compile(r'"([^"]*)"|\'([^\']*)\'')


def load_json(path: Path, default=None):
    if not path.exists():
        return {} if default is None else default
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data, indent=2, sort_keys=False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=indent, sort_keys=sort_keys) + "\n",
        encoding="utf-8",
    )


def entry_key(name: str) -> str:
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name)
    return re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", "_", s).upper()


def asset_stem(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def has_title(table: dict, key: str) -> bool:
    return f"{key}.title" in table or any(k.startswith(f"{key}.title.") for k in table)


def num_of(text: str):
    m = NUM_RE.search(text)
    return m.group(0) if m else None


def to_num(s):
    if s is None:
        return None
    return float(s) if "." in s else int(s)


def split_args(inner: str) -> list[str]:
    parts, depth, cur = [], 0, ""
    for ch in inner:
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


def balanced_brace(text: str, start: int) -> int:
    depth, i = 0, start
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(text)


def without_onupgrade(text: str) -> str:
    m = re.search(r"void\s+OnUpgrade\s*\(\s*\)", text)
    if not m:
        return text
    bs = text.find("{", m.end())
    if bs == -1:
        return text
    be = balanced_brace(text, bs)
    return text[: bs + 1] + " " * (be - bs - 1) + text[be:]


def constant_values(content: str) -> dict:
    out = {}
    for m in re.finditer(r"\b([_A-Za-z]\w*)\s*=\s*(-?\d+(?:\.\d+)?)m?\s*;", content):
        out[m.group(1)] = to_num(m.group(2))
    for m in re.finditer(r"\b\w+\s+([A-Z]\w*)\s*=>\s*(-?\d+(?:\.\d+)?)m?\s*;", content):
        out.setdefault(m.group(1), to_num(m.group(2)))
    return out


def parse_var_ctor(ctor: str, constants: dict):
    m = re.match(r"([A-Za-z_][A-Za-z0-9_]*)(?:<([A-Za-z0-9_]+)>)?\s*\((.*)\)\s*$", ctor, re.S)
    if not m:
        return None
    vtype, generic, args = m.group(1), m.group(2), m.group(3).strip()
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
    val = None
    for tok in numeric_candidates:
        n = num_of(tok)
        if n is not None:
            val = to_num(n)
            break
    if val is None:
        for tok in numeric_candidates:
            ident = tok.strip()
            field = "_" + ident[0].lower() + ident[1:] if ident else ""
            if ident in constants:
                val = constants[ident]
                break
            if field in constants:
                val = constants[field]
                break
    if name_override:
        name = name_override
    elif generic and vtype == "PowerVar":
        name = generic
    elif vtype in DEFAULT_NAME:
        name = DEFAULT_NAME[vtype]
    else:
        name = vtype
    if val is None:
        return None
    return name, val


def parse_vars_block(text: str, content: str) -> dict:
    constants = constant_values(content)
    out = {}
    for m in re.finditer(r"new\s+([A-Za-z_][A-Za-z0-9_]*)(?:<([A-Za-z0-9_]+)>)?\s*\(", text):
        start = m.end()
        depth, i = 1, start
        while i < len(text) and depth > 0:
            if text[i] == "(":
                depth += 1
            elif text[i] == ")":
                depth -= 1
            i += 1
        inner = text[start : i - 1]
        ctor = m.group(1) + (("<" + m.group(2) + ">") if m.group(2) else "") + "(" + inner + ")"
        if m.group(1) in ("_003C_003Ez__ReadOnlyArray", "_003C_003Ez__ReadOnlySingleElementList"):
            continue
        parsed = parse_var_ctor(ctor, constants)
        if parsed:
            name, val = parsed
            out[name] = val
    return out


def canonical_vars(text: str) -> str:
    m = re.search(r"(?<!\w)CanonicalVars\s*=>\s*(.*?);", text, re.S)
    return m.group(1) if m else ""


def parse_onupgrade(text: str):
    deltas, cost_delta, star_delta, added, removed = {}, 0, 0, [], []
    m = re.search(r"void\s+OnUpgrade\s*\(\s*\)", text)
    if not m:
        return deltas, cost_delta, star_delta, added, removed
    bs = text.find("{", m.end())
    if bs == -1:
        return deltas, cost_delta, star_delta, added, removed
    body = text[bs + 1 : balanced_brace(text, bs)]
    for um in re.finditer(r"DynamicVars\.([A-Za-z0-9_]+)\.UpgradeValueBy\s*\(\s*([-+]?\d+(?:\.\d+)?)", body):
        name = PROP_MAP.get(um.group(1), um.group(1))
        deltas[name] = deltas.get(name, 0) + to_num(um.group(2))
    for um in re.finditer(r'DynamicVars\[\s*"([^"]+)"\s*\]\.UpgradeValueBy\s*\(\s*([-+]?\d+(?:\.\d+)?)', body):
        name = um.group(1)
        deltas[name] = deltas.get(name, 0) + to_num(um.group(2))
    for um in re.finditer(r"EnergyCost\.UpgradeBy\s*\(\s*([-+]?\d+(?:\.\d+)?)", body):
        cost_delta += to_num(um.group(1))
    for um in re.finditer(r"UpgradeStarCostBy\s*\(\s*([-+]?\d+(?:\.\d+)?)", body):
        star_delta += to_num(um.group(1))
    for km in re.finditer(r"AddKeyword\s*\(\s*CardKeyword\.([A-Za-z0-9_]+)", body):
        added.append(km.group(1))
    for km in re.finditer(r"RemoveKeyword\s*\(\s*CardKeyword\.([A-Za-z0-9_]+)", body):
        removed.append(km.group(1))
    return deltas, cost_delta, star_delta, added, removed


def parse_keywords(text: str) -> list[str]:
    kws = []
    m = re.search(r"CanonicalKeywords\s*=>\s*(.*?);", text, re.S)
    if m:
        kws += re.findall(r"CardKeyword\.([A-Za-z0-9_]+)", m.group(1))
    kws += re.findall(r"AddKeyword\s*\(\s*CardKeyword\.([A-Za-z0-9_]+)", text)
    seen, res = set(), []
    for k in kws:
        if k not in seen:
            seen.add(k)
            res.append(k)
    return res


def parse_constructor(text: str):
    m = re.search(r"\bbase\s*\(\s*([^)]*)\)", text)
    if not m:
        return None, None, None
    args = split_args(m.group(1))
    cost_raw = args[0].strip() if args else None
    ctype = rarity = None
    for tok in args[1:]:
        tm = re.search(r"CardType\.([A-Za-z0-9_]+)", tok)
        if tm:
            ctype = tm.group(1).lower()
        rm = re.search(r"CardRarity\.([A-Za-z0-9_]+)", tok)
        if rm:
            rarity = rm.group(1).lower()
    if re.search(r"HasEnergyCostX\s*=>\s*true", text):
        cost = "X"
    else:
        cost = to_num(num_of(cost_raw)) if cost_raw else None
    return cost, ctype, rarity


def parse_star_cost(text: str):
    if re.search(r"HasStarCostX\s*=>\s*true", text):
        return "X"
    m = re.search(r"CanonicalStarCost\s*=>\s*(-?\d+)", text)
    if m and int(m.group(1)) >= 0:
        return int(m.group(1))
    return None


class GameSource:
    def __init__(self, root: Path):
        self.root = root
        self.models = root / "src/Core/Models"
        self.entities = root / "src/Core/Entities/Cards"
        self.localization = root / "localization"
        self._loc = {}

    def files(self, kind: str) -> list[Path]:
        return [
            p
            for p in sorted((self.models / MODEL_DIRS[kind]).glob("*.cs"))
            if not p.stem.startswith(("Deprecated", "Mock"))
        ]

    def loc(self, lang: str, table: str) -> dict:
        key = (lang, table)
        if key not in self._loc:
            self._loc[key] = load_json(self.localization / lang / f"{table}.json")
        return self._loc[key]

    def playable_characters(self) -> list[str]:
        text = (self.models / "ModelDb.cs").read_text(encoding="utf-8")
        block = re.search(r"IEnumerable<CharacterModel> AllCharacters\b.*?\{(.*?)\}\);", text, re.S)
        if block:
            names = re.findall(r"Character<(\w+)>\(\)", block.group(1))
            if names:
                return list(names)
        return list(FALLBACK_CAST)

    def pools(self, kind: str) -> dict[str, str]:
        dirname, suffix = POOL_DIRS[kind]
        result = {}
        for path in sorted((self.models / dirname).glob("*.cs")):
            pool = path.stem.replace(suffix, "").lower()
            for cls in re.findall(r"ModelDb\.(?:Card|Relic|Potion)<(\w+)>\(", path.read_text(encoding="utf-8")):
                result.setdefault(cls, pool)
        return result

    def card_tags(self) -> list[str]:
        path = self.entities / "CardTag.cs"
        if not path.exists():
            return []
        body = re.search(r"enum\s+CardTag\s*\{(.*)\}", path.read_text(encoding="utf-8"), re.S)
        if not body:
            return []
        text = re.sub(r"///[^\n]*", "", body.group(1))
        return [n for n in re.findall(r"\b([A-Z]\w*)\b", text) if n != "None"]

    def tarot_cards(self) -> list[str]:
        path = self.entities / "TarotCards.cs"
        if not path.exists():
            return []
        return list(dict.fromkeys(re.findall(r"ModelDb\.Card<(\w+)>", path.read_text(encoding="utf-8"))))

    def character_colors(self, name: str) -> dict:
        path = self.models / "CardPools" / f"{name}CardPool.cs"
        text = path.read_text(encoding="utf-8") if path.exists() else ""
        colors = {}
        for prop, key in (("DeckEntryCardColor", "accent"), ("EnergyOutlineColor", "energyOutline")):
            m = re.search(rf"{prop}\s*=>\s*new\s+Color\(\s*\"([0-9A-Fa-f]{{6,8}})", text)
            if m:
                colors[key] = "#" + m.group(1)[:6]
        return colors


class Report:
    def __init__(self):
        self.counts = Counter()
        self.examples = {}

    def add(self, key: str, value: str | None = None, *, limit: int = 12):
        self.counts[key] += 1
        if value is not None:
            bucket = self.examples.setdefault(key, [])
            if value not in bucket and len(bucket) < limit:
                bucket.append(value)

    def text(self) -> str:
        lines = ["=== vanilla data generation ==="]
        for key in sorted(self.counts):
            lines.append(f"  {key}: {self.counts[key]}")
            for value in self.examples.get(key, []):
                lines.append(f"    - {value}")
        return "\n".join(lines)


def build_cards(src: GameSource, target: Path, args, report: Report) -> list[dict]:
    prev = {r["id"]: r for r in load_json(target / "cards.json", [])}
    pools = src.pools("cards")
    eng = src.loc("eng", "cards")
    rows, seen = [], set()

    for path in src.files("cards"):
        cid, content = path.stem, path.read_text(encoding="utf-8", errors="replace")
        if not re.search(rf"class\s+{re.escape(cid)}\s*:\s*CardModel", content):
            report.add("cards.skipped_not_model", cid)
            continue
        key = entry_key(cid)
        if not has_title(eng, key):
            report.add("cards.skipped_no_localization", cid)
            continue
        old = prev.get(cid, {})
        cost, ctype, rarity = parse_constructor(content)
        parsed_vars = parse_vars_block(canonical_vars(content), content)
        deltas, cost_delta, star_delta, added, removed = parse_onupgrade(content)
        raw_keywords = parse_keywords(without_onupgrade(content))
        keywords = [k for k in raw_keywords if k in CARD_KEYWORDS]
        for k in set(raw_keywords) - CARD_KEYWORDS:
            report.add("cards.unknown_keyword", f"{cid}: {k}")
        star = parse_star_cost(content)

        pool = pools.get(cid)
        if pool and cid in prev and old.get("pool") != pool:
            report.add("cards.pool_changed", f"{cid}: {old.get('pool')} -> {pool}")
        if args.keep_legacy_pool and old.get("pool"):
            pool = old["pool"]
        if pool is None:
            pool = old.get("pool") or "colorless"
            report.add("cards.pool_fallback", f"{cid}: {pool}")

        if args.prefer_existing:
            variables = {**parsed_vars, **old.get("variables", {})}
        else:
            variables = {**old.get("variables", {}), **parsed_vars}
        if old.get("variables") and parsed_vars:
            for name in set(old["variables"]) & set(parsed_vars):
                if old["variables"][name] != parsed_vars[name]:
                    report.add("cards.variable_conflict", f"{cid}.{name}: {old['variables'][name]} -> {parsed_vars[name]}")

        upgraded = {name: base + deltas[name] for name, base in variables.items() if name in deltas}
        for name, delta in deltas.items():
            upgraded.setdefault(name, delta)
        prev_upgrade = old.get("upgrade", {})
        if args.prefer_existing:
            merged_vars = {**upgraded, **prev_upgrade.get("variables", {})}
        else:
            merged_vars = {**prev_upgrade.get("variables", {}), **upgraded}
        upgrade = {}
        if merged_vars:
            upgrade["variables"] = merged_vars
        if cost_delta and isinstance(cost, int):
            upgrade["cost"] = cost + cost_delta
        if star_delta and isinstance(star, int):
            upgrade["secondEnergy"] = star + star_delta
        upgraded_keywords = [k for k in dict.fromkeys(keywords + added) if k not in removed]
        if upgraded_keywords != keywords:
            upgrade["keywords"] = [k for k in upgraded_keywords if k in CARD_KEYWORDS]
        for name in ("cost", "keywords", "secondEnergy"):
            if name in prev_upgrade and name not in upgrade:
                upgrade[name] = prev_upgrade[name]

        if cost is None:
            report.add("cards.no_cost", cid)
        if ctype is None:
            report.add("cards.no_type", cid)
        if rarity is None:
            report.add("cards.no_rarity", cid)
        if cid not in prev:
            report.add("cards.added", cid)

        row = {"id": cid, "pool": pool, "type": ctype, "rarity": rarity}
        row["fullArt"] = bool(old.get("fullArt", rarity == "ancient"))
        row["cost"] = cost
        if star is not None:
            row["secondEnergy"] = star
        row["variables"] = variables
        row["keywords"] = keywords
        if upgrade:
            row["upgrade"] = upgrade
        rows.append(row)
        seen.add(cid)

    for cid, row in prev.items():
        if cid not in seen:
            report.add("cards.stale", cid)
            key = entry_key(cid)
            if args.drop_stale or not has_title(eng, key) or f"{key}.description" not in eng:
                report.add("cards.stale_dropped", cid)
                continue
            rows.append(dict(row))

    rows.sort(key=lambda r: r["id"].lower())
    return rows


def collection_variables(content: str, description: str) -> dict:
    if not description:
        return {}
    parsed = parse_vars_block(canonical_vars(content), content)
    placeholders = {
        m.group(1)
        for m in re.finditer(r"\{([A-Za-z_]\w*)(?:[:}])", description)
    }
    return {k: v for k, v in parsed.items() if k in placeholders}


def build_collections(src: GameSource, target: Path, kind: str, args, report: Report) -> list[dict]:
    filename = f"{kind}.json"
    prev_rows = load_json(target / filename, [])
    prev = {r["id"]: r for r in prev_rows}
    pools = src.pools(kind)
    cast = {name.lower() for name in src.playable_characters()}
    eng = src.loc("eng", kind)
    image_dir = "images/" + kind
    rows, seen = [], []

    for path in src.files(kind):
        cid, content = path.stem, path.read_text(encoding="utf-8", errors="replace")
        if not re.search(rf"class\s+{re.escape(cid)}\s*:\s*{BASE_CLASS[kind]}", content):
            report.add(f"{kind}.skipped_not_model", cid)
            continue
        key = entry_key(cid)
        if not has_title(eng, key):
            report.add(f"{kind}.skipped_no_localization", cid)
            continue
        seen.append(cid)
        old = prev.get(cid)
        rarity_match = re.search(r"Rarity\s*=>\s*(?:Relic|Potion)Rarity\.(\w+)", content)
        rarity_raw = rarity_match.group(1) if rarity_match else "None"
        rarity = RARITY_FALLBACK[kind].get(rarity_raw, rarity_raw.lower())
        if rarity not in VALID_RARITY[kind]:
            report.add(f"{kind}.unknown_rarity", f"{cid}: {rarity_raw}")
            rarity = "special"
        if old and old.get("rarity") != rarity:
            report.add(f"{kind}.rarity_changed", f"{cid}: {old.get('rarity')} -> {rarity}")

        if old is None:
            pool = pools.get(cid, "")
            character = pool if pool in cast else "any"
            image = f"{image_dir}/{asset_stem(cid)}.png"
            row = {
                "id": cid,
                "rarity": rarity,
                "character": character,
                "tags": [],
            }
            if (target / image).exists():
                row["image"] = image
            else:
                report.add(f"{kind}.missing_image", cid)
            variables = collection_variables(content, eng.get(f"{key}.description", ""))
            if variables:
                row["variables"] = variables
            report.add(f"{kind}.added", cid)
        else:
            row = dict(old)
            row["rarity"] = rarity
        rows.append(row)

    for row in prev_rows:
        if row["id"] not in seen:
            report.add(f"{kind}.stale", row["id"])
            if not args.drop_stale:
                rows.append(dict(row))
    return rows


def build_powers(src: GameSource, target: Path, args, report: Report) -> list[dict]:
    prev_rows = load_json(target / "powers.json", [])
    prev = {r["id"]: r for r in prev_rows}
    eng = src.loc("eng", "powers")
    rows, seen = [], []

    for path in src.files("powers"):
        cid, content = path.stem, path.read_text(encoding="utf-8", errors="replace")
        if not re.search(rf"class\s+{re.escape(cid)}\s*:\s*{BASE_CLASS['powers']}", content):
            report.add("powers.skipped_not_model", cid)
            continue
        key = entry_key(cid)
        if f"{key}.title" not in eng or f"{key}.description" not in eng:
            report.add("powers.skipped_no_localization", cid)
            continue
        seen.append(cid)
        if cid in prev:
            rows.append(dict(prev[cid]))
            continue
        row = {"id": cid}
        icon = f"images/powers/{asset_stem(cid)}.png"
        if (target / icon).exists():
            row["icon"] = icon
        else:
            report.add("powers.missing_icon", cid)
        report.add("powers.added", cid)
        rows.append(row)

    for row in prev_rows:
        if row["id"] not in seen:
            report.add("powers.stale", row["id"])
            if not args.drop_stale:
                rows.append(dict(row))
    return rows


def merge_localization(src: GameSource, target: Path, report: Report) -> list[tuple[Path, dict]]:
    writes = []
    for lang in LANGS:
        for table in TABLES:
            path = target / "localization" / lang / f"{table}.json"
            wiki = load_json(path)
            game = src.loc(lang, table)
            for key in sorted(set(game) - set(wiki)):
                report.add(f"localization.{lang}.{table}.added_key", key)
            merged = {**game, **wiki}
            if table in ("cards", "potions", "powers", "relics"):
                for variant, value in game.items():
                    m = re.fullmatch(r"([A-Z0-9_]+)\.title\.\w+", variant)
                    if not m:
                        continue
                    plain = f"{m.group(1)}.title"
                    if plain not in merged:
                        merged[plain] = value
                        report.add(f"localization.{lang}.{table}.title_variant_fallback", plain)
            writes.append((path, merged))
    return writes


def update_manifest(src: GameSource, target: Path, report: Report) -> tuple[Path, dict] | None:
    path = target / "manifest.json"
    manifest = load_json(path)
    pools = manifest.setdefault("cardPool", {})
    template = pools.get("colorless", {})
    changed = False
    for name in src.playable_characters():
        cid = name.lower()
        if cid in pools:
            continue
        colors = src.character_colors(name)
        assets = {
            "char": f"images/character_icon_{cid}.png",
            "cardEnergy": f"images/energy_{cid}.png",
            "textEnergy": f"images/{cid}_energy_icon.png",
        }
        assets = {k: v for k, v in assets.items() if (target / v).exists()}
        pools[cid] = {
            **assets,
            "accent": colors.get("accent", "#a6a199"),
            "energyOutline": colors.get("energyOutline", "#5c5440"),
            "cardFrame": dict(template.get("cardFrame", {})),
            "shader": dict(template.get("shader", {"h": 1.0, "s": 0.0, "v": 1.2})),
        }
        report.add("manifest.card_pool_added", f"{cid} ({name})")
        changed = True
    return (path, manifest) if changed else None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--game", type=Path, default=DEFAULT_GAME)
    parser.add_argument("--target", type=Path, default=TARGET)
    parser.add_argument("--cards-out", type=Path, default=None)
    parser.add_argument("--only", default="cards,collections,powers,localization,manifest")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--drop-stale", action="store_true", help="Drop entities no longer present in the game sources")
    parser.add_argument("--keep-legacy-pool", action="store_true", help="Keep hand-corrected card pools instead of source pools")
    parser.add_argument("--prefer-existing", action="store_true", help="Keep hand-corrected variables/upgrade values on conflicts")
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args(argv)

    src = GameSource(args.game)
    if not (src.models / "Cards").is_dir() or not src.localization.is_dir():
        print(f"ERROR: game sources not found under {args.game}", file=sys.stderr)
        return 1
    target = args.target
    only = {part.strip() for part in args.only.split(",") if part.strip()}
    report = Report()
    cast = src.playable_characters()
    print(f"Game: {args.game}")
    print(f"Characters: {', '.join(cast)}")
    print(f"Card tags: {', '.join(src.card_tags())}")
    print(f"Tarot cards: {len(src.tarot_cards())}")

    outputs: list[tuple[Path, object, object, bool]] = []
    if "cards" in only:
        cards = build_cards(src, target, args, report)
        out = args.cards_out or target / "cards.json"
        outputs.append((out, cards, 2, False))
        print(f"cards: {len(cards)} rows")
    if "collections" in only:
        for kind in ("potions", "relics"):
            rows = build_collections(src, target, kind, args, report)
            outputs.append((target / f"{kind}.json", rows, 2, False))
            print(f"{kind}: {len(rows)} rows")
    if "powers" in only:
        powers = build_powers(src, target, args, report)
        outputs.append((target / "powers.json", powers, "\t", False))
        print(f"powers: {len(powers)} rows")
    localization_writes = []
    if "localization" in only:
        localization_writes = merge_localization(src, target, report)
        print(f"localization: {len(localization_writes)} tables merged")
    manifest_write = None
    if "manifest" in only:
        manifest_write = update_manifest(src, target, report)
        print("manifest: cardPool synchronized with the game cast")

    if not args.dry_run:
        for path, data, indent, sort_keys in outputs:
            dump_json(path, data, indent=indent, sort_keys=sort_keys)
        for path, data in localization_writes:
            dump_json(path, data, indent=2, sort_keys=True)
        if manifest_write:
            path, data = manifest_write
            dump_json(path, data, indent="\t")
    else:
        print("DRY RUN: no files written")
    text = report.text()
    print(text)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps({"counts": dict(report.counts), "examples": report.examples}, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
