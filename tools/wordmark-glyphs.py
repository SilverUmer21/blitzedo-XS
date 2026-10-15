import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
W = float(sys.argv[1]) if len(sys.argv) > 1 else 760
TR = float(sys.argv[2]) if len(sys.argv) > 2 else -0.045
f = TTFont('/home/user/blitzedo-XS/assets/fonts/inter-tight-latin-wght-normal.woff2')
f = instantiateVariableFont(f, {'wght': W})
gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
x = 0; out = []; info = {}
for ch in 'blitzedo':
    g = cmap[ord(ch)]
    p = SVGPathPen(gs); gs[g].draw(p)
    b = BoundsPen(gs); gs[g].draw(b)
    info[ch + str(len(out))] = (x, b.bounds)
    out.append((ch, x, p.getCommands(), b.bounds))
    x += gs[g].width + TR * upm
print(upm, x, f['OS/2'].sCapHeight, f['OS/2'].sxHeight)
for ch, x0, d, bb in out: print(ch, round(x0), [round(v) for v in bb])
import json; json.dump({'upm': upm, 'adv': x, 'glyphs': [[ch, x0, d, bb] for ch, x0, d, bb in out]}, open(sys.argv[3] if len(sys.argv) > 3 else '/tmp/claude-0/-home-user-blitzedo-XS/30d7db2b-5a54-5669-8624-fea05aebc511/scratchpad/glyphs.json', 'w'))
