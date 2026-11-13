"""Import a built mod: DLL/PCK -> parsed evidence -> normalized bundle -> site.

Does not execute assembly code, consult the source tree, or write community data.
Only the final bundle pointer is replaced after all validation succeeds.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

from config import ModConfig, PROJECT_ROOT, asset_key
from pck import Pack, decode_texture, safe_path

SCHEMA_VERSION = 1
KINDS = ('cards', 'relics', 'potions', 'powers', 'characters')
# Runtime dependencies of validate-import.mjs, including the shared schema's
# enum/key helpers and the imported adapter's icon helpers. Keep new imports here.
CONTRACT_FILES = (
    'scripts/validate-import.mjs', 'scripts/imported-mods.ts', 'scripts/mod-icons.ts',
    'src/lib/data/mod-schema.ts', 'src/lib/data/cards.ts', 'src/lib/data/collections.ts',
    'src/lib/data/mod-dependency.ts', 'src/lib/data/entry-id.ts', 'src/lib/data/icon-assets.ts',
    'src/lib/entity-identity.ts',
)


def digest(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def bundle_digest(bundle):
    """Node is the only authority for JSON canonicalization and numeric limits."""
    return run_bundle_validator('--digest', payload=json.dumps(bundle, ensure_ascii=False, allow_nan=False)).strip()


def contract_hashes(root=PROJECT_ROOT):
    return {name: digest(root / name) for name in CONTRACT_FILES}


def source_snapshot(inputs, references, presentation_file, parser_config, tool_versions):
    return {
        'artifacts': {ext: {'path': str(path), 'sha256': digest(path)} for ext, path in inputs.items()},
        'references': {str(p): digest(p) for folder in references for p in sorted(folder.glob('*.dll'))},
        'importer': {p.name: digest(p) for p in sorted(Path(__file__).parent.glob('*.py'))
                     if not p.name.startswith('test_')},
        'contract': contract_hashes(), 'tools': tool_versions,
        'config': digest(presentation_file), 'parserConfig': digest(parser_config),
    }


def verify_source_unchanged(source, inputs, references, presentation_file, parser_config):
    try:
        current = source_snapshot(inputs, references, presentation_file, parser_config, source['tools'])
    except OSError as exc:
        raise ValueError('Import inputs changed during processing; keeping the previous bundle') from exc
    changed = [key for key in source if source[key] != current.get(key)]
    if changed:
        raise ValueError(f'Import inputs changed during processing ({", ".join(changed)}); keeping the previous bundle')


def publish_bundle(bundle, output, inputs, references, presentation_file, parser_config,
                   *, staged_public_root, public_root=None):
    """Validate privately, publish assets, then atomically switch the bundle pointer.

    A fingerprint's published content is immutable. Repairs must reproduce its
    verified manifest, and are rolled back if final validation/publication fails.
    """
    fingerprint = bundle['fingerprint']
    public_root = public_root or PROJECT_ROOT / 'static'
    relative = bundle['assetBase'].lstrip('/')
    staged_assets = staged_public_root / relative
    public_assets = public_root / relative
    if staged_assets.resolve() == public_assets.resolve():
        raise ValueError('Resource staging must be separate from published assets')
    staged_assets.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    lock = output / '.publish.lock'
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise ValueError(f'Another import is publishing; publication lock: {lock}') from exc
    os.close(descriptor)
    try:
        with tempfile.TemporaryDirectory(prefix='.publish-', dir=output, ignore_cleanup_errors=True) as directory:
            transaction = Path(directory)
            candidate = transaction / 'bundle.json'
            write_json(candidate, bundle)
            run_bundle_validator(candidate, staged_public_root, presentation_file)
            snapshot = output / 'snapshots' / f'{fingerprint}.json'
            current = output / 'bundle.json'
            verified_previous = False
            # Never overwrite a historical snapshot or reinterpret the same URLs.
            for previous_file in (snapshot, current):
                if not previous_file.is_file():
                    continue
                previous = json.loads(previous_file.read_text(encoding='utf-8'))
                if previous.get('fingerprint') != fingerprint:
                    continue
                previous_digest = bundle_digest(previous)
                if (previous.get('contentSha256') != previous_digest or
                        previous_digest != bundle['contentSha256']):
                    raise ValueError('Existing fingerprint has different bundle content; keeping published assets')
                verified_previous = True
            repairs = []
            if public_assets.exists():
                for name, asset in bundle['assets'].items():
                    target = public_assets / safe_path(name)
                    if not target.is_file() or digest(target) != asset['sha256']:
                        repairs.append(name)
                if repairs and not verified_previous:
                    raise ValueError('Cannot repair existing assets without a matching verified published bundle')
            # All fallible preparation precedes writes to public resources.
            snapshot_candidate = transaction / 'snapshot.json'
            if not snapshot.exists():
                write_json(snapshot_candidate, bundle)
            public_assets.parent.mkdir(parents=True, exist_ok=True)
            verify_source_unchanged(bundle['source'], inputs, references, presentation_file, parser_config)
            installed = False
            replaced = []
            snapshot_created = False
            try:
                if not public_assets.exists():
                    os.replace(staged_assets, public_assets)
                    installed = True
                else:
                    # Healthy files are never rewritten. Each repair is atomic;
                    # retain the exact corrupt bytes (or absence) for rollback.
                    for name in repairs:
                        target = public_assets / safe_path(name)
                        backup = transaction / 'rollback' / name
                        existed = target.exists()
                        if existed:
                            backup.parent.mkdir(parents=True, exist_ok=True)
                            shutil.copyfile(target, backup)
                        target.parent.mkdir(parents=True, exist_ok=True)
                        os.replace(staged_assets / name, target)
                        replaced.append((target, backup if existed else None))
                # Explicitly verify the real served tree, including repairs, and
                # recheck inputs after validation before switching the pointer.
                validated = run_bundle_validator(candidate, public_root, presentation_file)
                verify_source_unchanged(bundle['source'], inputs, references, presentation_file, parser_config)
                if snapshot_candidate.exists():
                    snapshot.parent.mkdir(parents=True, exist_ok=True)
                    os.replace(snapshot_candidate, snapshot)
                    snapshot_created = True
                os.replace(candidate, current)
            except BaseException:
                if snapshot_created:
                    snapshot.unlink()
                for target, backup in reversed(replaced):
                    if backup is None:
                        target.unlink()
                    else:
                        os.replace(backup, target)
                if installed:
                    os.replace(public_assets, staged_assets)
                raise
            return validated
    finally:
        lock.unlink(missing_ok=True)


def run_bundle_validator(*args, payload=None):
    result = subprocess.run(
        ['node', '--experimental-strip-types', str(PROJECT_ROOT / 'scripts' / 'validate-import.mjs'),
         *map(str, args)], input=payload, check=False, capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise ValueError(f'Bundle validation failed:\n{result.stderr or result.stdout}')
    return result.stdout


def cached_bundle_valid(current, fingerprint, presentation_file, public_root=None):
    if not current.is_file():
        return False
    try:
        previous = json.loads(current.read_text(encoding='utf-8'))
        if previous.get('fingerprint') != fingerprint:
            return False
        # A matching input hash never substitutes for today's schema, checksum,
        # configuration and on-disk resource checks. Invalid caches are rebuilt.
        run_bundle_validator(current, public_root or PROJECT_ROOT / 'static', presentation_file)
    except (ValueError, OSError) as exc:
        print(f'Cached bundle rejected; rebuilding: {exc}')
        return False
    return True


def thumbnails(cards, assets, public):
    from PIL import Image
    result = {}
    for row in cards:
        source = row.get('image')
        if not source:
            continue
        target = f'images/thumbnails/{safe_path(row["id"])}.webp'
        destination = public / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(public / source) as image:
            image.thumbnail((250, 350))
            image.save(destination, 'WEBP', quality=82, method=4)
        assets[target] = {'resource': assets[source]['resource'], 'sha256': digest(destination), 'derivedFrom': source}
        result[row['id']] = target
    return result


def extract_resources(pack: Pack, resource_root: str, parsed: Path, public: Path):
    locales, assets = {}, {}
    prefix = safe_path(resource_root).rstrip('/') + '/'
    for name in sorted(pack.entries):
        if not name.startswith(prefix):
            continue
        relative = name[len(prefix):]
        if relative.startswith('localization/') and relative.endswith('.json'):
            data = json.loads(pack.read(name).decode('utf-8-sig').rstrip('\0'))
            if not isinstance(data, dict) or any(not isinstance(v, str) for v in data.values()):
                raise ValueError(f'Expected flat localization table: {name}')
            write_json(parsed / relative, data)
            locales[relative] = data
        elif relative.startswith('images/'):
            if relative.endswith('.import'):
                remap = pack.read(name).decode('utf-8').rstrip('\0')
                match = re.search(r'^path="(res://[^"\n]+\.ctex)"', remap, re.M)
                if not match:
                    raise ValueError(f'Unsupported texture remap: {name}')
                resource = match.group(1)
                original = relative.removesuffix('.import')
                output = original if original.endswith('.png') else original + '.png'
                data = decode_texture(pack.read(resource))
            elif relative.endswith(('.png', '.webp', '.svg')):
                resource, output, data = name, relative, pack.read(name)
            else:
                continue
            if output in assets:
                raise ValueError(f'Duplicate exported asset: {output}')
            target = public / safe_path(output)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            assets[output] = {'resource': resource, 'sha256': hashlib.sha256(data).hexdigest()}
    if not locales:
        raise ValueError(f'No localization found under {prefix}')
    return locales, assets


def assets_to_urls(value, assets, prefix):
    """Resolve PCK asset paths without dropping display labels or empty frames."""
    if isinstance(value, dict):
        return {key: assets_to_urls(item, assets, prefix) for key, item in value.items()}
    if isinstance(value, list):
        return [assets_to_urls(item, assets, prefix) for item in value]
    if isinstance(value, str) and value.startswith('images/'):
        if value not in assets:
            raise ValueError(f'Presentation references missing asset: {value}')
        return prefix + value
    return value


def image_index(assets):
    result = {}
    for kind in ('cards', 'powers', 'relics', 'potions'):
        result[kind] = {}
        paths = sorted((p for p in assets if p.startswith(f'images/{kind}/')),
                       key=lambda p: ('/beta/' in p, '/big/' not in p, len(p.split('/')), p))
        for path in paths:
            result[kind].setdefault(asset_key(Path(path).stem), path)
    return result


def resolve_localization(catalog, locales, game_pack, cfg, diagnostics):
    """Materialize verified text aliases; preserve unavailable models in the catalog."""
    from config import entry_id
    data = {kind: [] for kind in catalog}
    quarantined = []
    game_tables = {}
    original_tables = copy.deepcopy(locales)
    singular = {'cards': 'card', 'powers': 'power', 'relics': 'relic', 'potions': 'potion'}
    for kind, rows in catalog.items():
        for row in rows:
            if kind not in singular:
                data[kind].append(row)
                continue
            canonical_id = entry_id(cfg.dependency, singular[kind], row['id'])
            refs = row.get('localizationRefs', {field: {'table': kind, 'key': f'{canonical_id}.{field}'} for field in ('title', 'description')})
            missing = []
            resolved = {}
            for lang in cfg.languages:
                resolved[lang] = {}
                for field, ref in refs.items():
                    filename = f'localization/{lang}/{ref["table"]}.json'
                    table = original_tables.get(filename, {})
                    text = table.get(ref['key'])
                    if text is None and ref.get('external'):
                        if filename not in game_tables:
                            game_tables[filename] = json.loads(game_pack.read(filename).decode('utf-8-sig').rstrip('\0')) if filename in game_pack.entries else {}
                        text = game_tables[filename].get(ref['key'])
                    if text is None:
                        if lang == cfg.base_language:
                            missing.append(field)
                        continue
                    if ref['key'] != f'{canonical_id}.{field}':
                        resolved[lang][f'{canonical_id}.{field}'] = text
            if missing:
                quarantined.append({'kind': kind, 'id': row['id'], 'reason': 'missing-localization', 'fields': missing})
                diagnostics.append({'severity': 'warning', 'code': 'quarantined-model', 'entity': row['id'],
                                    'message': 'Preserved in catalog but not published: unavailable base text ' + ', '.join(missing)})
                continue
            for lang, aliases in resolved.items():
                if aliases:
                    # A Title/Description override can intentionally ignore an
                    # obsolete canonical translation still shipped in the PCK.
                    # Keep that original in sourceLocalization, project only the
                    # code-selected value into the runtime table.
                    for filename, table in locales.items():
                        if filename.startswith(f'localization/{lang}/'):
                            for key in aliases:
                                if key in table:
                                    if table[key] != aliases[key]:
                                        diagnostics.append({'severity': 'info', 'code': 'localization-override',
                                                            'entity': row['id'], 'message': f'{lang}/{key} selects inherited text'})
                                    del table[key]
                    locales.setdefault(f'localization/{lang}/resolved-models.json', {}).update(aliases)
            data[kind].append(row)
    return data, quarantined, game_tables


def resolve_relations(catalog, cfg, game_types, mod_pack, game_pack, diagnostics):
    singular = {'cards': 'card', 'powers': 'power', 'relics': 'relic', 'potions': 'potion', 'characters': 'character'}
    local = {(singular[kind], row['id']) for kind, rows in catalog.items() for row in rows}
    for kind, rows in catalog.items():
        for row in rows:
            row['namespace'] = cfg.id
            row['entityKey'] = f'{cfg.id}:{singular[kind]}:{row["id"]}'
            for ref in row.get('refs', []):
                key = (ref['kind'], ref['id'])
                if key in local:
                    ref['namespace'], ref['resolved'] = cfg.id, True
                elif key in game_types:
                    ref['namespace'], ref['resolved'] = 'sts2', True
                    ref['qualifiedType'] = game_types[key]
                else:
                    ref['resolved'] = False
                    diagnostics.append({'severity': 'warning', 'code': 'unresolved-reference', 'entity': row['id'],
                                        'message': f'Unresolved {ref["kind"]} model {ref["id"]}'})
            row['resources'] = []
            for resource in row.get('resourceRefs', []):
                name = resource.removeprefix('res://')
                resolved = None
                for source_pack in (mod_pack, game_pack):
                    if name in source_pack.entries:
                        resolved = name
                        break
                    for suffix in ('.import', '.remap'):
                        if name + suffix in source_pack.entries:
                            text = source_pack.read(name + suffix).decode('utf-8').rstrip('\0')
                            match = re.search(r'^path="res://([^"\n]+)"', text, re.M)
                            if match and match.group(1) in source_pack.entries:
                                resolved = match.group(1)
                                break
                    if resolved:
                        break
                row['resources'].append({'path': resource, 'available': resolved is not None, 'resolvedPath': resolved})


def validate(categories, locales, assets, cfg):
    from config import entry_id
    if not categories.get('cards'):
        raise ValueError('Assembly did not produce any cards')
    tables = {}
    for path, table in locales.items():
        locale = path.split('/')[1]
        merged = tables.setdefault(locale, {})
        for key, value in table.items():
            if key in merged and merged[key] != value:
                raise ValueError(f'Conflicting localization key: {locale}/{key}')
            merged[key] = value
    singular = {'cards': 'card', 'relics': 'relic', 'potions': 'potion', 'powers': 'power'}
    for kind, rows in categories.items():
        seen = set()
        for row in rows:
            ident = row['id']
            if ident in seen:
                raise ValueError(f'Duplicate entity: {kind}/{ident}')
            seen.add(ident)
            for field in ('image', 'icon'):
                if row.get(field) and row[field] not in assets:
                    raise ValueError(f'Missing resource: {kind}/{ident}/{row[field]}')
            if kind in singular:
                key = entry_id(cfg.dependency, singular[kind], ident)
                for field in ('title', 'description'):
                    if f'{key}.{field}' not in tables.get(cfg.base_language, {}):
                        raise ValueError(f'Missing base localization: {key}.{field}')
            if kind == 'cards':
                if row.get('type') not in cfg.enums['card_type']:
                    raise ValueError(f'Unknown card type: {ident}')
                if row.get('rarity') not in cfg.enums['card_rarity'] and row.get('rarity') not in cfg.card_rarities:
                    raise ValueError(f'Unknown card rarity: {ident}')
                if not isinstance(row.get('cost'), (int, float)) and row.get('cost') not in ('X', None):
                    raise ValueError(f'Invalid cost: {ident}')
    return tables


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mod', default='fgo')
    parser.add_argument('--build', default='D:/Steam/steamapps/common/Slay the Spire 2/mods/Fgo')
    parser.add_argument('--reference', action='append', default=[])
    parser.add_argument('--ilspy', default='ilspycmd')
    parser.add_argument('--game-pack', help='Game PCK for inherited localization (default: beside mods/)')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    parser_config = Path(__file__).parent / 'mods' / f'{args.mod}.json'
    parser_config_hash = digest(parser_config)
    cfg = ModConfig.load(args.mod)
    build = Path(args.build).resolve()
    presentation_file = PROJECT_ROOT / 'content' / 'mods' / f'{cfg.id}.json'
    presentation_hash = digest(presentation_file)
    presentation = json.loads(presentation_file.read_text(encoding='utf-8'))
    assembly_name = presentation['assembly']
    inputs = {suffix: build / f'{assembly_name}.{suffix}' for suffix in ('dll', 'pck', 'json')}
    for path in inputs.values():
        if not path.is_file():
            raise ValueError(f'Missing build artifact: {path}')
    metadata_bytes = inputs['json'].read_bytes()
    metadata = json.loads(metadata_bytes.decode('utf-8-sig'))
    game_pack_path = Path(args.game_pack).resolve() if args.game_pack else build.parent.parent / 'SlayTheSpire2.pck'
    if not game_pack_path.is_file():
        raise ValueError(f'Missing game resource pack: {game_pack_path}')
    inputs['gamePck'] = game_pack_path
    references = [Path(p).resolve() for p in args.reference]
    if not references:
        game = build.parent.parent
        ritsu = build.parent / 'STS2-RitsuLib'
        references = [game / 'data_sts2_windows_x86_64']
        if cfg.dependency['type'] == 'ritsulib':
            compat = ritsu / 'compat'
            if compat.is_dir():
                variants = sorted(p for p in compat.iterdir() if p.is_dir())
                exact = compat / str(metadata.get('min_game_version', ''))
                selected = exact if exact in variants else variants[0] if len(variants) == 1 else None
                if selected is None:
                    raise ValueError('Ambiguous RitsuLib API variant; pass explicit --reference directories')
                references.extend([selected, ritsu / 'shared'])
            else:
                references.append(ritsu)
    for path in references:
        if not path.is_dir():
            raise ValueError(f'Missing assembly reference directory: {path}')
    import PIL
    tool_version = subprocess.run([args.ilspy, '--version'], check=True, capture_output=True, text=True).stdout.splitlines()[:2]
    source = source_snapshot(inputs, references, presentation_file, parser_config,
                             {'ilspy': tool_version, 'pillow': PIL.__version__})
    if (source['config'] != presentation_hash or source['parserConfig'] != parser_config_hash or
            source['artifacts']['json']['sha256'] != hashlib.sha256(metadata_bytes).hexdigest()):
        raise ValueError('Import configuration changed during setup; keeping the previous bundle')
    fingerprint = hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest()
    output = PROJECT_ROOT / 'generated' / 'mods' / cfg.id
    current = output / 'bundle.json'
    if not args.force and cached_bundle_valid(current, fingerprint, presentation_file):
        verify_source_unchanged(source, inputs, references, presentation_file, parser_config)
        print(f'unchanged {cfg.id} {fingerprint[:12]}: validated bundle and assets')
        return 0
    parsed = PROJECT_ROOT / '.cache' / 'mod-import' / cfg.id / fingerprint
    parsed.mkdir(parents=True, exist_ok=True)
    # Every attempt has a new staging directory; interrupted runs cannot leave stale classes.
    with tempfile.TemporaryDirectory(prefix='parse-', dir=parsed) as directory:
        stage = Path(directory)
        staged_public_root = stage / 'public'
        public = staged_public_root / 'imported' / cfg.id / fingerprint
        assembly = stage / 'assembly'
        command = [args.ilspy, '-p', '-o', str(assembly)]
        for reference in references:
            command += ['-r', str(reference)]
        subprocess.run(command + [str(inputs['dll'])], check=True, capture_output=True, text=True)
        pack = Pack(inputs['pck'])
        write_json(parsed / 'pack-index.json', [entry.__dict__ for entry in pack.entries.values()])
        locales, assets = extract_resources(pack, presentation['resourceRoot'], stage, public)
        source_locales = copy.deepcopy(locales)
        cfg.source = stage
        cfg.paths['localization'] = stage / 'localization'
        from parsers import parse_assembly
        catalog, diagnostics = parse_assembly(cfg, assembly, image_index(assets))
        game_pack = Pack(game_pack_path)
        game_dll = next((folder / 'sts2.dll' for folder in references if (folder / 'sts2.dll').is_file()), None)
        if game_dll is None:
            raise ValueError('Game sts2.dll is required to validate external model references')
        types = subprocess.run([args.ilspy, '-l', 'c', str(game_dll)], check=True, capture_output=True, text=True).stdout
        game_types = {}
        for category, name in re.findall(r'Class (MegaCrit\.Sts2\.Core\.Models\.(?:Cards|Powers|Relics|Potions|Characters))\.(\w+)', types):
            kind = category.rsplit('.', 1)[1].lower()[:-1]
            game_types[kind, name] = f'{category}.{name}'
        resolve_relations(catalog, cfg, game_types, pack, game_pack, diagnostics)
        categories, quarantined, inherited_locales = resolve_localization(catalog, locales, game_pack, cfg, diagnostics)
        write_json(parsed / 'diagnostics.json', diagnostics)
        if any(item.get('severity') == 'error' for item in diagnostics):
            raise ValueError(f'Assembly normalization failed; inspect {parsed / "diagnostics.json"}')
        validate(categories, locales, assets, cfg)
        thumbs = thumbnails(categories.get('cards', []), assets, public)
        manifest = {'id': cfg.id, 'name': metadata.get('name', cfg.id), 'author': metadata.get('author', ''),
                    'version': metadata.get('version', ''), 'blurb': metadata.get('description', ''),
                    'dependency': cfg.dependency, 'cardRarities': cfg.card_rarities,
                    **{kind: f'{kind}.json' for kind in KINDS}}
        manifest.update(presentation.get('display', {}))
        prefix = f'/imported/{cfg.id}/{fingerprint}/'
        bundle = {'schemaVersion': SCHEMA_VERSION, 'id': cfg.id, 'fingerprint': fingerprint, 'source': source,
                  'manifest': assets_to_urls(manifest, assets, prefix), 'data': assets_to_urls(categories, assets, prefix),
                  'catalog': catalog, 'quarantined': quarantined, 'inheritedLocalization': inherited_locales,
                  'sourceLocalization': source_locales,
                  'localization': locales, 'assets': assets, 'assetBase': prefix,
                  'cardThumbnails': assets_to_urls(thumbs, assets, prefix), 'diagnostics': diagnostics}
        bundle['contentSha256'] = bundle_digest(bundle)
        write_json(parsed / 'normalized.json', bundle)
        # Retain parsed C# evidence for auditing. New fingerprint directories never overwrite prior imports.
        if not (parsed / 'assembly').exists():
            shutil.copytree(assembly, parsed / 'assembly')
        print(publish_bundle(bundle, output, inputs, references, presentation_file, parser_config,
                             staged_public_root=staged_public_root).strip())
        print(json.dumps({'mod': cfg.id, 'fingerprint': fingerprint, 'counts': {k: len(v) for k, v in categories.items()},
                          'catalogCounts': {k: len(v) for k, v in catalog.items()}, 'quarantined': quarantined,
                          'locales': len(locales), 'assets': len(assets), 'diagnostics': len(diagnostics)}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
