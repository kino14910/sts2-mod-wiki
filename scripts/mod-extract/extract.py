"""Extract a source-tree mod into static/mods/<id>.

Replaces spire-codex's update.py pipeline: a mod ships readable C# sources,
localization JSON and PNG art, so GDRE/ILSpy extraction is unnecessary.

Usage:
  python scripts/mod-extract/extract.py --mod fgo
  python scripts/mod-extract/extract.py --mod fgo --skip-images
  python scripts/mod-extract/extract.py --mod fgo --source D:/projects/fgo --target static/mods/fgo
"""

from __future__ import annotations

import argparse
import json

from assets import bake_thumbs, build_index, build_manifest, copy_images
from config import ModConfig
from localization import copy_tables
from parsers import parse_category

ALL_STEPS = ('images', 'thumbs', 'localization', 'data', 'manifest')


def validate(cfg: ModConfig, kind: str, rows: list[dict]) -> list[str]:
    errors = []
    for row in rows:
        ident = row.get('id', '?')
        if kind == 'cards':
            if row['type'] not in cfg.enums['card_type']:
                errors.append(f'{ident}: invalid type {row["type"]}')
            if row['rarity'] not in cfg.enums['card_rarity'] and row['rarity'] not in cfg.card_rarities:
                errors.append(f'{ident}: invalid rarity {row["rarity"]}')
            if row['cost'] not in (None, 'X') and not isinstance(row['cost'], (int, float)):
                errors.append(f'{ident}: invalid cost {row["cost"]}')
            for keyword in row['keywords']:
                if keyword not in cfg.enums['card_keywords']:
                    errors.append(f'{ident}: invalid keyword {keyword}')
            for key in row.get('upgrade', {}):
                if key not in ('cost', 'secondEnergy', 'variables', 'keywords'):
                    errors.append(f'{ident}: invalid upgrade field {key}')
        else:
            enum_name = 'relic_rarity' if kind == 'relics' else 'potion_rarity'
            if kind != 'powers' and row['rarity'] not in cfg.enums[enum_name]:
                errors.append(f'{ident}: invalid rarity {row["rarity"]}')
            if kind == 'powers' and 'stack' in row and row['stack'] not in cfg.enums['power_stack']:
                errors.append(f'{ident}: invalid stack {row["stack"]}')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mod', default='fgo', help='mod config name under mods/')
    parser.add_argument('--source', help='override the mod source directory')
    parser.add_argument('--target', help='override the output directory')
    parser.add_argument('--only', help='comma-separated steps: ' + ','.join(ALL_STEPS))
    parser.add_argument('--skip-images', action='store_true')
    parser.add_argument('--skip-thumbs', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    cfg = ModConfig.load(args.mod, source=args.source, target=args.target)
    if not cfg.source.is_dir():
        raise SystemExit(f'source directory not found: {cfg.source}')

    steps = set(args.only.split(',')) if args.only else set(ALL_STEPS)
    unknown = steps - set(ALL_STEPS)
    if unknown:
        raise SystemExit(f'unknown steps: {sorted(unknown)}')
    if args.skip_images:
        steps.discard('images')
    if args.skip_thumbs:
        steps.discard('thumbs')

    print(f'mod={cfg.id} source={cfg.source} target={cfg.target} steps={",".join(sorted(steps))}')
    if args.dry_run:
        return 0

    cfg.target.mkdir(parents=True, exist_ok=True)

    if 'images' in steps:
        result = copy_images(cfg)
        print(f'[images] copied={result["copied"]} skipped={result["skipped"]}')
    if 'thumbs' in steps:
        result = bake_thumbs(cfg)
        print(f'[thumbs] written={result["written"]} skipped={result["skipped"]}')
    if 'localization' in steps:
        stats = copy_tables(cfg)
        for lang, info in stats.items():
            print(f'[localization] {lang}: tables={info["tables"]} keys={info["keys"]}')
    if 'manifest' in steps:
        manifest = build_manifest(cfg)
        print(f'[manifest] id={manifest["id"]} version={manifest.get("version", "-")}')

    images = build_index(cfg) if 'data' in steps else {}
    total_errors = []
    for kind in cfg.categories:
        if 'data' not in steps:
            break
        rows, skipped = parse_category(cfg, kind, images)
        errors = validate(cfg, kind, rows)
        total_errors += errors
        dest = cfg.data_file(kind)
        dest.write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + '\n',
            encoding='utf-8',
        )
        with_image = sum(1 for row in rows if row.get('image') or row.get('icon'))
        print(
            f'[{kind}] rows={len(rows)} no_localization={len(skipped)} '
            f'with_image={with_image} -> {dest.relative_to(cfg.target.parent.parent)}'
        )
        if skipped:
            print(f'   skipped: {", ".join(skipped[:8])}{" ..." if len(skipped) > 8 else ""}')

    if total_errors:
        for error in total_errors[:20]:
            print(f'ERROR {error}')
        return 1
    print('done')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
