import json, sys
G = json.load(open(sys.argv[1]))
P = 168.5                     # one pixel of the b's broken corner: half the stem
parts = []
for ch, x0, d, bb in G['glyphs']:
    if ch == 'i':
        parts.append(f'<rect x="{x0+87:.0f}" y="0" width="337" height="1118"/>')
        parts.append(f'<circle cx="{x0+255.5:.0f}" cy="1405" r="178"/>')
    else:
        parts.append(f'<path transform="translate({x0:.0f} 0)" d="{d}"/>')
x1 = G['glyphs'][-1][1] + G['glyphs'][-1][3][2]
L = 87
# the b's bottom-left corner breaks into pixels, like the voxel sculpture: a 2 x 2 pixel cut, one stepped pixel left in place
# and one small loose pixel
cut = f'<rect x="{L-10}" y="-40" width="{2*P+10:.0f}" height="{2*P+40:.0f}" fill="#000"/>'
# the stem's bottom-left corner crumbles into pixels (P = a third of the stem): a 2 x 2 pixel cut, one step left in place
# (overlapping the glyph a little so no seam shows) and one small loose pixel at the very corner
bits = f'<rect x="{L+P:.1f}" y="{P:.1f}" width="{P+6:.1f}" height="{P+6:.1f}"/>'
bits += f'<rect x="{L+P*0.16:.1f}" y="{P*0.1:.1f}" width="{P*0.66:.1f}" height="{P*0.66:.1f}"/>'
vb = f'{L} -30 {x1-L:.0f} 1640'
svg = f'''<svg class="wordmark__svg" viewBox="{vb}" role="img" aria-label="blitzedo" focusable="false"><defs><mask id="wm-cut" maskUnits="userSpaceOnUse" x="{L-50}" y="-60" width="{x1:.0f}" height="1700"><rect x="{L-50}" y="-60" width="{x1:.0f}" height="1700" fill="#fff"/>{cut}</mask></defs><g transform="matrix(1 0 0 -1 0 1582)" fill="currentColor"><g mask="url(#wm-cut)">{parts[0]}</g>{bits}{''.join(parts[1:])}</g></svg>'''
open(sys.argv[2], 'w').write(svg)
print(len(svg))
