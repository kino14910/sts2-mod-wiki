#!/usr/bin/env python3
import os
import sys
from pathlib import Path

from PIL import Image, features

ROOT = Path(__file__).resolve().parent.parent / 'static' / 'mods'
TARGET_WIDTH = int(os.environ.get('CARD_THUMB_WIDTH', '250'))
QUALITY = 80
METHOD = 6
FORCE = '--force' in sys.argv

if not features.check('webp'):
    raise SystemExit('Pillow was built without WebP support')

sources = sorted(ROOT.glob('*/images/cards/**/*.png'))
written = 0
skipped = 0
source_bytes = 0
thumb_bytes = 0

for source in sources:
    target = source.with_suffix('.webp')
    source_bytes += source.stat().st_size
    if target.exists() and not FORCE and target.stat().st_mtime >= source.stat().st_mtime:
        skipped += 1
        thumb_bytes += target.stat().st_size
        continue

    with Image.open(source) as opened:
        image = opened.convert('RGBA' if 'A' in opened.getbands() or 'transparency' in opened.info else 'RGB')
        width, height = image.size
        if width > TARGET_WIDTH:
            image = image.resize((TARGET_WIDTH, round(height * TARGET_WIDTH / width)), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=QUALITY, method=METHOD)

    written += 1
    thumb_bytes += target.stat().st_size

print(f'width={TARGET_WIDTH}px sources={len(sources)} written={written} skipped={skipped}')
print(f'png={source_bytes / 1024 / 1024:.2f}MiB webp={thumb_bytes / 1024 / 1024:.2f}MiB')
