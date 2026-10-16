"""Downsample the 2x browser render into the loading artwork and refresh its provenance manifest.

Usage: python tools/poster/finish.py poster-2x.png
"""
import hashlib, json, sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
assets = root / 'island' / 'assets'
poster = assets / 'sculpture-fallback-v13.webp'
manifest_path = assets / 'sculpture-fallback-v13.render.json'

image = Image.open(sys.argv[1]).convert('RGBA')
# Premultiplied resampling keeps the transparent edges free of dark fringes.
image = image.convert('RGBa').resize((850, 1008), Image.Resampling.LANCZOS).convert('RGBA')
image.save(poster, 'WEBP', lossless=True, quality=100, method=6)

sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
inputs = {f'island/{name}': sha(root / 'island' / name) for name in ['world.js', 'stone.js', 'reference-shading.js', 'composition.js', 'fuse.js']}
inputs.update({f'island/assets/pixel-{kind}-v9.png': sha(assets / f'pixel-{kind}-v9.png') for kind in ['stone', 'red', 'edge']})
manifest = {
    'renderer': 'Browser WebGL via tools/poster/capture.html (live island modules, 2x render, premultiplied Lanczos downsample)',
    'artworkSha256': sha(poster),
    'inputs': inputs,
}
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
print('poster', poster, manifest['artworkSha256'])
