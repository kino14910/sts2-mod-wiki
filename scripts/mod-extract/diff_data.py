"""Diff two snapshots of a mod's static/mods/<id> data.

Adapted from spire-codex's tools/diff_data.py: category list, file names and
the base path now come from the mod config instead of hardcoded game data.

Usage:
  python scripts/mod-extract/diff_data.py --mod fgo HEAD~1
  python scripts/mod-extract/diff_data.py --mod fgo v0.8.0 v0.9.0 --format md
  python scripts/mod-extract/diff_data.py --mod fgo old/ new/ --format json
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from config import PROJECT_ROOT, ModConfig

IGNORE_FIELDS = {'image_url', 'beta_image_url', 'sort_order', 'image', 'icon'}


def deep_diff(prefix: str, old, new):
    if old == new:
        return
    if isinstance(old, dict) or isinstance(new, dict):
        old_d = old if isinstance(old, dict) else {}
        new_d = new if isinstance(new, dict) else {}
        if (old is not None and not isinstance(old, dict)) or (
            new is not None and not isinstance(new, dict)
        ):
            yield prefix, old, new
            return
        for key in sorted(set(old_d) | set(new_d), key=str):
            yield from deep_diff(f'{prefix}.{key}' if prefix else key, old_d.get(key), new_d.get(key))
        return
    if isinstance(old, list) or isinstance(new, list):
        old_l = old if isinstance(old, list) else []
        new_l = new if isinstance(new, list) else []
        if (old is not None and not isinstance(old, list)) or (
            new is not None and not isinstance(new, list)
        ):
            yield prefix, old, new
            return
        keyed = all(isinstance(x, dict) and 'id' in x for x in old_l) and all(
            isinstance(x, dict) and 'id' in x for x in new_l
        )
        if keyed:
            old_by = {x['id']: x for x in old_l}
            new_by = {x['id']: x for x in new_l}
            for i in sorted(set(old_by) | set(new_by), key=str):
                yield from deep_diff(f'{prefix}[{i}]', old_by.get(i), new_by.get(i))
        else:
            for i in range(max(len(old_l), len(new_l))):
                yield from deep_diff(
                    f'{prefix}[{i}]',
                    old_l[i] if i < len(old_l) else None,
                    new_l[i] if i < len(new_l) else None,
                )
        return
    yield prefix, old, new


def format_value(value) -> str:
    if value is None:
        return 'none'
    if isinstance(value, bool):
        return 'yes' if value else 'no'
    if isinstance(value, (list, dict)):
        items = value if isinstance(value, list) else list(value.items())
        rendered = ', '.join(str(v) for v in items)
        return rendered if len(rendered) <= 100 else f'{len(items)} items'
    if isinstance(value, str) and len(value) > 80:
        return value[:77] + '...'
    return str(value)


def entity_name(entity: dict) -> str:
    return entity.get('name') or entity.get('title') or entity.get('id', '?')


def diff_entity(old: dict, new: dict) -> dict:
    return {
        path: (old_val, new_val)
        for path, old_val, new_val in deep_diff('', old, new)
        if path.split('.', 1)[0].split('[', 1)[0] not in IGNORE_FIELDS
    }


def diff_category(old_data: list, new_data: list) -> dict:
    old_map = {e['id']: e for e in old_data}
    new_map = {e['id']: e for e in new_data}
    added = sorted(set(new_map) - set(old_map))
    removed = sorted(set(old_map) - set(new_map))
    changed = {}
    for eid in sorted(set(old_map) & set(new_map)):
        changes = diff_entity(old_map[eid], new_map[eid])
        if changes:
            changed[eid] = changes
    return {
        'added': added,
        'removed': removed,
        'changed': changed,
        'old_count': len(old_data),
        'new_count': len(new_data),
    }


def load_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding='utf-8'))


def from_git(ref: str, cfg: ModConfig, tmp: Path) -> Path:
    out = tmp / ref.replace('/', '_')
    out.mkdir(parents=True, exist_ok=True)
    prefix = cfg.target.relative_to(PROJECT_ROOT).as_posix()
    result = subprocess.run(
        ['git', 'ls-tree', '-r', '--name-only', ref, prefix],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        raise SystemExit(f'cannot read git ref {ref}: {result.stderr.strip()}')
    for line in result.stdout.strip().splitlines():
        if not line.endswith('.json'):
            continue
        content = subprocess.run(
            ['git', 'show', f'{ref}:{line}'],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
        )
        if content.returncode == 0:
            (out / Path(line).name).write_text(content.stdout, encoding='utf-8')
    return out


def render(results: dict, fmt: str, mod_id: str, old_label: str, new_label: str) -> str:
    if fmt == 'json':
        return json.dumps(
            {
                'mod': mod_id,
                'from': old_label,
                'to': new_label,
                'categories': {
                    key: {
                        'added': value['added'],
                        'removed': value['removed'],
                        'changed': {
                            eid: {k: [format_value(o), format_value(n)] for k, (o, n) in changes.items()}
                            for eid, changes in value['changed'].items()
                        },
                        'old_count': value['old_count'],
                        'new_count': value['new_count'],
                    }
                    for key, value in results.items()
                },
            },
            ensure_ascii=False,
            indent=2,
        )

    lines = [f'# {old_label} -> {new_label}'] if fmt == 'md' else [f'{old_label} -> {new_label}']
    totals = {'added': 0, 'removed': 0, 'changed': 0}
    for key, value in results.items():
        if not (value['added'] or value['removed'] or value['changed']):
            continue
        for name in totals:
            totals[name] += len(value[name])
        lines.append(f'## {key} ({value["old_count"]} -> {value["new_count"]})')
        for eid in value['added']:
            lines.append(f'+ {eid}')
        for eid in value['removed']:
            lines.append(f'- {eid}')
        for eid, changes in value['changed'].items():
            detail = '; '.join(
                f'{path}: {format_value(o)} -> {format_value(n)}' for path, (o, n) in changes.items()
            )
            lines.append(f'~ {eid}: {detail}')
    lines.append(f'summary: +{totals["added"]} -{totals["removed"]} ~{totals["changed"]}')
    return '\n'.join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mod', default='fgo')
    parser.add_argument('refs', nargs='+', help='one/two git refs or directories')
    parser.add_argument('--format', choices=('text', 'md', 'json'), default='text')
    parser.add_argument('-o', '--output')
    args = parser.parse_args()

    cfg = ModConfig.load(args.mod)
    tmp = Path(tempfile.mkdtemp())
    try:
        if len(args.refs) == 1:
            old = from_git(args.refs[0], cfg, tmp)
            new = cfg.target
            old_label, new_label = args.refs[0], 'current'
        elif len(args.refs) == 2:
            a, b = (Path(x) for x in args.refs)
            if a.is_dir() and b.is_dir():
                old, new = a, b
            else:
                old = from_git(args.refs[0], cfg, tmp)
                new = from_git(args.refs[1], cfg, tmp)
            old_label, new_label = args.refs
        else:
            raise SystemExit('expected one or two refs')

        results = {}
        for kind, spec in cfg.categories.items():
            name = spec['data']
            old_rows, new_rows = load_rows(old / name), load_rows(new / name)
            if old_rows or new_rows:
                results[kind] = diff_category(old_rows, new_rows)

        output = render(results, args.format, cfg.id, old_label, new_label)
        if args.output:
            Path(args.output).write_text(output + '\n', encoding='utf-8')
            print(f'wrote {args.output}')
        else:
            print(output)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
