# Design iteration checklist

Use [DESIGN.md](../DESIGN.md) as the current source of design decisions. Add revisions as separate files so the original concepts remain available.

## Confirmed direction

- [x] Home: Play beyond, charcoal voxel b, red doorway, ivory explorer and red scarf.
- [x] Desktop Studio: detailed workbench scene.
- [x] Desktop Contact: red mailbox with envelope, columns and rubble.
- [x] Keep each game's native art style inside the studio website frame.
- [x] Recover concept artwork and connect the Markdown image references.

## Next review

- [ ] Choose Games Option A or B.
- [ ] Replace provisional game posters with artwork faithful to the real games.
- [ ] Approve mobile Home framing without simplifying the b sculpture.
- [ ] Review mobile Studio and Contact; remove numbered process markers.
- [ ] Refine wordmark, font selection, palette, buttons and form states.
- [ ] Review static layouts at 360, 390, 768 and 1440 pixels.
- [ ] Approve desktop and mobile static screens before implementation.

## Later phases

- [ ] Implement the approved website.
- [ ] Add transitions with reduced-motion alternatives.
- [ ] Define and animate the explorer mascot.

## Decision log

| Date | Decision | Status |
| --- | --- | --- |
| 2026-10-15 | Preserve the documented direction and original artwork; continue design before code. | Current foundation |
| 2026-10-15 | Deliver the remaining artwork and documentation together in one commit. | User requested |
| 2026-10-15 | Build the Home page: generated voxel b sculpture (finer stone, red rim light, glowing doorway, tapered floating foundation), primary button in `#D51D22`, clean wordmark, no active nav item on Home. | Implemented, awaiting user review |
| 2026-10-15 | Rebuild the sculpture in three.js with real cubes (big foundation blocks, pixel-art textures, shadow-casting lights, doorway light) closer to the reference. | Superseded by the next row |
| 2026-10-15 | Sculpture blocks are all charcoal stone; red comes from light, not red blocks. Larger cubes (9-unit letter, 12-unit foundation) with chunky chipped-stone textures. | Implemented, awaiting user review |
| 2026-10-15 | Foundation remade as a bowl: regular grid of 15-unit rim cubes (some near-black so tops alternate red / black), 7.5 and 3.75-unit tiers stepping down a smooth bowl profile; chibi explorer; calmer glow. | Implemented, awaiting user review |
| 2026-10-15 | b silhouette reworked (taller stem, rounder bowl, low front-leaning camera like the reference, steps flush with the wall, red edge light strips); primary button `#C4161B`; type switched to self-hosted Inter Tight. | Implemented, awaiting user review |
| 2026-10-15 | Camera returned to a near-isometric view (45 deg / 33 deg) so the island reads as a diamond; island reshaped as a square diamond with an inverted-cone underside and alternating red-lit / near-black top cubes. Supersedes the low front-leaning camera. | Implemented, awaiting user review |
| 2026-10-15 | b rebuilt from the same large cubes as the island (15 / 7.5-unit); island is a round disc over a deep pointed gem cone; camera 38 deg around / 24 deg up; red spotlight key with shadows, tighter door spill. Supersedes the diamond-footprint island. | Implemented, awaiting user review |
| 2026-10-15 | b shape reworked from a coordinate grid laid over the reference: 3 cubes deep, stem 2 wide x 8 tall, bowl 5 wide x 5 tall with a big rounded top-right corner, arched door on the cube grid, four steps up to a landing then a thin ribbon of small steps down to the doorstep; all on the island's 15 / 7.5 / 3.75 cube tiers; camera 34 deg around / 21 deg up. Lighting untouched. | Implemented, awaiting user review |
| 2026-10-15 | From the user's marked-up screenshot: removed the free-standing left stair block and extra platform (stairs now sit flush with the wall like the reference), made the bowl's right end a big side face (camera 40 deg around, arc cut on a 7.5 grid), and gave the island a clean front row of stretched 15 x 22.5 x 15 cubes on a slimmer slab. | Implemented, awaiting user review |
| 2026-10-15 | Removed the block and platform left of the stem; one stair flight runs from a landing in front of the stem (explorer fully visible) down the front wall to the door; bowl lengthened to 7 cubes with a square bottom and small rounded top corner so its right end is a full-height side; taller door; island centred under the b. | Implemented, awaiting user review |
| 2026-10-15 | b refit by overlaying the render's outline on the reference: stem one cube deep and 3.2x as tall as wide, bowl one cube deep with flush front, door right beside the stem with a deep red recess, landing block plus a flight of five steps to the doorstep; island narrower and its cone shorter so the b leads. | Implemented, awaiting user review |
| 2026-10-15 | Per the user's markup: the b (stem and bowl) is now two big cubes deep, so its right side is built from two big cubes with half cubes rounding the corner; the island's front edge is uneven (rim cubes at three heights and depths, some broken into half cubes). | Implemented, awaiting user review |
| 2026-10-15 | Bigger glowing gate (37.5 x 56) lit from inside by smooth glowing panels with light spilling onto the floor; wider stone band above it; bowl one cube longer and five tall with a two-cube right wall; taller stem; rebuilt stairs (landing, three steps, eight-step flight with lit treads); new chibi explorer; wider island front-left with a ragged, spiky underside; lighting rebalanced (key above the b, lifted neutral fill, softer edge strips). | Implemented, awaiting user review |
| 2026-10-15 | Big blocks throughout: stairs are four big steps two blocks wide descending from the stem toward the viewer; gate rebuilt on the big-block grid (2 wide, 3 tall, stepped arch, one block deep) with matching glow panels; island wider toward the front; underside mostly half blocks with a few small tips; red rebalanced (no stair light, stronger gate spill and bloom). | Implemented, awaiting user review |
| 2026-10-15 | Pixel-native render (1/6 resolution, small charcoal/red palette, stepped glow, nearest-neighbour upscale); pixel-texture gate glow; red kept to tops and edges (short doorway spill, no wall strips); red light under the island lights the hanging tips; explorer rebuilt as a readable pixel sprite. | Implemented, awaiting user review |
| 2026-10-15 | Stairs restored to the reference's direction: explorer on a landing at the stem's left edge, six steps of 7.5 cubes running right along the stem's front down to the gate. Only the bowl's right side uses the two-big-block change. | Implemented, awaiting user review |
| 2026-10-15 | Sculpture rebuilt as pixel-art voxels (2.5-unit voxels, flat colour per face) matched to the user's six detail references: painted red tops / rims / tips, stepped-arch gate with coral back wall and dark-red jamb, stairs from the gate to a mid landing, turning to a top landing and a small doorway. Texture comparison sheet and method in design/SCULPTURE.md. | Implemented, awaiting user review (≈70 % of the references) |
| 2026-10-15 | Red follows the silhouette: outline bands (view-ray test) replace the island's red dots and the inner-edge rims, so the b, stairs and island read as red outlines around black bodies; no lips on the letter. | Implemented, awaiting user review |
| 2026-10-15 | Rounder bowl curve (r45, voxel-cut, red only at its edges); island columns separated and stepped with black gaps; patchy red on the underside edges and ledges instead of a solid border; strong stone grain and rough dented surface; raised red-tiled gate step where the stairs start. | Implemented, awaiting user review |
| 2026-10-15 | Island red as whole-edge lines down the columns (no per-voxel dots); bowl gets a curved bottom ending; the gate's tiled step runs along the bowl front and curves in under it. | Implemented, awaiting user review |
| 2026-10-15 | Underside red reduced to three light lines (front-row columns under the stairs and gate) plus tip bottoms; bowl's right foot flares in a black curve into the island; red step limited to the front of the gate. | Implemented, awaiting user review |
| 2026-10-15 | Bowl's right end is a D (rounded bottom, r30) over dark island blocks; stairs remade with chunky 7.5 steps: explorer's top landing at the stem's front-left, two steps down to the tower, six steps along the stem to the gate. | Implemented, awaiting user review |
| 2026-10-15 | Island cut back so the bowl sits near its right edge; stronger D on the bowl; stairs remixed (two steps to the tower, nine small steps along the stem, red tread edges); explorer rebuilt as an animated pixel-art sprite (scarf flutter, breathing, visor glint, glance, wave; reduced-motion aware). | Implemented, awaiting user review |

For each later review, record the exact file, decision, and approval status. Do not mark proposals approved without a user decision.
