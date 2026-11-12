"""Fingerprint a mod's source tree for upstream-change tracking.

Adapted from spire-codex's tools/extraction_manifest.py: instead of GDRE/ILSpy
output trees, this walks the mod source (C#, localization, art) and records
relative path -> [size, blake2b-128] so two snapshots can be diffed.

Usage:
  python scripts/mod-extract/extraction_manifest.py --mod fgo generate \
      --label v0.9.0 -o extraction-manifests/fgo/v0.9.0.json.gz
  python scripts/mod-extract/extraction_manifest.py --mod fgo diff old.json.gz new.json.gz
  python scripts/mod-extract/extraction_manifest.py --mod fgo grep Charisma *.json.gz
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from config import ModConfig

EXCLUDED_PARTS = {
    '.git', '.godot', '.idea', '.workbuddy', '.claude', '.probe_ritsu',
    'bin', 'obj', 'node_modules', 'telemetry', 'tools', '.awb',
}
EXCLUDED_SUFFIXES = {'.uid', '.import', '.md5', '.ctex', '.cache', '.tmp', '.TMP', '.pdb', '.dll'}
INCLUDED_SUFFIXES = {'.cs', '.json', '.png', '.webp', '.tres', '.gdshader', '.tscn', '.scn', '.cfg'}


def iter_files(cfg: ModConfig):
    for path in sorted(cfg.source.rglob('*')):
        if not path.is_file():
            continue
        rel = path.relative_to(cfg.source)
        if any(part in EXCLUDED_PARTS for part in rel.parts):
            continue
        if path.suffix in EXCLUDED_SUFFIXES or path.suffix.lower() not in INCLUDED_SUFFIXES:
            continue
        yield rel.as_posix(), path


def hash_file(path: Path) -> str:
    digest = hashlib.blake2b(digest_size=16)
    if path.suffix in ('.cs', '.json', '.cfg', '.tres', '.gdshader'):
        digest.update(path.read_bytes().replace(b'\r\n', b'\n'))
        return digest.hexdigest()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def load(path: Path) -> dict:
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rt', encoding='utf-8') as handle:
        return json.load(handle)


def generate(cfg: ModConfig, args) -> None:
    files = {rel: [path.stat().st_size, hash_file(path)] for rel, path in iter_files(cfg)}
    manifest = {
        'mod': cfg.id,
        'label': args.label,
        'generated': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'source': str(cfg.source),
        'file_count': len(files),
        'files': files,
    }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(manifest, sort_keys=True, separators=(',', ':'))
    if out.suffix == '.gz':
        with gzip.open(out, 'wt', encoding='utf-8', compresslevel=9) as handle:
            handle.write(payload)
    else:
        out.write_text(payload, encoding='utf-8')
    print(f'{args.label}: {len(files)} files -> {out}')


def diff(args) -> None:
    old, new = load(Path(args.old)), load(Path(args.new))
    of, nf = old['files'], new['files']
    added = sorted(k for k in nf if k not in of)
    removed = sorted(k for k in of if k not in nf)
    changed = sorted(k for k in nf if k in of and of[k][1] != nf[k][1])
    print(f"{old['label']} -> {new['label']}: +{len(added)} -{len(removed)} ~{len(changed)}")
    for tag, items in (('+', added), ('-', removed), ('~', changed)):
        for key in items[: args.limit]:
            print(f'  {tag} {key}')
        if len(items) > args.limit:
            print(f'  ... {len(items) - args.limit} more {tag}')


def grep(args) -> None:
    needle = args.pattern.lower()
    for name in args.manifests:
        manifest = load(Path(name))
        hits = [k for k in manifest['files'] if needle in k.lower()]
        print(f"{manifest['label']}: {len(hits)} match(es)")
        for key in hits[: args.limit]:
            print(f'    {key}  [{manifest["files"][key][1][:12]}]')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mod', default='fgo')
    sub = parser.add_subparsers(dest='cmd', required=True)

    gen = sub.add_parser('generate')
    gen.add_argument('--label', default='snapshot')
    gen.add_argument('-o', '--output', required=True)
    gen.set_defaults(func=lambda cfg, args: generate(cfg, args))

    difference = sub.add_parser('diff')
    difference.add_argument('old')
    difference.add_argument('new')
    difference.add_argument('--limit', type=int, default=50)
    difference.set_defaults(func=lambda cfg, args: diff(args))

    search = sub.add_parser('grep')
    search.add_argument('pattern')
    search.add_argument('manifests', nargs='+')
    search.add_argument('--limit', type=int, default=20)
    search.set_defaults(func=lambda cfg, args: grep(args))

    args = parser.parse_args()
    cfg = ModConfig.load(args.mod)
    args.func(cfg, args)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
