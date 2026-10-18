"""Extract the website's exact SVG pixels for the deterministic intro renderer."""
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
source = (ROOT / 'assets/wordmark.svg').read_text()
svg = ET.fromstring(source)
pixels, sparks = [], []
for element in svg.iter():
    kind = element.get('class')
    if kind not in ('wm-px', 'wm-spark'):
        continue
    item = {key: float(element.get(key)) for key in ('x', 'y', 'width', 'height')}
    style = dict(part.split(':', 1) for part in element.get('style', '').split(';') if ':' in part)
    if kind == 'wm-px':
        item['p'] = float(style['--p'])
        pixels.append(item)
    else:
        item['color'] = element.get('fill')
        for key in ('sd', 'st', 'sx', 'sy'):
            item[key] = float(style['--' + key].removesuffix('px').removesuffix('s'))
        sparks.append(item)
base = re.sub(r'<g class="wm-(?:blit|sparks)">.*?</g>', '', source, flags=re.S)
(ROOT / 'motion/wordmark-base.svg').write_text(base)
lines = ['// Generated from assets/wordmark.svg by tools/extract-wordmark-motion.py.',
         'export const wordmarkViewBox = ' + json.dumps([float(n) for n in svg.get('viewBox').split()]) + ';']
for name, items in [('blitPixels', pixels), ('blitSparks', sparks)]:
    lines.append('export const ' + name + ' = [')
    lines.extend('  ' + json.dumps(item, separators=(',', ':')) + ',' for item in items)
    lines.append('];')
(ROOT / 'motion/wordmark-data.js').write_text('\n'.join(lines) + '\n')
print(f'Extracted {len(pixels)} letter pixels and {len(sparks)} sparks; base SVG has no frozen sparks.')
