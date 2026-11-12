"""Rebuild the static report fonts using fonttools and brotli.

Run from the repository root after installing its npm dependencies.
Source fonts and outputs are covered by src/lib/assets/OFL.txt.
This is a maintenance helper; application builds need no Python packages.
"""

from pathlib import Path
from tempfile import TemporaryDirectory

from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def static_font(path, weight):
    font = TTFont(path)
    axes = {axis.axisTag: axis.defaultValue for axis in font['fvar'].axes}
    axes['wght'] = weight
    instantiateVariableFont(font, axes, inplace=True)
    font.flavor = None
    return font


assets = Path('src/lib/assets')
static_font(assets / 'NunitoSans.ttf', 700).save(assets / 'NunitoSans-Bold.ttf')
with TemporaryDirectory(prefix='scenario-report-fonts-') as temporary:
    for weight, name in [(400, 'Italic'), (700, 'BoldItalic')]:
        paths = []
        for subset in ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'vietnamese']:
            source = Path('node_modules/@fontsource-variable/nunito-sans/files') / f'nunito-sans-{subset}-full-italic.woff2'
            if not source.exists():
                raise FileNotFoundError(source)
            font = static_font(source, weight)
            if 'MATH' in font:
                del font['MATH']
            target = str(Path(temporary) / f'{subset}-{weight}.ttf')
            font.save(target)
            paths.append(target)
        Merger().merge(paths).save(assets / f'NunitoSans-{name}.ttf')
