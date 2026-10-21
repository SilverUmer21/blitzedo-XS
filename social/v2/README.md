# "One pixel. One strike. One door." (social motion piece, v2)

A ~24 s, 1080 x 1920 (9:16) reel for Reels, TikTok and Shorts. It does not use the island: it is built from the brand's own
atoms (the pixel b, the red doorway, ivory Inter Tight on near-black) and the two games' motifs, as real 3D with a 2D type
layer on top.

**The idea.** Blitzedo is *blit* (a pixel copy) plus *blitz* (a strike).
1. **One pixel.** A red cube falls through the dark onto a floor of glossy tiles (the site's 30 px grid, in 3D). The floor ripples
   and 2,100 small cubes rain down to build the pixel b.
2. **One strike.** Lightning hits the red pixel; the b detonates in slow motion, and the camera dives into the cloud.
3. **One door.** The debris swirls back together as the red doorway. The camera pushes through it.
4. **Worlds.** The same cubes become Orbit Shift's floral planet, orbit and arrow ship, then Harvest & Hearth's strawberry
   (each in its own palette, labelled with the line from the game's own title screen).
5. **Play beyond.** The cubes collapse into the b again, and a dolly zoom flattens the 3D b into the flat 2D pixel b, which
   shrinks into the wordmark's first letter. The rest of the wordmark assembles, then "Play beyond", the tagline, and the button.

## Files

| File | Purpose |
| --- | --- |
| `shapes.js` | Voxel formations: the b, the doorway, the planet, the ship, the strawberry (seeded, deterministic). |
| `stage.js` | three.js stage: bevelled glossy cubes, studio softbox environment, glass-black tiled floor with a mirrored reflection, bloom / depth of field / grain / vignette via `postprocessing`. |
| `film.js` | The 3D film as a pure function of time: cube physics and morph legs, floor ripples, bolt, portal, camera track, dolly zoom. |
| `overlay.js` | The 2D layer: kinetic type (variable-weight Inter Tight), game labels, the end card and the wordmark's pixel assembly (from `assets/wordmark.svg`), all on one paused GSAP timeline. |
| `index.html` | Page that composes both and exposes `seek(t)`. Open `/social/v2/index.html` with the dev server for a live look (`?t=6.5` jumps to a time). |
| `render.mjs` | Headless Chromium (software GL, no GPU) frame renderer with parallel workers, and the ffmpeg encode. |
| `audio.py` | Soundtrack synthesised with numpy (112 BPM, A minor), cut to the film's timeline. No samples. |

## Rebuild

```sh
cd social/v2 && npm install                       # three, gsap, postprocessing
node social/v2/render.mjs frames out/frames --workers 3        # add --scale .5 for a quick half-resolution preview
python3 social/v2/audio.py out/frames/timeline.json out/soundtrack.wav
node social/v2/render.mjs video out/frames out/silent.mp4
ffmpeg -i out/silent.mp4 -i out/soundtrack.wav -filter_complex "[1:a]acompressor=threshold=-24dB:ratio=3:attack=5:release=150:makeup=5,loudnorm=I=-14:TP=-1.5[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest out/final.mp4
```

Everything is free and open source: three.js, `postprocessing`, GSAP (all plugins are free), Chromium, ffmpeg, numpy. Time is
a pure function of the frame number, so any frame renders on its own and frames can be rendered in parallel.
