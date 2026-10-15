# Blitzedo website

The design foundation for Blitzedo's studio website.

Start with [DESIGN.md](DESIGN.md) for approved directions, responsive layouts, page structure, and future motion ideas.

- [Concept artwork](design/concepts/README.md)
- [Actual game references](design/game-references/README.md)
- [Iteration checklist](design/ITERATION.md)

Current phase: design documentation and reference artwork, plus the Home page. Other pages, animation, and mascot development follow static design approval.

## Home page

Open `index.html` in a browser (no build step needed).

- `css/styles.css` holds the layout, tokens (`:root`) and responsive rules. The primary action uses the documented red `#D51D22`.
- `assets/sculpture.webp` (and a 1000px variant) is the voxel b sculpture, with its explorer, red doorway lighting and floating foundation.
- The sculpture is generated, not hand-drawn: `tools/sculpture3d.js` builds it from real cubes in three.js (2-unit letter blocks, 8/4/2-unit foundation tiers, pixel-art textures on every face) and lights it with a shadow-casting key light, a red doorway light, emissive red surfaces and a red-only glow. Re-render it with `cd tools && npm install && cd .. && node tools/build-sculpture.js` (set `CHROMIUM_PATH` to use an installed Chromium; WebGL runs on the software renderer). If the output size changes, update the `width`/`height` on the `<img>` in `index.html`.
- The artwork is rendered on pure black and shown with `mix-blend-mode: screen`, so it blends into the page background.
- Links to `games.html`, `studio.html` and `contact.html` are placeholders until those pages exist.
