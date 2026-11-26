#!/usr/bin/env python3
import argparse
import hashlib
import io
import json
import os
import re
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
VANILLA = ROOT / 'static/mods/sts2'
FGO_BUNDLE = ROOT / 'generated/mods/fgo/bundle.json'
FGO_ASSETS = ROOT / 'static/imported/fgo'


def sha256(data: bytes) -> str:
	return hashlib.sha256(data).hexdigest()


def webp_name(name: str) -> str:
	return name[:-4] + '.webp' if name.lower().endswith('.png') else name


def to_webp(source: Path, quality: int) -> bytes:
	with Image.open(source) as image:
		image.load()
		output = io.BytesIO()
		image.convert('RGBA').save(output, 'WEBP', quality=quality, method=1)
		return output.getvalue()


def content_digest(bundle: dict) -> str:
	raw = json.dumps(bundle, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
	result = subprocess.run(
		['node', str(ROOT / 'scripts/validate-import.mjs'), '--digest'],
		input=raw,
		text=True,
		capture_output=True,
		cwd=ROOT,
		encoding='utf-8'
	)
	if result.returncode != 0:
		raise RuntimeError(result.stderr.strip() or 'digest failed')
	return result.stdout.strip()


def convert_vanilla(quality: int) -> tuple[int, int]:
	# Existing WebP files also map their PNG names, so a rerun repairs references
	# left behind by an earlier conversion instead of requiring new PNG sources.
	mapping = {
		f'{relative[:-len(".webp")]}.png': relative
		for relative in (path.relative_to(VANILLA).as_posix() for path in VANILLA.rglob('*.webp'))
	}
	before = after = 0
	converted = 0
	for source in sorted(VANILLA.rglob('*')):
		if not source.is_file() or source.suffix.lower() != '.png':
			continue
		relative = source.relative_to(VANILLA).as_posix()
		target = source.with_suffix('.webp')
		before += source.stat().st_size
		if target.exists():
			after += target.stat().st_size
			source.unlink()
		else:
			data = to_webp(source, quality)
			after += len(data)
			target.write_bytes(data)
			source.unlink()
		mapping[relative] = webp_name(relative)
		converted += 1
		if converted % 200 == 0:
			print(f'vanilla converted {converted}', flush=True)

	pattern = re.compile(r'"([^"\\]+\.png)"')

	def replace(match: re.Match[str]) -> str:
		value = match.group(1)
		# Site-level art under `/images/` is not part of the mod asset tree, so only
		# mod-relative and mod-prefixed references are rewritten.
		if value.startswith('/mods/sts2/'):
			prefix = '/mods/sts2/'
			relative = value[len(prefix):]
		elif value.startswith('images/'):
			prefix = ''
			relative = value
		else:
			return match.group(0)
		updated = mapping.get(relative)
		return f'"{prefix}{updated}"' if updated else match.group(0)

	for filename in VANILLA.rglob('*.json'):
		original = filename.read_text(encoding='utf-8')
		updated = pattern.sub(replace, original)
		if updated != original:
			filename.write_text(updated, encoding='utf-8')

	return converted, before - after


def convert_fgo(quality: int, trash_dir: Path) -> tuple[int, int]:
	bundle = json.loads(FGO_BUNDLE.read_text(encoding='utf-8'))
	base = bundle['assetBase']

	png_names = [name for name in bundle['assets'] if name.lower().endswith('.png')]
	converted = {}
	before = after = 0
	for index, (name, meta) in enumerate(bundle['assets'].items(), 1):
		source = FGO_ASSETS / name
		target_name = webp_name(name)
		existing = FGO_ASSETS / target_name
		if not source.is_file():
			if not existing.is_file():
				raise FileNotFoundError(source)
			data = existing.read_bytes()
		elif existing.is_file() and source.stat().st_mtime <= existing.stat().st_mtime:
			data = existing.read_bytes()
		else:
			data = to_webp(source, quality) if name.lower().endswith('.png') else source.read_bytes()
			before += source.stat().st_size
			after += len(data)
		converted[target_name] = (data, meta)
		if index % 100 == 0:
			print(f'converted {index}/{len(bundle["assets"])}', flush=True)

	for name, (data, _) in converted.items():
		target = FGO_ASSETS / name
		if target.is_file() and target.read_bytes() == data:
			continue
		target.parent.mkdir(parents=True, exist_ok=True)
		target.write_bytes(data)

	def rewrite(value):
		if isinstance(value, str) and value.startswith(base) and value.lower().endswith('.png'):
			return value[:-4] + '.webp'
		if isinstance(value, list):
			return [rewrite(item) for item in value]
		if isinstance(value, dict):
			return {key: rewrite(item) for key, item in value.items()}
		return value

	bundle = rewrite(bundle)
	bundle['assets'] = {name: {**meta, 'sha256': sha256(data)}
	                    for name, (data, meta) in converted.items()}
	bundle.pop('contentSha256', None)
	bundle['contentSha256'] = content_digest(bundle)
	FGO_BUNDLE.write_text(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

	for name in png_names:
		source = FGO_ASSETS / name
		if not source.exists():
			continue
		target = trash_dir / source.relative_to(FGO_ASSETS)
		target.parent.mkdir(parents=True, exist_ok=True)
		os.replace(source, target)

	return len(converted), before - after


def main() -> None:
	parser = argparse.ArgumentParser(description='Convert mod PNG assets to WebP')
	parser.add_argument('--quality', type=int, default=90)
	parser.add_argument('--trash-dir', type=Path, default=ROOT.parent / '.sts2-mod-wiki-png-archive')
	args = parser.parse_args()

	vanilla_count, vanilla_saving = convert_vanilla(args.quality)
	fgo_count, fgo_saving = convert_fgo(args.quality, args.trash_dir)
	print(f'vanilla: {vanilla_count} files, saved {vanilla_saving / 1048576:.1f} MB')
	print(f'fgo: {fgo_count} files, saved {fgo_saving / 1048576:.1f} MB')


if __name__ == '__main__':
	main()
