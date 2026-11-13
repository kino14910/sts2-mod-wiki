import copy
import hashlib
import io
import json
import os
from contextlib import redirect_stdout
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from config import ModConfig
from import_build import (CONTRACT_FILES, PROJECT_ROOT, assets_to_urls, bundle_digest, cached_bundle_valid,
                          contract_hashes, digest, publish_bundle, resolve_localization, resolve_relations,
                          run_bundle_validator, source_snapshot, write_json)


class FakePack:
    def __init__(self, entries):
        self.entries = entries

    def read(self, name):
        return self.entries[name]


class NormalizationTests(unittest.TestCase):
    def setUp(self):
        self.cfg = ModConfig.load('fgo')

    def test_inherited_text_uses_code_selection_preserves_catalog_and_quarantines_missing(self):
        rows = [{'id': 'AliasPower', 'localizationRefs': {
            'title': {'table': 'cards', 'key': 'FGO_CARD_STRIKE.title'},
            'description': {'table': 'powers', 'key': 'TEMP.description', 'external': True}}}, {'id': 'Missing'}]
        locales = {'localization/eng/cards.json': {'FGO_CARD_STRIKE.title': 'Strike'},
                   'localization/eng/powers.json': {'FGO_POWER_ALIAS_POWER.title': 'Obsolete'}}
        original = copy.deepcopy(rows)
        data, quarantine, inherited = resolve_localization({'powers': rows}, locales,
            FakePack({'localization/eng/powers.json': json.dumps({'TEMP.description': 'Temporary strength.'}).encode()}), self.cfg, [])
        self.assertEqual(rows, original)
        self.assertEqual(len(data['powers']), 1)
        self.assertEqual(quarantine[0]['id'], 'Missing')
        self.assertEqual(locales['localization/eng/resolved-models.json']['FGO_POWER_ALIAS_POWER.title'], 'Strike')
        self.assertNotIn('FGO_POWER_ALIAS_POWER.title', locales['localization/eng/powers.json'])
        self.assertIn('localization/eng/powers.json', inherited)

    def test_relation_namespace_and_godot_remap(self):
        rows = {'cards': [{'id': 'Strike', 'refs': [{'kind': 'power', 'id': 'StrengthPower'}],
                          'resourceRefs': ['res://Fgo/scene.tscn']}], 'powers': []}
        resolve_relations(rows, self.cfg, {('power', 'StrengthPower'): 'MegaCrit.Sts2.Core.Models.Powers.StrengthPower'},
            FakePack({'Fgo/scene.tscn.remap': b'[remap]\npath="res://.godot/exported/scene.scn"', '.godot/exported/scene.scn': b'x'}), FakePack({}), [])
        self.assertEqual(rows['cards'][0]['refs'][0]['namespace'], 'sts2')
        self.assertEqual(rows['cards'][0]['entityKey'], 'fgo:card:Strike')
        self.assertTrue(rows['cards'][0]['resources'][0]['available'])

    def test_digest_ignores_object_order_and_integer_float_representation(self):
        self.assertEqual(bundle_digest({'a': 1.0, 'b': [2], 'contentSha256': 'old'}), bundle_digest({'b': [2], 'a': 1}))
        self.assertNotEqual(bundle_digest({'a': 1}), bundle_digest({'a': 2}))


class PresentationTests(unittest.TestCase):
    def setUp(self):
        self.display = json.loads((PROJECT_ROOT / 'content/mods/fgo.json').read_text(encoding='utf-8'))['display']
        # Logical output paths verified against the released Fgo.pck .import entries.
        self.assets = dict.fromkeys((
            'images/charui/character_icon_fgo.png', 'images/charui/character_icon_noble.png',
            'images/ui/energy_fgo_big.png', 'images/ui/energy_noble_big.png', 'images/ui/energy_fgo.png',
            'images/card_frames/card_frame_attack.png', 'images/card_frames/card_frame_skill.png',
            'images/card_frames/card_frame_power.png'), {})
        self.prefix = '/imported/fgo/' + 'a' * 64 + '/'

    def test_fgo_display_survives_import_with_both_pools_and_legacy_styles(self):
        original = copy.deepcopy(self.display)
        pools = assets_to_urls(self.display, self.assets, self.prefix)['cardPool']
        self.assertEqual(self.display, original)
        self.assertEqual(set(pools), {'fgo', 'noble'})
        self.assertEqual(pools['fgo'], {
            'labels': {'eng': 'Fgo', 'zhs': '御主'},
            'char': self.prefix + 'images/charui/character_icon_fgo.png',
            'cardEnergy': self.prefix + 'images/ui/energy_fgo_big.png',
            'textEnergy': self.prefix + 'images/ui/energy_fgo.png',
            'accent': '#a6a199', 'energyOutline': '#5c5440',
            'cardFrame': {kind: self.prefix + f'images/card_frames/card_frame_{kind}.png'
                          for kind in ('attack', 'skill', 'power')}})
        self.assertEqual(pools['noble'], {
            'labels': {'eng': 'Noble Phantasm', 'zhs': '宝具'},
            'char': self.prefix + 'images/charui/character_icon_noble.png',
            'cardEnergy': self.prefix + 'images/ui/energy_noble_big.png',
            'textEnergy': self.prefix + 'images/ui/energy_fgo.png',
            'accent': '#ffd700', 'energyOutline': '#be6900', 'cardFrame': {}})

    def test_every_display_asset_must_exist_in_the_imported_pack(self):
        for path in self.assets:
            with self.subTest(asset=path), self.assertRaisesRegex(ValueError, 'missing asset'):
                assets_to_urls(self.display, {key: value for key, value in self.assets.items() if key != path}, self.prefix)


class BundleContractTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.config = self.root / 'demo.json'
        self.config.write_text('{}', encoding='utf-8')
        self.public = self.root / 'static'
        self.current = self.root / 'bundle.json'
        self.fingerprint = 'a' * 64
        self.bundle = {
            'schemaVersion': 1, 'id': 'demo', 'fingerprint': self.fingerprint,
            'assetBase': f'/imported/demo/{self.fingerprint}/',
            'source': {'config': digest(self.config)},
            'manifest': {'id': 'demo', 'name': 'Demo', 'author': '', 'blurb': '',
                         'dependency': {'type': 'other', 'prefix': ''}, 'cards': 'cards.json'},
            'data': {'cards': [{'id': 'Strike', 'pool': 'demo', 'type': 'attack',
                                'rarity': 'common', 'cost': 1, 'keywords': [],
                                'variables': {'Rate': 0.000001, 'Small': 1e-7}}]},
            'localization': {'localization/eng/cards.json': {
                'STRIKE.title': 'Strike', 'STRIKE.description': 'Deal damage.'}},
            'assets': {},
        }

    def save(self):
        self.bundle['contentSha256'] = bundle_digest(self.bundle)
        self.current.write_text(json.dumps(self.bundle, ensure_ascii=False), encoding='utf-8')

    def cached(self, fingerprint=None):
        with redirect_stdout(io.StringIO()):
            return cached_bundle_valid(self.current, fingerprint or self.fingerprint, self.config, self.public)

    def prepare_publication(self, same_fingerprint=True):
        self.output = self.root / 'generated'
        self.output.mkdir()
        self.current = self.output / 'bundle.json'
        self.staged_public = self.root / 'attempt-public'
        self.references = self.root / 'references'
        self.references.mkdir()
        (self.references / 'dependency.dll').write_bytes(b'reference v1')
        self.artifact = self.root / 'Demo.dll'
        self.artifact.write_bytes(b'assembly v1')
        self.parser_config = self.root / 'parser.json'
        self.parser_config.write_bytes(b'{}')
        self.bundle['source'] = source_snapshot({'dll': self.artifact}, [self.references],
                                               self.config, self.parser_config, {})
        self.asset_bytes = {'images/cards/Strike.png': b'published art',
                            'images/thumbnails/Strike.webp': b'published thumbnail'}
        self.bundle['assets'] = {name: {'resource': 'source', 'sha256': hashlib.sha256(data).hexdigest()}
                                 for name, data in self.asset_bytes.items()}
        self.bundle['data']['cards'][0]['image'] = self.bundle['assetBase'] + 'images/cards/Strike.png'
        self.bundle['cardThumbnails'] = {'Strike': self.bundle['assetBase'] + 'images/thumbnails/Strike.webp'}
        self.bundle['contentSha256'] = bundle_digest(self.bundle)
        previous = copy.deepcopy(self.bundle)
        if not same_fingerprint:
            previous['fingerprint'] = 'b' * 64
            previous['assetBase'] = f'/imported/demo/{previous["fingerprint"]}/'
            previous['data']['cards'][0]['image'] = previous['assetBase'] + 'images/cards/Strike.png'
            previous['cardThumbnails']['Strike'] = previous['assetBase'] + 'images/thumbnails/Strike.webp'
            previous['contentSha256'] = bundle_digest(previous)
        write_json(self.current, previous)
        self.previous_bytes = self.current.read_bytes()
        self.snapshot = self.output / 'snapshots' / f'{previous["fingerprint"]}.json'
        self.snapshot.parent.mkdir()
        self.snapshot.write_bytes(self.previous_bytes)
        self.previous_assets = self.public / previous['assetBase'].lstrip('/')
        self.staged_assets = self.staged_public / self.bundle['assetBase'].lstrip('/')
        for name, data in self.asset_bytes.items():
            for folder in (self.previous_assets, self.staged_assets):
                target = folder / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)

    def publish(self):
        return publish_bundle(self.bundle, self.output, {'dll': self.artifact}, [self.references],
                              self.config, self.parser_config, staged_public_root=self.staged_public,
                              public_root=self.public)

    def assert_previous_unchanged(self, expected_assets=None):
        self.assertEqual(self.current.read_bytes(), self.previous_bytes)
        self.assertEqual(self.snapshot.read_bytes(), self.previous_bytes)
        for name, data in (expected_assets or self.asset_bytes).items():
            target = self.previous_assets / name
            if data is None:
                self.assertFalse(target.exists())
            else:
                self.assertEqual(target.read_bytes(), data)
        self.assertFalse((self.output / '.publish.lock').exists())

    def test_force_same_fingerprint_reuses_healthy_assets_without_rewriting_history(self):
        self.prepare_publication()
        mtimes = {name: (self.previous_assets / name).stat().st_mtime_ns for name in self.asset_bytes}
        with patch('import_build.run_bundle_validator', wraps=run_bundle_validator) as validator:
            self.assertIn('Validated demo', self.publish())
        resource_checks = [call.args[1] for call in validator.call_args_list if len(call.args) == 3]
        self.assertEqual(resource_checks, [self.staged_public, self.public])
        self.assert_previous_unchanged()
        self.assertEqual(mtimes, {name: (self.previous_assets / name).stat().st_mtime_ns
                                  for name in self.asset_bytes})

    def test_force_different_bytes_at_same_fingerprint_preserves_published_assets(self):
        self.prepare_publication()
        for name in self.asset_bytes:
            data = b'different force output: ' + name.encode()
            (self.staged_assets / name).write_bytes(data)
            self.bundle['assets'][name]['sha256'] = hashlib.sha256(data).hexdigest()
        self.bundle['contentSha256'] = bundle_digest(self.bundle)
        with self.assertRaisesRegex(ValueError, 'different bundle content'):
            self.publish()
        self.assert_previous_unchanged()

    def test_candidate_validation_failure_never_touches_published_resources(self):
        self.prepare_publication()
        (self.staged_assets / 'images/cards/Strike.png').write_bytes(b'bad staging bytes')
        with self.assertRaisesRegex(ValueError, 'Missing or corrupt'):
            self.publish()
        self.assert_previous_unchanged()

    def test_existing_resources_cannot_be_repaired_without_matching_history(self):
        self.prepare_publication(same_fingerprint=False)
        existing = self.public / self.bundle['assetBase'].lstrip('/') / 'images/cards/Strike.png'
        existing.parent.mkdir(parents=True)
        existing.write_bytes(b'unproven existing art')
        with self.assertRaisesRegex(ValueError, 'matching verified published bundle'):
            self.publish()
        self.assert_previous_unchanged()
        self.assertEqual(existing.read_bytes(), b'unproven existing art')
        self.assertFalse((self.output / 'snapshots' / f'{self.fingerprint}.json').exists())

    def test_changed_input_before_publication_preserves_bundle_art_and_thumbnail(self):
        self.prepare_publication()
        self.artifact.write_bytes(b'changed build')
        with self.assertRaisesRegex(ValueError, 'inputs changed'):
            self.publish()
        self.assert_previous_unchanged()

    def test_missing_and_corrupt_resources_are_repaired_against_verified_history(self):
        self.prepare_publication()
        (self.previous_assets / 'images/cards/Strike.png').unlink()
        (self.previous_assets / 'images/thumbnails/Strike.webp').write_bytes(b'corrupt thumbnail')
        self.assertIn('Validated demo', self.publish())
        self.assert_previous_unchanged()
        self.assertTrue(cached_bundle_valid(self.current, self.fingerprint, self.config, self.public))

    def test_bundle_commit_failure_rolls_back_exact_corrupt_bytes_and_missing_files(self):
        self.prepare_publication()
        state = {'images/cards/Strike.png': b'original corrupt bytes',
                 'images/thumbnails/Strike.webp': None}
        (self.previous_assets / 'images/cards/Strike.png').write_bytes(state['images/cards/Strike.png'])
        (self.previous_assets / 'images/thumbnails/Strike.webp').unlink()
        replace = os.replace
        def fail_commit(source, target):
            if Path(target) == self.current:
                raise OSError('simulated bundle commit failure')
            return replace(source, target)
        with patch('import_build.os.replace', side_effect=fail_commit), self.assertRaisesRegex(OSError, 'commit failure'):
            self.publish()
        self.assert_previous_unchanged(state)

    def test_final_resource_validation_failure_rolls_back_repairs(self):
        self.prepare_publication()
        name = 'images/cards/Strike.png'
        (self.previous_assets / name).write_bytes(b'prior corrupt art')
        state = {**self.asset_bytes, name: b'prior corrupt art'}
        def fail_served_validation(*args, **kwargs):
            result = run_bundle_validator(*args, **kwargs)
            if len(args) == 3 and args[1] == self.public:
                raise ValueError('simulated final validation failure')
            return result
        with patch('import_build.run_bundle_validator', side_effect=fail_served_validation), self.assertRaisesRegex(ValueError, 'final validation'):
            self.publish()
        self.assert_previous_unchanged(state)

    def test_input_change_during_asset_publication_rolls_back_repairs(self):
        self.prepare_publication()
        name = 'images/cards/Strike.png'
        (self.previous_assets / name).write_bytes(b'prior corrupt art')
        state = {**self.asset_bytes, name: b'prior corrupt art'}
        from import_build import verify_source_unchanged
        calls = 0
        def change_input(*args):
            nonlocal calls
            calls += 1
            if calls == 2:
                self.artifact.write_bytes(b'updated during publication')
            return verify_source_unchanged(*args)
        with patch('import_build.verify_source_unchanged', side_effect=change_input), self.assertRaisesRegex(ValueError, 'inputs changed'):
            self.publish()
        self.assert_previous_unchanged(state)

    def test_new_generation_rename_is_rolled_back_if_bundle_commit_fails(self):
        self.prepare_publication(same_fingerprint=False)
        new_assets = self.public / self.bundle['assetBase'].lstrip('/')
        replace = os.replace
        def fail_commit(source, target):
            if Path(target) == self.current:
                raise OSError('simulated bundle commit failure')
            return replace(source, target)
        with patch('import_build.os.replace', side_effect=fail_commit), self.assertRaisesRegex(OSError, 'commit failure'):
            self.publish()
        self.assert_previous_unchanged()
        self.assertFalse(new_assets.exists())
        self.assertFalse((self.output / 'snapshots' / f'{self.fingerprint}.json').exists())
        self.assertTrue(self.staged_assets.is_dir())

    def test_new_generation_publishes_assets_before_bundle_and_preserves_old_snapshot(self):
        self.prepare_publication(same_fingerprint=False)
        self.assertIn('Validated demo', self.publish())
        self.assertEqual(json.loads(self.current.read_text())['fingerprint'], self.fingerprint)
        self.assertEqual(self.snapshot.read_bytes(), self.previous_bytes)
        for name, data in self.asset_bytes.items():
            self.assertEqual((self.previous_assets / name).read_bytes(), data)
            self.assertEqual((self.public / self.bundle['assetBase'].lstrip('/') / name).read_bytes(), data)
        self.assertFalse(self.staged_assets.exists())

    def test_node_digest_handles_exponents_numeric_keys_unicode_and_negative_zero(self):
        # This is Node's canonical JSON, not Python's JSON formatting/order.
        value = {'value': {'10': 'ten', '2': 'two', '\ue000': 'private', '\U0001f600': 'emoji'},
                 'small': 0.000001, 'tiny': 1e-7, 'zero': -0.0, 'whole': 1.0}
        canonical = '{"small":0.000001,"tiny":1e-7,"value":{"2":"two","10":"ten","\U0001f600":"emoji","\ue000":"private"},"whole":1,"zero":0}'
        self.assertEqual(bundle_digest(value), hashlib.sha256(canonical.encode('utf-8')).hexdigest())
        self.bundle['data']['cards'][0]['variables'].update({'10': 10, '2': 2, 'Max': 2**53 - 1})
        self.save()
        self.assertIn('Validated demo', run_bundle_validator(self.current, self.public, self.config))

    def test_rejects_unsafe_integers_before_javascript_can_silently_round_them(self):
        for value in (2**53, 2**53 + 1, -(2**53 + 1), 10**100, 1e21):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'unsafe integer'):
                bundle_digest({'nested': [value]})
        for value in (float('nan'), float('inf'), -float('inf')):
            with self.subTest(value=value), self.assertRaises(ValueError):
                bundle_digest({'value': value})

    def test_cache_hit_runs_current_validator_even_with_valid_digest(self):
        self.save()
        self.assertTrue(self.cached())
        del self.bundle['data']['cards'][0]['cost']
        self.save()  # Valid checksum and input fingerprint, but today's schema rejects it.
        self.assertFalse(self.cached())

    def test_cache_rechecks_content_configuration_and_resource_bytes(self):
        asset = self.public / self.bundle['assetBase'].lstrip('/') / 'images/cards/Strike.png'
        asset.parent.mkdir(parents=True)
        asset.write_bytes(b'original image')
        self.bundle['assets']['images/cards/Strike.png'] = {'resource': 'source', 'sha256': digest(asset)}
        self.bundle['data']['cards'][0]['image'] = self.bundle['assetBase'] + 'images/cards/Strike.png'
        self.save()
        self.assertTrue(self.cached())
        asset.write_bytes(b'corrupt image')
        self.assertFalse(self.cached())
        asset.unlink()
        self.assertFalse(self.cached())
        asset.write_bytes(b'original image')
        self.config.write_text('{"changed":true}', encoding='utf-8')
        self.assertFalse(self.cached())
        self.config.write_text('{}', encoding='utf-8')
        self.bundle['manifest']['name'] = 'Tampered'
        self.current.write_text(json.dumps(self.bundle), encoding='utf-8')
        self.assertFalse(self.cached())

    def test_different_fingerprint_does_not_claim_a_cache_hit(self):
        self.save()
        with patch('import_build.run_bundle_validator') as validator:
            self.assertFalse(self.cached('b' * 64))
            validator.assert_not_called()

    def test_every_declared_contract_dependency_invalidates_the_fingerprint(self):
        # Real dependency reads ensure no misspelled or missing path is ignored.
        self.assertEqual(set(contract_hashes()), set(CONTRACT_FILES))
        for name in CONTRACT_FILES:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((PROJECT_ROOT / name).read_bytes())
        before = contract_hashes(self.root)
        before_fingerprint = hashlib.sha256(json.dumps(before, sort_keys=True).encode()).hexdigest()
        for name in CONTRACT_FILES:
            with self.subTest(dependency=name):
                target = self.root / name
                original = target.read_bytes()
                target.write_bytes(original + b'\n// contract changed\n')
                after = contract_hashes(self.root)
                self.assertNotEqual(before[name], after[name])
                self.assertNotEqual(before_fingerprint, hashlib.sha256(json.dumps(after, sort_keys=True).encode()).hexdigest())
                target.write_bytes(original)

    def test_contract_covers_actual_node_runtime_imports(self):
        # Observe the real loader, rather than guessing imports from TS text.
        # This also fails if a new helper accidentally depends on virtual:mods,
        # browser-only code, or extensionless imports unsupported by plain Node.
        script = '''
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = process.cwd();
const files = new Set();
const hooks = registerHooks({ load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.startsWith('file:')) files.add(path.relative(root, fileURLToPath(url)).split(path.sep).join('/'));
    return result;
} });
await import(pathToFileURL(path.resolve('scripts/imported-mods.ts')).href);
hooks.deregister();
console.log(JSON.stringify([...files].sort()));
'''
        result = subprocess.run(['node', '--experimental-strip-types', '--input-type=module', '-e', script],
                                cwd=PROJECT_ROOT, check=True, capture_output=True, text=True, encoding='utf-8')
        loaded = set(json.loads(result.stdout)) | {'scripts/validate-import.mjs'}
        self.assertFalse(loaded - set(CONTRACT_FILES),
                         f'Add new Node contract dependencies to CONTRACT_FILES: {sorted(loaded - set(CONTRACT_FILES))}')

    def test_publication_rejects_changed_inputs_and_preserves_previous_bundle(self):
        references = self.root / 'references'
        references.mkdir()
        reference = references / 'dependency.dll'
        reference.write_bytes(b'reference v1')
        artifact = self.root / 'Demo.dll'
        artifact.write_bytes(b'assembly v1')
        parser_config = self.root / 'parser.json'
        parser_config.write_bytes(b'{}')
        contract = self.root / 'contract.ts'
        contract.write_bytes(b'contract v1')
        output = self.root / 'generated'
        output.mkdir()
        previous = output / 'bundle.json'
        previous_bytes = json.dumps({'fingerprint': 'b' * 64, 'previous': 'published bundle'}).encode()
        previous.write_bytes(previous_bytes)
        staged_public = self.root / 'attempt-public'
        inputs = {'dll': artifact}
        def contract_state():
            return {'contract.ts': digest(contract)}
        with patch('import_build.contract_hashes', side_effect=contract_state):
            self.bundle['source'] = source_snapshot(inputs, [references], self.config, parser_config, {})
            self.bundle['contentSha256'] = bundle_digest(self.bundle)
            def publish():
                return publish_bundle(self.bundle, output, inputs, [references], self.config, parser_config,
                                      staged_public_root=staged_public, public_root=self.public)
            for target in (artifact, reference, self.config, parser_config, contract):
                with self.subTest(changed=target.name):
                    original = target.read_bytes()
                    target.write_bytes(original + b' changed')
                    with self.assertRaisesRegex(ValueError, 'inputs changed|configuration changed'):
                        publish()
                    self.assertEqual(previous.read_bytes(), previous_bytes)
                    self.assertFalse((output / 'snapshots').exists())
                    self.assertFalse(list(output.glob('*.tmp')))
                    target.write_bytes(original)
            # Detect dependency additions/deletions as well as changed contents.
            added = references / 'new.dll'
            added.write_bytes(b'new dependency')
            with self.assertRaisesRegex(ValueError, 'references'):
                publish()
            added.unlink()
            reference.unlink()
            with self.assertRaisesRegex(ValueError, 'references'):
                publish()
            reference.write_bytes(b'reference v1')
            artifact.unlink()
            with self.assertRaisesRegex(ValueError, 'inputs changed'):
                publish()
            artifact.write_bytes(b'assembly v1')
            publish()
            self.assertEqual(json.loads(previous.read_text(encoding='utf-8'))['fingerprint'], self.fingerprint)
            self.assertTrue((output / 'snapshots' / f'{self.fingerprint}.json').is_file())


if __name__ == '__main__':
    unittest.main()
