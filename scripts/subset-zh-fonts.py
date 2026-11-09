"""从 Slay the Spire 2 自带的中文字体裁剪出站点用到的字集。

原版 src/Core/Localization/Fonts/FontPathSets/ZhsFontPathSet.cs：
  Regular -> notoSansMonoCJKsc-Regular（界面 / 正文）
  Bold    -> SourceHanSerifSC-Bold（加粗强调）
  Italic  -> SourceHanSerifSC-Medium
这里按同一映射裁出三份 woff2，放进 static/fonts/zh/。

用法：
  python scripts/subset-zh-fonts.py [--game "D:/sts-fgoMod/Slay the Spire 2"] [--all-common]
--all-common 会额外并入 GB2312 一级字（约 3755 字），体积翻数倍，仅在站点文案大幅扩张时使用。
"""

import argparse
import io
import pathlib
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCAN_DIRS = [ROOT / 'src', ROOT / 'static' / 'localization']
SCAN_SUFFIXES = {'.ts', '.js', '.svelte', '.json', '.css', '.html'}
OUT_DIR = ROOT / 'static' / 'fonts' / 'zh'

FACES = [
    ('noto_sans_mono_cjk_sc_regular', 'NotoSansMonoCJKsc-Regular.otf'),
    ('source_han_serif_sc_medium', 'SourceHanSerifSC-Medium.otf'),
    ('source_han_serif_sc_bold', 'SourceHanSerifSC-Bold.otf'),
]

CJK_RANGES = [(0x3000, 0x303F), (0x4E00, 0x9FFF), (0xFF00, 0xFFEF)]


def is_cjk(ch: str) -> bool:
    code = ord(ch)
    return any(lo <= code <= hi for lo, hi in CJK_RANGES)


def collect_chars() -> set[str]:
    chars: set[str] = set()
    for directory in SCAN_DIRS:
        for path in directory.rglob('*'):
            if path.is_file() and path.suffix in SCAN_SUFFIXES:
                try:
                    chars |= {c for c in path.read_text(encoding='utf-8') if is_cjk(c)}
                except (UnicodeDecodeError, OSError):
                    continue
    return chars


def gb2312_level1() -> set[str]:
    chars = set()
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError:
                continue
    return chars


def subset(source: pathlib.Path, chars: set[str], target: pathlib.Path) -> int:
    font = TTFont(source, lazy=True)
    options = Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.notdef_outline = True
    subsetter = Subsetter(options=options)
    subsetter.populate(text=''.join(sorted(chars)))
    subsetter.subset(font)
    buffer = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buffer)
    target.write_bytes(buffer.getvalue())
    return len(buffer.getvalue())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--game', default='D:/sts-fgoMod/Slay the Spire 2')
    parser.add_argument('--all-common', action='store_true')
    args = parser.parse_args()

    game_fonts = pathlib.Path(args.game) / 'fonts' / 'zhs'
    if not game_fonts.is_dir():
        print(f'找不到原版字体目录：{game_fonts}', file=sys.stderr)
        return 1

    chars = collect_chars()
    if args.all_common:
        chars |= gb2312_level1()
    print(f'字集：{len(chars)} 个字符')

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for stem, filename in FACES:
        source = game_fonts / filename
        if not source.is_file():
            print(f'跳过（缺失）：{source}', file=sys.stderr)
            continue
        size = subset(source, chars, OUT_DIR / f'{stem}.woff2')
        total += size
        print(f'  {stem:32s} {size / 1024:7.1f} KB')
    print(f'合计 {total / 1024:.1f} KB -> {OUT_DIR.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
