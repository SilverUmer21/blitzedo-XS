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
- The sculpture is generated, not hand-drawn: `tools/sculpture3d.js` builds it from large charcoal stone cubes in three.js (9-unit cubes for the letter, seen from the reference's low front-leaning camera, 3-unit blocks at curves, steps and the arch, 15 / 7.5 / 3.75-unit cubes for the bowl-shaped foundation) with chunky chipped-stone pixel textures. No block is painted red: the red comes from a strong red key light that makes tops and edges glow and casts shadows, red lights in the doorway, and a near-black fill. A red-only glow is added in a 2D pass. Re-render it with `cd tools && npm install && cd .. && node tools/build-sculpture.js` (set `CHROMIUM_PATH` to use an installed Chromium; WebGL runs on the software renderer). If the output size changes, update the `width`/`height` on the `<img>` in `index.html`.
- The artwork is rendered on pure black and shown with `mix-blend-mode: screen`, so it blends into the page background.
- Links to `games.html`, `studio.html` and `contact.html` are placeholders until those pages exist.
