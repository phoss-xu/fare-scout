"""Build a renamed UI subset from Adobe's Source Han CN variable WOFF2.
Usage: python subset_chinese_font.py /path/to/SourceHanSerifCN-VF.otf.woff2 --serif
Requires fonttools[woff] in a development environment, not at application runtime.
"""
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
style = 'Serif' if '--serif' in sys.argv[2:] else 'Sans'
characters = set()
for path in (ROOT / 'app').rglob('*'):
    if path.suffix in {'.js', '.html', '.json', '.py'}:
        characters.update(path.read_text())
# GB2312 level-one common hanzi cover text entered after the build, too.
for high in range(0xB0, 0xD8):
    for low in range(0xA1, 0xFF):
        try:
            characters.add(bytes([high, low]).decode('gb2312'))
        except UnicodeDecodeError:
            pass
font = TTFont(sys.argv[1])
options = subset.Options()
options.flavor = 'woff2'
options.name_IDs = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes={ord(char) for char in characters if ord(char) > 127})
subsetter.subset(font)
# The upstream license reserves 'Source'; rename the modified font.
for record in font['name'].names:
    value = record.toUnicode()
    if record.nameID in {1, 3, 4, 6, 16, 17, 25}:
        value = value.replace(f'SourceHan{style}CN', f'FareScout{style}').replace(f'Source Han {style} CN', f'Fare Scout {style}')
        record.string = value.encode(record.getEncoding())
font.flavor = 'woff2'
output = ROOT / f'app/static/assets/fare-scout-{style.lower()}-vf.woff2'
font.save(output)
print(f'{len(font.getBestCmap())} glyphs, {output.stat().st_size:,} bytes: {output}')
