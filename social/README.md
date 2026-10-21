> **Current version: [`v2/`](v2/README.md)**, the 3D reel "One pixel. One strike. One door." (`v2/out/blitzedo-one-pixel-one-strike-one-door-9x16.mp4`). The piece below is the first version, built on the site's island, kept for reference.

# Social motion piece: "Light the gate"

A 21.5 s, 1080 x 1920 (9:16) reel for Reels, TikTok and Shorts, made from the site's own island, Chip and wordmark.
`out/blitzedo-light-the-gate-9x16.mp4` is the finished video (H.264 + AAC, about -13 LUFS).

**The idea.** Blitzedo is *blit* (a pixel copy) plus *blitz* (a strike), so every cut is a blit: a stepped, tile-by-tile
copy of one picture over another. One red pixel runs through the piece. It draws the pixel b (the favicon), hops into the
real 3D island as the ember in the niche, rides Chip's cap down the stairs, is tossed into the gate and lights it. The
strike travels out of the 3D scene into the 2D grid as a ripple of cells, the camera dives through the gate, and the last
blit lands on the site's own "Play beyond" end card. The fuse bar under the picture burns for the whole piece.

**What is 3D and what is 2D.** The island and Chip are the live three.js scene from `island/` (not modified). Everything
around them (grid, sparks, captions, viewport frame, fuse bar, wipes, wordmark, end card) is a 2D canvas on a 30 px grid.

## Files

| File | Purpose |
| --- | --- |
| `reel.js` | The whole piece as a pure function of the frame number (seeded, so any frame can be rendered or sought). |
| `reel.html` | Live preview with play and scrub: `npm run dev`, then open `/social/reel.html`. |
| `render.mjs` | Headless Chromium + ffmpeg renderer. `node social/render.mjs video social/out/silent.mp4`, or `stills 4,9.5,15 dir`. |
| `audio.py` | Synthesises the soundtrack (numpy only, no samples) from `silent.events.json`, which `render.mjs` writes next to the video. |

Rebuild: `node social/render.mjs video social/out/silent.mp4` (about 9 minutes with software GL), then
`python3 social/audio.py social/out/silent.events.json social/out/soundtrack.wav`, then mux with
`ffmpeg -i silent.mp4 -i soundtrack.wav -filter_complex "[1:a]volume=-6.6dB,alimiter=limit=0.89[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest out.mp4`.
Needs Node 18+, `playwright` (global or in `tools/`), ffmpeg and Python with numpy. Everything is free and open source.

Copy used (editable in `reel.js`): "It starts with one pixel.", "Then a small world wakes up.", "Someone has to light the way."
and, on the end card, the Studio page's own line "We build worlds we want to get lost in." with the site address
`blitzedo-xs.vercel.app` (the share-link address used in the repo).
