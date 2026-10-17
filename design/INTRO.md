# Ignition — Blitzedo motion identity

**The first pixel refuses to stay still.** Inside a heavy, unworked block, a red pixel pushes three times. Cracks spread across the stone. The block breaks, the pixel escapes, and the scattered matter gathers into the studio's world. The pixel enters its gate and wakes the red fuse. We follow it through the doorway; beyond it, the fragments become Blitzedo. One red pixel remains under “PLAY BEYOND.”

The idea is a studio turning raw possibility into playable worlds. Stone is potential; the pixel is the creative impulse; the gate is the invitation to play. The same pixel begins and ends the film, and its three-note sound returns at the logo. The gate rush, tunnel and logo choreography from the first cut are preserved.

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

The animation uses the existing `island/assets/sculpture-fallback-v13.webp`, `island/assets/pixel-stone-v9.webp` and `assets/wordmark.svg`. It is authored as a deterministic **2.5D Canvas animation**: a textured stone block with fractured faces, tile assembly, camera-scale motion, emissive masks, a perspective particle corridor, and wordmark particles. It works without WebGL and adds no runtime libraries or external assets.

| Master time | Shot |
| --- | --- |
| 0–1.58 s | A close-up of stone under pressure; three pulses spread red cracks. |
| 1.58–2.1 s | The stone fractures; the first pixel breaks free. |
| 2.1–3.55 s | The fragments gather into the studio world; the pixel arcs into its gate. |
| 3.4–5.4 s | The red light front climbs the sculpture; camera creeps forward. |
| 5.4–6.2 s | Accelerated push into the doorway. |
| 6.2–7.8 s | A rush through red pixel fragments. |
| 7.8–9.3 s | Fragments resolve into the exact logo; bass and chord hit at 8.85 s. |
| 9.3–12.8 s | A burn crosses “blit”; PLAY BEYOND resolves; logo hold. |

Both cuts use the same scene clock and score timing. The website cut compresses the master timeline while preserving the pitches of the sound signature. Sound begins only after an explicit play action. Reduced motion shows the final logo and offers manual playback; off-tab playback pauses. Space toggles playback, the timeline seeks, and fullscreen and replay are available.

## Sound concept

An original stereo score follows the material and movement: deep stone tension, short mineral resonances and grit, a fracture with scattered debris, the pixel passing across the frame, a sparking fuse, pressure building at the gate, and air rushing past the camera. A brief breath before the logo gives the final impact room to land.

The three opening pulses carry G–B-flat–D. On the logo, that same gesture returns an octave higher over a low chord. Filtered noise supplies physical texture; modal synthesis supplies stone resonance; panning and short room reflections create depth. Bass remains centered. Both exports are peak-normalized with headroom and a fade at the end. No recordings, third-party samples, music licensing, or network audio requests are involved.

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
- Reviewed the pressure pulses, fracture, pixel flight, stone assembly, gate entry, particle transition, logo impact, and final hold as exported frames.
- Compared seven frames from 3.7–10.8 seconds with the first version: the gate rush, tunnel, and logo choreography are pixel-identical.
- Synthesized both cuts at 44.1 and 48 kHz: all samples are finite, with a 0.89 maximum absolute sample value.
- Browser playback reaches the final logo with replay and studio navigation; timeline and cut controls were checked separately.
- Both MP4s have 1080p/30 H.264 video and 48 kHz stereo AAC audio, at 12.8 and 7 seconds. The studio mix measures −16.6 LUFS integrated and −0.7 dBTP after AAC encoding.

The effect intentionally uses the approved artwork as its source, so it cannot orbit behind the sculpture. A future true-3D film can reuse this timing and score if different camera angles are needed.
