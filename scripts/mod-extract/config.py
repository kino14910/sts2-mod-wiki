"""Mod-extraction configuration and localization-key rules.

Ports spire-codex's parser_paths.py path overrides and the wiki's
entry-id.ts key generation into one config-driven layer.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = Path(__file__).resolve().parent / 'mods'

RITSULIB_KIND = {
    'card': 'card',
    'power': 'power',
    'relic': 'relic',
    'potion': 'potion',
}


def normalize_public_stem(value: str) -> str:
    s = re.sub(r'[^A-Za-z0-9]+', '_', value.strip())
    s = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', s)
    s = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s)
    s = re.sub(r'_+', '_', s)
    return s.strip('_').upper()


def _camel_match(value: str, start: int):
    for i in range(start, len(value)):
        if (
            value[i].isascii()
            and value[i].isalnum()
            and i + 1 < len(value)
            and 'A' <= value[i + 1] <= 'Z'
        ):
            return i, 2, value[i], value[i + 1]
        if i == start and i != 0 and 'A' <= value[i] <= 'Z':
            return i, 1, '', value[i]
    return None


def _replace_game_camel_case(value: str) -> str:
    result = ''
    append_from = 0
    search_from = 0
    while search_from < len(value):
        match = _camel_match(value, search_from)
        if match is None:
            break
        index, length, group1, group2 = match
        result += value[append_from:index] + f'{group1}_{group2}'
        append_from = index + length
        search_from = append_from
    return result + value[append_from:]


def normalize_segment(value: str) -> str:
    s = _replace_game_camel_case(value.strip()).upper()
    s = re.sub(r'\s+', '_', s)
    return re.sub(r'[^A-Z0-9_]', '', s)


def entry_id(dependency: dict, kind: str, ident: str) -> str:
    dep_type = dependency.get('type')
    if dep_type == 'baselib':
        prefix = dependency['namespace'].strip().split('.')[0].strip().upper()
        return f'{prefix}-{normalize_segment(ident)}'
    if dep_type == 'ritsulib':
        return '_'.join(
            normalize_public_stem(part)
            for part in (dependency['modid'], RITSULIB_KIND[kind], ident)
        )
    if dep_type == 'other':
        return f"{dependency.get('prefix', '')}{normalize_segment(ident)}"
    raise ValueError(f'unknown dependency type: {dep_type}')


def localization_key(dependency: dict, kind: str, ident: str, field: str) -> str:
    return f'{entry_id(dependency, kind, ident)}.{field}'


def asset_key(ident: str) -> str:
    return re.sub(r'[^a-z0-9]', '', ident.lower())


def _absolute(value: str | Path, base: Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else base / path


@dataclass
class ModConfig:
    id: str
    source: Path
    target: Path
    mod_json: Path | None
    namespace: str
    dependency: dict
    languages: list[str]
    base_language: str
    paths: dict[str, Path]
    categories: dict[str, dict]
    assets: dict[str, str]
    localization_tables: list[str]
    card_pool: str
    thumb_width: int
    enums: dict[str, list[str]]
    aliases: dict[str, dict[str, str]]
    card_rarities: dict[str, dict]
    fallbacks: dict[str, dict]
    raw: dict

    @classmethod
    def load(cls, mod_id: str, *, source: str | None = None, target: str | None = None) -> 'ModConfig':
        path = CONFIG_DIR / f'{mod_id}.json'
        if not path.exists():
            raise SystemExit(f'mod config not found: {path}')
        raw = json.loads(path.read_text(encoding='utf-8'))

        source_root = _absolute(source or raw['source'], PROJECT_ROOT)
        target_root = _absolute(target or raw['target'], PROJECT_ROOT)
        paths = {k: _absolute(v, source_root) for k, v in raw['paths'].items()}
        mod_json = _absolute(raw['mod_json'], source_root) if raw.get('mod_json') else None

        return cls(
            id=raw['id'],
            source=source_root,
            target=target_root,
            mod_json=mod_json,
            namespace=raw.get('namespace', ''),
            dependency=raw['dependency'],
            languages=raw['languages'],
            base_language=raw.get('base_language', 'eng'),
            paths=paths,
            categories=raw['categories'],
            assets=raw.get('assets', {}),
            localization_tables=raw.get('localization_tables', []),
            card_pool=raw.get('card_pool', mod_id),
            thumb_width=int(raw.get('thumb_width', 250)),
            enums=raw.get('enums', {}),
            aliases=raw.get('aliases', {}),
            card_rarities=raw.get('card_rarities', {}),
            fallbacks=raw.get('fallbacks', {}),
            raw=raw,
        )

    def allowed(self, name: str, value: str) -> str | None:
        values = self.enums.get(name)
        if values is None:
            return value
        return value if value in values else None

    def alias(self, name: str, value: str) -> str:
        return self.aliases.get(name, {}).get(value, value)

    def custom_rarity(self, value: str | None) -> str | None:
        if not value:
            return None
        for name in self.card_rarities:
            if name.lower() == value.lower():
                return name
        return None

    def fallback(self, kind: str, field: str):
        return self.fallbacks.get(kind, {}).get(field)

    @classmethod
    def available(cls) -> list[str]:
        return sorted(p.stem for p in CONFIG_DIR.glob('*.json'))

    def category_dir(self, kind: str) -> Path:
        return _absolute(self.categories[kind]['dir'], self.source)

    def loc_file(self, lang: str, table: str) -> Path | None:
        path = self.paths['localization'] / lang / f'{table}.json'
        return path if path.exists() else None

    def data_file(self, kind: str) -> Path:
        return self.target / self.categories[kind]['data']

    def image_dir(self, kind: str) -> Path:
        return self.target / self.assets[kind]
