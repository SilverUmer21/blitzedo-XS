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
- The sculpture is generated, not hand-drawn: `tools/sculpture-vox.js` builds it as pixel-art voxels in three.js (2.5-unit voxels, 6 per big block, one flat colour per face). See [design/SCULPTURE.md](design/SCULPTURE.md) for the method, palette, texture rules, gate light, stair path and the reference comparison. Re-render it with `cd tools && npm install && cd .. && node tools/build-sculpture.js` (set `CHROMIUM_PATH` to use an installed Chromium). If the output size changes, update the `width`/`height` on the `<img>` in `index.html`.
- The explorer is a 3D voxel figure rendered by the build into 14 animation frames (`assets/explorer.png`) and played by `js/explorer.js`, placed on the landing via the stage's `data-explorer` attribute (written to `assets/sculpture.json`; copy into `index.html` after a rebuild).
- The artwork is rendered on pure black and shown with `mix-blend-mode: screen`, so it blends into the page background.
- Links to `games.html`, `studio.html` and `contact.html` are placeholders until those pages exist.
- `demo.html` is a texture demo of the home page (switch between the live render, the old flat red and the pixel stone demo); it is not linked from the site.
- The wordmark is an inline SVG (also `assets/wordmark.svg`), built from Inter Tight outlines by `tools/wordmark-glyphs.py` and `tools/wordmark-svg.py` (needs `pip install fonttools brotli`).
