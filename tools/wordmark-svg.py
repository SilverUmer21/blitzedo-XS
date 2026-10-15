"""
Builds the blitzedo wordmark SVG (assets/wordmark.svg and the inline copy in the pages' headers).

  pip install fonttools brotli
  python3 tools/wordmark-svg.py            # prints the inline SVG; writes assets/wordmark.svg

Inter Tight at weight 760, tracking -1.8 %, a round i dot. "blit" is a hand-drawn pixel font on a grid whose seven rows fill
"zedo"'s x-height exactly (nine rows reach the ascender, the i's dot sits a row above), so the name reads as a pixel blit
running into the smooth "zedo". Each pixel is its own <rect> with a random delay and offset (--d, --x, --y): the CSS
assembles them on load and again on hover. Then a red glow runs through the pixels every few seconds (--p: the pixel's place
along "blit") and warm spark pixels drift up off the letters, like the gate's sparks on the island.
"""
import random
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

FONT = 'assets/fonts/inter-tight-latin-wght-normal.woff2'
WEIGHT, TRACK = 760, -0.018
# pixel glyphs, top row first; rows 2-8 are the x-height, row 8 sits on the baseline, row -1 is the i's dot
BLIT = {
    'b': ['XX.....', 'XX.....', 'XX.XXX.', 'XXXXXXX', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXXX', 'XX.XXX.'],
    'l': ['XX'] * 9,
    'i': ['XX', 'XX', '..', 'XX', 'XX', 'XX', 'XX', 'XX', 'XX', 'XX'],     # starts at row -1
    't': ['.....', '.XX..', 'XXXXX', 'XXXXX', '.XX..', '.XX..', '.XX..', '.XX..', '..XXX'],
}
f = instantiateVariableFont(TTFont(FONT), {'wght': WEIGHT})
gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f['head'].unitsPerEm
cap = f['OS/2'].sCapHeight
cell = f['OS/2'].sxHeight / 7.0     # seven pixel rows fill the x-height

glyphs, x = [], 0.0
for ch in 'blitzedo':
    g = gs[cmap[ord(ch)]]
    bp = BoundsPen(gs); g.draw(bp)
    glyphs.append((ch, x, g, bp.bounds))
    x += g.width + TRACK * upm

I_STEM, I_DOT_Y, I_DOT_R = (87, 424), 1405, 178          # the smooth i (unused while "blit" is pixel art)

rnd = random.Random(7)
pixels, smooth = [], []
px = glyphs[0][3][0]                              # the pixel letters start at the b's left edge, one blank column between them
for ch in 'blit':
    rows = BLIT[ch]
    top = 9 if ch == 'i' else 8                   # the row index of rows[0], counted up from the baseline row (0)
    for r, line in enumerate(rows):
        for c, v in enumerate(line):
            if v == 'X': pixels.append((px + c * cell, (top - r) * cell))
    px += (len(rows[0]) + 1) * cell
shift = px - glyphs[4][1] - glyphs[4][3][0]       # "zedo" moves right to sit one pixel column after the t
for ch, x0, g, bb in glyphs[4:]:
    p = SVGPathPen(gs); g.draw(p)
    smooth.append(f'<path transform="translate({x0 + shift:.0f} 0)" d="{p.getCommands()}"/>')

# pixels: y flipped into SVG space here (the smooth glyphs are flipped by their group)
TOP = 1582
blit_w = max(p[0] for p in pixels) - pixels[0][0] + cell
rects = []
for px, py in pixels:
    d = rnd.random() * 0.45
    dx, dy = rnd.choice([-2, -1, 1, 2]) * cell, rnd.choice([-2, -1, 1]) * cell
    rects.append(f'<rect class="wm-px" x="{px - 0.75:.1f}" y="{TOP - py - cell - 0.75:.1f}" width="{cell + 1.5:.1f}" '
                 f'height="{cell + 1.5:.1f}" style="--d:{d:.2f}s;--x:{dx:.0f}px;--y:{dy:.0f}px;--p:{(px - pixels[0][0]) / (blit_w):.2f}"/>')

# the same pixels as one solid path (row runs), shown once the flying pixels have landed: no seams between them at any size
runs = {}
for px, py in pixels: runs.setdefault(round(py / cell), []).append(round((px - glyphs[0][3][0]) / cell))
solid = []
for r, cols in runs.items():
    cols.sort(); c0 = prev = cols[0]
    for c in cols[1:] + [None]:
        if c is not None and c == prev + 1: prev = c; continue
        x0 = glyphs[0][3][0] + c0 * cell
        solid.append(f'M{x0:.1f} {TOP - (r + 1) * cell:.1f}h{(prev - c0 + 1) * cell:.1f}v{cell:.1f}h{-(prev - c0 + 1) * cell:.1f}z')
        if c is not None: c0 = prev = c

# sparks: small warm pixels that drift up off the letters' tops now and then, like the gate's sparks on the island
tops = {}
for px, py in pixels: tops[round(px / cell)] = max(tops.get(round(px / cell), -9), py)
cands = sorted(tops.items())
sparks = []
for n in range(9):
    c, py = cands[rnd.randrange(len(cands))]
    size = cell * (0.5 if rnd.random() < 0.7 else 0.75)
    sparks.append(f'<rect class="wm-spark" x="{c * cell + (cell - size) / 2:.1f}" y="{TOP - py - cell - size:.1f}" width="{size:.1f}" '
                  f'height="{size:.1f}" fill="{rnd.choice(["#FF5A3C", "#FF7A52", "#FFB283"])}" '
                  f'style="--sd:{1.2 + rnd.random() * 6:.2f}s;--st:{3.2 + rnd.random() * 2.6:.2f}s;--sx:{rnd.choice([-1, 0, 1]) * cell / 2:.0f}px;--sy:{-(3 + rnd.random() * 2) * cell:.0f}px"/>')

x_left = glyphs[0][1] + glyphs[0][3][0]
x_right = glyphs[-1][1] + glyphs[-1][3][2] + shift
vb = f'{x_left:.0f} {TOP - 10 * cell:.0f} {x_right - x_left:.0f} {10 * cell + 30:.0f}'
svg = (f'<svg class="wordmark__svg" viewBox="{vb}" aria-hidden="true" focusable="false"><g fill="currentColor">'
       f'<path class="wm-solid" d="{"".join(solid)}"/><g class="wm-blit">{"".join(rects)}</g><g class="wm-sparks">{"".join(sparks)}</g>'
       f'<g transform="matrix(1 0 0 -1 0 {TOP})">{"".join(smooth)}</g></g></svg>')
open('assets/wordmark.svg', 'w').write(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
                                        .replace('fill="currentColor"', 'fill="#FBF5EB"'))
print(svg)
