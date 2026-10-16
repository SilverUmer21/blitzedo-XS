# Blitzedo website

The design foundation for Blitzedo's studio website.

Start with [DESIGN.md](DESIGN.md) for approved directions, responsive layouts, page structure, and future motion ideas.

- [Concept artwork](design/concepts/README.md)
- [Actual game references](design/game-references/README.md)
- [Iteration checklist](design/ITERATION.md)

Current phase: design documentation and reference artwork, plus the Home page. Other pages, animation, and mascot development follow static design approval.

## Home page

Run `npm run dev` and open `http://localhost:8000` (Node 18+, no install or build). The island is an ES module, so the page
needs a local server rather than a `file://` URL. `npm test` checks the island's loading, materials, motion timing and framing.

- `css/styles.css` holds the layout, tokens (`:root`) and responsive rules. The primary action uses `#AE1212` (hover `#C4161B`). Type is Inter Tight (SIL OFL), self-hosted in `assets/fonts/`.
- The wordmark is an inline SVG (also `assets/wordmark.svg`): a pixel "blit" that assembles on load and on hover, with a red glow sweep and warm sparks, running into a smooth "zedo". Built from Inter Tight outlines by `tools/wordmark-glyphs.py` and `tools/wordmark-svg.py` (needs `pip install fonttools brotli`). `js/menu.js` drives the hover replay and the mobile menu.

### The island (`island/`)

The hero is a live Three.js scene of fractured stone: a tall b stem, a curved bowl with an arched red gate, a turning staircase and a floating island with hanging clusters and loose fragments. It comes from the blitzedo-home revision 13 export (`blitzedo-home-source-v13`), which holds its history, reference photos and artwork tools.

| File | Responsibility |
| --- | --- |
| `island/scene.js` | Renderer, loading handoff, frame loop, pointer parallax, reduced motion, offscreen suspension. Adapted to this page's markup. |
| `island/world.js` | Procedural stone b, stairs, island and fragments (no model file). |
| `island/reference-shading.js`, `island/stone.js` | Lighting shaders, texture loading and red masks. |
| `island/fuse.js` | Gate breathing, the 6.5 s energy pulse up the stairs and around the island edges, and the floating pose. |
| `island/composition.js` | The orthographic camera shared by the live scene and the loading artwork. |
| `island/assets/` | Texture atlases, the loading artwork (`sculpture-fallback-v13.webp`) and vendored Three.js 0.180.0 with its license. |
| `js/hero.js` | Loads the island module and shows Retry if it can't download. |

- **Keep the loading artwork and the first live frame identical.** The stage keeps the artwork's 710 × 842 proportions because the camera frames the sculpture from that aspect; the canvas stays hidden until every material has rendered. `tests/sculpture-startup.mjs` hashes the island sources and textures against the artwork's provenance manifest, so any change to geometry, shaders, camera or textures fails until the artwork is regenerated. Do not silence that check. To regenerate it (Windows is fine, Python needs Pillow):
  1. `node tools/poster/capture.mjs poster-2x.png`, then open `http://localhost:8001/tools/poster/capture.html`. It renders the quiet first frame with the island's own modules at twice the size and saves it.
  2. `python tools/poster/finish.py poster-2x.png` downsamples it into `island/assets/sculpture-fallback-v13.webp` and rewrites the manifest.
  
  This path was checked against the original Mesa render of the unchanged island: mean difference about 1/255, with only antialiasing differences on 0.7% of edge pixels.
- Red energy follows the existing red texture and edge masks; charcoal faces never light up.
- **Stair tuning:** open `http://localhost:8000/?tune` for a panel (`island/tuner.js`) that changes only the twenty stair treads: base red, brightness, hue, saturation, glow, wear (the dark chips), a lit pixel edge on each step and the climbing light (baked at 0.87: lower treads dimmer, the top ones full red; slider values are relative to that). It patches the live red shader only; values persist in the browser, *Hold: original* compares with the approved look and *Copy values* exports them. A chosen look must then be baked into the island and the loading artwork regenerated.
- Reduced motion and offscreen/background suspension stop the animation. There is no on-page Pause control (removed by design decision). Mobile caps the pixel ratio and lowers it if frames are slow.
- The island has no character. A new mascot is planned; the menu footer still shows the earlier voxel explorer (`assets/explorer.png`).
- Earlier voxel island (`js/island.js`, `js/explorer.js`, `assets/sculpture*.webp`, `assets/island.bin`, `tools/sculpture-vox.js`, `tools/build-sculpture.js`, `demo.html`) is no longer on the home page and is kept for reference.
- Links to `games.html`, `studio.html` and `contact.html` are placeholders until those pages exist.
