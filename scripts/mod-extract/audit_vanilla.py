"""Read-only comparison of the legacy vanilla catalog and one installed game snapshot.

This reports drift; it never combines old numerical data with new localization.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

from config import PROJECT_ROOT, entry_id
from pck import Pack


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def compare_tables(old, current):
    return {
        'legacyKeys': len(old), 'currentKeys': len(current),
        'added': sorted(current.keys() - old.keys()),
        'removed': sorted(old.keys() - current.keys()),
        'changed': sorted(key for key in old.keys() & current.keys() if old[key] != current[key]),
        'currentEmptyDescriptions': sorted(key for key, value in current.items()
                                          if key.endswith('.description') and not value),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', default='D:/Steam/steamapps/common/Slay the Spire 2')
    parser.add_argument('--legacy', default=str(PROJECT_ROOT / 'static/mods/sts2'))
    parser.add_argument('--ilspy', default='ilspycmd')
    parser.add_argument('--output', default=str(PROJECT_ROOT / '.cache/vanilla-audit.json'))
    args = parser.parse_args()
    game, legacy = Path(args.game).resolve(), Path(args.legacy).resolve()
    files = {'dll': game / 'data_sts2_windows_x86_64/sts2.dll',
             'pck': game / 'SlayTheSpire2.pck', 'release': game / 'release_info.json',
             'manifest': legacy / 'manifest.json', 'cards': legacy / 'cards.json'}
    for locale in ('eng', 'zhs'):
        files[f'{locale}Cards'] = legacy / 'localization' / locale / 'cards.json'
    before = {key: {'path': str(path), 'sha256': sha256(path)} for key, path in files.items()}
    pack = Pack(files['pck'])
    listing = subprocess.run([args.ilspy, '-l', 'c', str(files['dll'])], check=True,
                             capture_output=True, text=True, encoding='utf-8').stdout
    classes = set(re.findall(r'^Class MegaCrit\.Sts2\.Core\.Models\.Cards\.(\w+)\s*$', listing, re.M))
    cards = json.loads(files['cards'].read_text(encoding='utf-8-sig'))
    dependency = json.loads(files['manifest'].read_text(encoding='utf-8-sig'))['dependency']
    report = {'inputs': before, 'release': json.loads(files['release'].read_text(encoding='utf-8-sig')),
              'legacyCards': len(cards), 'currentCardClasses': len(classes), 'localization': {},
              'legacyIdsAbsentFromCurrentAssembly': sorted(row['id'] for row in cards if row['id'] not in classes),
              'limitations': ['Class counts include non-publishable models.',
                              'This audit does not prove legacy numerical values, upgrades or pools correct.']}
    for locale in ('eng', 'zhs'):
        old = json.loads(files[f'{locale}Cards'].read_text(encoding='utf-8-sig'))
        current = json.loads(pack.read(f'localization/{locale}/cards.json').decode('utf-8-sig').rstrip('\0'))
        result = compare_tables(old, current)
        result['legacyCardsMissingFields'] = []
        for row in cards:
            key = entry_id(dependency, 'card', row['id'])
            missing = [field for field in ('title', 'description') if f'{key}.{field}' not in old]
            if missing:
                result['legacyCardsMissingFields'].append({'id': row['id'], 'fields': missing,
                    'presentInCurrentPack': all(f'{key}.{field}' in current for field in missing)})
        report['localization'][locale] = result
    if any(sha256(path) != before[key]['sha256'] for key, path in files.items()):
        raise ValueError('Game or legacy input changed during audit; rerun against a stable snapshot')
    output = Path(args.output)
    if output.resolve() in (path.resolve() for path in files.values()):
        raise ValueError('Report must not overwrite an input')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'report': str(output), 'version': report['release']['version'],
        'legacyCards': len(cards), 'currentCardClasses': len(classes),
        'missingEnglish': len(report['localization']['eng']['legacyCardsMissingFields']),
        'changedEnglishKeys': len(report['localization']['eng']['changed'])}, indent=2))


if __name__ == '__main__':
    main()
