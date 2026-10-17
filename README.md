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
| `island/fuse.js` | The energy pulse's route up the stairs and around the island edges, and the floating pose. |
| `island/chip.js` | Chip, the island keeper: model (built from the island's own stone, atlases and shaders), poses and expressions. |
| `island/keeper.js` | Chip alive on the island: its routine, hops, the ember, chores and visitor interactions. |
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
- **Chip, the island keeper** (`island/keeper.js`), arrives once the live island has taken over, so the first frame still matches the loading artwork. Its routine is the island's story: it squeezes out of the niche at the top of the stairs, takes the ember resting there, hops down the stairs carrying it, walks into the gate and tosses it in. That lights the fuse: the gate rings and the pulse climbs the stairs Chip came down. Then a few chores on the island (looking around, sweeping, sitting, a short nap if nobody moves for 20 s) and back up for the ember, which has rekindled in the niche. The gate is lit roughly every 30 s; it keeps breathing in between.
- Visitors can hover Chip (it waves; the cursor changes), click it (it jumps; click again quickly for a twirl, even mid-stairs with the ember), click the open island (it hops there) and hover *Explore games* (it waves). With reduced motion Chip stands still by the gate and the fuse stays unlit.
- The pulse no longer runs on a fixed loop: the shaders take a `fuseTime` uniform (seconds since lit) that Chip drives through `model.animate(time, motion, fuse)`. Without a fuse value the old 6.5 s cycle runs, so the island still works if Chip cannot load.
- Chip's design: `design/chip/concept.html` renders the concept sheet (turnaround, poses, expressions, Chip on the island) with the live modules; `design/concepts/chip-concept-v3.png` is the approved render. The menu footer still shows the earlier voxel explorer (`assets/explorer.png`).
- The 33 "already non-indexed" console warnings come from the island's original geometry code; they are harmless.
- Earlier voxel island (`js/island.js`, `js/explorer.js`, `assets/sculpture*.webp`, `assets/island.bin`, `tools/sculpture-vox.js`, `tools/build-sculpture.js`, `demo.html`) is no longer on the home page and is kept for reference.
- The `games.html` link is a placeholder until that page exists.

## Studio and Contact (`studio.html`, `contact.html`, `scenes/`)

Both pages carry a live diorama built from the island's own pieces, so every scene on the site shares one look: the photographed
stone atlases, chipped and bevelled blocks with relief (`fractureGeometry`), the same art lighting and the island's camera
angle. `island/` is not modified (its files are locked to the loading artwork by the tests).

| File | Responsibility |
| --- | --- |
| `scenes/shading.js` | The island's lighting shader with per-scene red point lights and a key-light level. |
| `scenes/kit.js` | Block builder: chipped polygons, atlas tiles at a constant pixel density, crimson cubes, pixel wood, paint. |
| `scenes/stage.js` | The island camera, a slow float, a lean toward the pointer, pauses off screen and with reduced motion. |
| `scenes/mailbox.js` | Contact: a crimson mailbox of ~400 small cubes on a stone post, envelope, broken columns, rubble, Chip. |
| `scenes/workshop.js` | Studio: pixel-wood bench, an unfinished stone b, a red drawing of the b, tools, loose cubes, Chip. |
| `scenes/preview.html` | Dev preview: `?scene=mailbox|workshop&w=&h=&zoom=&at=x,y,z`. |
| `js/contact-form.js` | Labelled form with validation. It posts JSON to the form's `data-endpoint`; with none set it says plainly that nothing was sent. |

- The envelope settles into the mailbox (and Chip hops) only after the server confirms a send, never on submit alone.
  `contact.html?deliver` plays it once for review.
- The contact topics (Our games, Working together, Press, Something else) are placeholders until the real ones are chosen.
- The Studio process copy is generic; real examples from the studio's work can replace it later.
