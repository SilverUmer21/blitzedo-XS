# Blitzedo website

The design foundation for Blitzedo's studio website.

Start with [DESIGN.md](DESIGN.md) for approved directions, responsive layouts, page structure, and future motion ideas.

- [Concept artwork](design/concepts/README.md)
- [Actual game references](design/game-references/README.md)
- [Iteration checklist](design/ITERATION.md)

Current phase: design documentation and reference artwork, plus the Home page. Other pages, animation, and mascot development follow static design approval.

## Home page

Open `index.html` in a browser (no build step needed).

- `css/styles.css` holds the layout, tokens (`:root`) and responsive rules. The primary action uses `#C4161B`, a touch deeper than the documented `#D51D22` (hover brings it back to `#D51D22`). Type is Inter Tight (SIL OFL), self-hosted in `assets/fonts/`.
- `assets/sculpture.webp` (and a 1000px variant) is the voxel b sculpture, with its explorer, red doorway lighting and floating foundation.
- The sculpture is generated, not hand-drawn: `tools/sculpture3d.js` builds it in three.js from one family of large charcoal stone cubes. The b is 3 cubes deep, with a stem 2 cubes wide and 8 tall and a bowl 5 wide and 5 tall, built from 15-unit cubes for flat runs and 7.5 / 3.75-unit blocks at its rounded corner, arch and steps; the island is a round disc of 15-unit cubes over a deep, pointed gem cone of 7.5 and 3.75-unit tiers. Each cube has a chunky chipped-stone pixel texture. No block is painted red: a red spotlight from above-left lights the tops and casts shadows (some cubes are near-black stone, so tops alternate red and black), red lights sit in the doorway, thin red area lights run along the b's edges, and a near-black fill keeps the rest dark. The scene is rendered pixel-native: at 1/6 resolution, quantised to a small charcoal and red palette with a stepped glow, then scaled up without smoothing, so edges and light read as pixel art. Re-render it with `cd tools && npm install && cd .. && node tools/build-sculpture.js` (set `CHROMIUM_PATH` to use an installed Chromium; WebGL runs on the software renderer). If the output size changes, update the `width`/`height` on the `<img>` in `index.html`.
- The artwork is rendered on pure black and shown with `mix-blend-mode: screen`, so it blends into the page background.
- Links to `games.html`, `studio.html` and `contact.html` are placeholders until those pages exist.
