"""Copy mod art, bake WebP thumbnails, index entity images, write manifest.json.

Adapts spire-codex's copy_images.py and build_image_manifest.py to the wiki's
static/mods/<id> layout.
"""

from __future__ import annotations

import json
import shutil

from PIL import Image, features

from config import ModConfig, asset_key

IMAGE_SUFFIXES = {'.png', '.webp', '.svg'}
SKIP_DIRS = {'.godot', '.import', 'node_modules'}
THUMB_QUALITY = 80
THUMB_METHOD = 6


def copy_images(cfg: ModConfig) -> dict:
    source = cfg.paths['images']
    dest = cfg.target / 'images'
    dest.mkdir(parents=True, exist_ok=True)
    copied = 0
    skipped = 0
    for path in sorted(source.rglob('*')):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(source).parts):
            skipped += 1
            continue
        if path.suffix.lower() not in IMAGE_SUFFIXES:
            skipped += 1
            continue
        target = dest / path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.stat().st_mtime < path.stat().st_mtime:
            shutil.copy2(path, target)
            copied += 1
    return {'copied': copied, 'skipped': skipped, 'dest': dest}


def bake_thumbs(cfg: ModConfig) -> dict:
    if not features.check('webp'):
        return {'written': 0, 'skipped': 0, 'reason': 'Pillow without WebP support'}
    cards_dir = cfg.target / 'images' / 'cards'
    if not cards_dir.is_dir():
        return {'written': 0, 'skipped': 0}
    written = 0
    skipped = 0
    for source in sorted(cards_dir.rglob('*.png')):
        target = source.with_suffix('.webp')
        if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
            skipped += 1
            continue
        with Image.open(source) as opened:
            image = opened.convert(
                'RGBA' if 'A' in opened.getbands() or 'transparency' in opened.info else 'RGB'
            )
            width, height = image.size
            if width > cfg.thumb_width:
                image = image.resize(
                    (cfg.thumb_width, round(height * cfg.thumb_width / width)),
                    Image.Resampling.LANCZOS,
                )
            image.save(target, 'WEBP', quality=THUMB_QUALITY, method=THUMB_METHOD)
        written += 1
    return {'written': written, 'skipped': skipped}


def build_index(cfg: ModConfig) -> dict[str, dict[str, str]]:
    index: dict[str, dict[str, str]] = {}
    for kind in ('cards', 'powers', 'relics', 'potions'):
        if kind not in cfg.assets:
            continue
        root = cfg.target / cfg.assets[kind]
        if not root.is_dir():
            index[kind] = {}
            continue
        entries: dict[str, str] = {}
        candidates = sorted(
            (p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in {'.png', '.webp'}),
            key=lambda p: (p.suffix.lower() != '.png', '/beta/' in p.as_posix(), len(p.parts), p.name),
        )
        for path in candidates:
            key = asset_key(path.stem)
            if not key or key in entries:
                continue
            entries[key] = path.relative_to(cfg.target).as_posix()
        index[kind] = entries
    return index


def build_manifest(cfg: ModConfig) -> dict:
    meta = {}
    if cfg.mod_json and cfg.mod_json.exists():
        meta = json.loads(cfg.mod_json.read_text(encoding='utf-8'))
    manifest = {
        'id': cfg.id,
        'name': meta.get('name', cfg.id),
        'author': meta.get('author', ''),
        'blurb': meta.get('description', ''),
        'dependency': cfg.dependency,
    }
    if meta.get('version'):
        manifest['version'] = meta['version']
    for kind, spec in cfg.categories.items():
        manifest[kind] = spec['data']
    if cfg.card_rarities:
        manifest['cardRarities'] = cfg.card_rarities
    cfg.target.mkdir(parents=True, exist_ok=True)
    (cfg.target / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent='\t') + '\n',
        encoding='utf-8',
    )
    return manifest
