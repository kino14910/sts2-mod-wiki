"""Copy the mod's localization tables into static/mods/<id>/localization.

Replaces spire-codex's localization_parser.py SmartFormat->ICU conversion:
the wiki consumes the game's raw dotted keys directly.
"""

from __future__ import annotations

import json

from config import ModConfig


def copy_tables(cfg: ModConfig) -> dict:
    stats: dict = {}
    for lang in cfg.languages:
        source_dir = cfg.paths['localization'] / lang
        if not source_dir.is_dir():
            stats[lang] = {'tables': 0, 'keys': 0, 'missing': True}
            continue
        dest_dir = cfg.target / 'localization' / lang
        dest_dir.mkdir(parents=True, exist_ok=True)
        tables = 0
        keys = 0
        for table in cfg.localization_tables:
            source = source_dir / f'{table}.json'
            if not source.exists():
                continue
            data = json.loads(source.read_text(encoding='utf-8'))
            (dest_dir / f'{table}.json').write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8',
            )
            tables += 1
            keys += len(data)
        stats[lang] = {'tables': tables, 'keys': keys, 'missing': False}
    return stats
