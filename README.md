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
- The sculpture is generated, not hand-drawn: `tools/sculpture-render.js` models and lights the voxel scene. Re-render it with `node tools/build-sculpture.js` (needs `playwright`; set `CHROMIUM_PATH` to use an installed Chromium). If the output size changes, update the `width`/`height` on the `<img>` in `index.html`.
- Links to `games.html`, `studio.html` and `contact.html` are placeholders until those pages exist.
