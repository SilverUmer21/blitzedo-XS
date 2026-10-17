# Ignition — Blitzedo motion identity

A small ivory-hot pixel becomes a stone world. Red energy wakes the stairs and gate. The camera rushes through the opening; the fragments collect into the exact studio wordmark and land with an original synthesized sound sting. The final spark remains under “PLAY BEYOND.”

## Preview

Run `npm run dev`, then open `/intro.html`.

| Route | Behavior |
| --- | --- |
| `/intro.html` | 12.8-second studio ident with sound enabled after pressing Play. |
| `/intro.html?cut=web` | 7-second website cut. |
| `/intro.html?cut=web&enter=1` | Website cut, then navigation to the existing homepage. Skip remains available. |
| `/intro.html?autoplay=1` | Muted autoplay, except with reduced motion. |

The production homepage is unchanged. This branch adds a separate intro page for review before integration.

## Art and timing

The animation uses the existing `island/assets/sculpture-fallback-v13.webp` and `assets/wordmark.svg`. It is authored as a deterministic **2.5D Canvas animation** rather than a new 3D model: tile assembly, camera-scale motion, emissive masks, a perspective particle corridor, and wordmark particles. It works without WebGL and adds no runtime libraries or external assets.

| Master time | Shot |
| --- | --- |
| 0–1.5 s | The spark; short electronic ignition. |
| 1.5–3.4 s | Stone fragments assemble around the gate. |
| 3.4–5.4 s | The red light front climbs the sculpture; camera creeps forward. |
| 5.4–6.2 s | Accelerated push into the doorway. |
| 6.2–7.8 s | A rush through red pixel fragments. |
| 7.8–9.3 s | Fragments resolve into the exact logo; bass and chord hit at 8.85 s. |
| 9.3–12.8 s | A burn crosses “blit”; PLAY BEYOND resolves; logo hold. |

Both cuts use the same scene clock and score timing. The website cut compresses the master timeline. Sound begins only after an explicit play action. Reduced motion shows the final logo and offers manual playback; off-tab playback pauses. Space toggles playback, the timeline seeks, and fullscreen and replay are available.

## Source

- `motion/renderer.js`: deterministic timeline and artwork rendering.
- `motion/sound.js`: seeded stereo score synthesis; no licensed music or samples.
- `motion/intro.js`: controls, audio, cuts, and browser video recording.
- `motion/intro.css`: preview page and mobile layout.
- `tools/render-intro.mjs`: offline MP4/WAV export from the same renderer.

The page's **Save film** button records the canvas and stereo audio as WebM (or MP4 where the browser supports it). Keep the tab visible while recording. This browser export follows realtime frame delivery; the offline exporter produces consistent 30 fps frames.

## Offline export

Requires Node, ffmpeg, and `@napi-rs/canvas`. This dependency is for exporting only. Install it in a separate tooling location or make it available through Node resolution; the website needs no installation.

```sh
node tools/render-intro.mjs /absolute/output/directory
node tools/render-intro.mjs /absolute/output/directory --web
node tools/render-intro.mjs /absolute/review/directory --stills
```

MP4 exports are 1920 × 1080, 30 fps, H.264/AAC, with matching stereo WAV audio. Exports are separate deliverables and are not committed as large binary files.

## Validation

- Existing repository checks pass (`npm test`).
- JavaScript parses and the patch passes `git diff --check`.
- Reviewed stone assembly, gate entry, particle transition, logo impact, and final hold as exported frames.
- Browser playback reaches the final logo with replay and studio navigation; timeline and cut controls were checked separately.
- MP4 stream dimensions, frame rate, audio tracks, duration, and audio peak were checked after export.

The effect intentionally uses the approved artwork as its source, so it cannot orbit behind the sculpture. A future true-3D film can reuse this timing and score if different camera angles are needed.
