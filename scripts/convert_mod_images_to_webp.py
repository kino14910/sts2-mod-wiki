#!/usr/bin/env python3
import argparse
import hashlib
import io
import json
import re
import shutil
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
	mapping = {}
	before = after = 0
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
		if len(mapping) % 200 == 0:
			print(f'vanilla converted {len(mapping)}', flush=True)

	pattern = re.compile(r'"([^"\\]+\.png)"')

	def replace(match: re.Match[str]) -> str:
		value = match.group(1)
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

	return len(mapping), before - after


def convert_fgo(quality: int) -> tuple[int, int, str, str]:
	bundle = json.loads(FGO_BUNDLE.read_text(encoding='utf-8'))
	old_fingerprint = bundle['fingerprint']
	old_base = bundle['assetBase']
	source_root = FGO_ASSETS / old_fingerprint

	converted = {}
	before = after = 0
	for name, meta in bundle['assets'].items():
		source = source_root / name
		if not source.is_file():
			raise FileNotFoundError(source)
		data = to_webp(source, quality) if name.lower().endswith('.png') else source.read_bytes()
		target_name = webp_name(name)
		converted[target_name] = (data, meta)
		before += source.stat().st_size
		after += len(data)

	payload = {
		'source': old_fingerprint,
		'quality': quality,
		'assets': {name: sha256(data) for name, (data, _) in converted.items()}
	}
	fingerprint = sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8'))
	new_base = f'/imported/fgo/{fingerprint}/'
	target_root = FGO_ASSETS / fingerprint

	for name, (data, _) in converted.items():
		target = target_root / name
		if target.exists() and sha256(target.read_bytes()) != sha256(data):
			raise RuntimeError(f'Conflicting WebP asset: {target}')
		target.parent.mkdir(parents=True, exist_ok=True)
		if not target.exists():
			target.write_bytes(data)

	def rewrite(value):
		if isinstance(value, str):
			if value == old_base:
				return new_base
			if value.startswith(old_base):
				return new_base + webp_name(value[len(old_base):])
			return value
		if isinstance(value, list):
			return [rewrite(item) for item in value]
		if isinstance(value, dict):
			return {key: rewrite(item) for key, item in value.items()}
		return value

	bundle = rewrite(bundle)
	bundle['assets'] = {
		name: {**meta, 'sha256': sha256(data)}
		for name, (data, meta) in converted.items()
	}
	bundle['fingerprint'] = fingerprint
	bundle['assetBase'] = new_base
	bundle.pop('contentSha256', None)
	bundle['contentSha256'] = content_digest(bundle)
	FGO_BUNDLE.write_text(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

	if target_root.resolve() != source_root.resolve():
		shutil.rmtree(source_root)

	return len(converted), before - after, old_fingerprint, fingerprint


def main() -> None:
	parser = argparse.ArgumentParser(description='Convert mod PNG assets to WebP')
	parser.add_argument('--quality', type=int, default=90)
	args = parser.parse_args()

	vanilla_count, vanilla_saving = convert_vanilla(args.quality)
	fgo_count, fgo_saving, old_fingerprint, fingerprint = convert_fgo(args.quality)
	print(f'vanilla: {vanilla_count} files, saved {vanilla_saving / 1048576:.1f} MB')
	print(f'fgo: {fgo_count} files, saved {fgo_saving / 1048576:.1f} MB, {old_fingerprint} -> {fingerprint}')


if __name__ == '__main__':
	main()
