"""Turn a scene's first-frame capture (tools/scene-poster.html, 2x) into its loading pictures and refresh the manifest.

Usage: python tools/poster/scene_finish.py mailbox|workshop capture.png
Writes scenes/posters/<scene>-1520.webp (the 2x capture) and <scene>-760.webp (1x, for phones), and records in
scenes/posters/posters.json the sources they were made from; tests/scene-posters.mjs fails when one changes.
"""
import hashlib, json, sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
out = root / 'scenes' / 'posters'
scene, capture = sys.argv[1], sys.argv[2]
SOURCES = ['scenes/kit.js', 'scenes/shading.js', 'scenes/stage.js', f'scenes/{scene}.js', 'island/chip.js', 'island/stone.js',
           'island/reference-shading.js', 'island/assets/pixel-stone-v9.webp', 'island/assets/pixel-red-v9.webp', 'island/assets/pixel-edge-v9.webp']

image = Image.open(capture).convert('RGBA')
big = out / f'{scene}-1520.webp'
small = out / f'{scene}-760.webp'
image.resize((1520, round(1520 * image.height / image.width)), Image.Resampling.LANCZOS).save(big, 'WEBP', quality=90, method=6)
# Premultiplied resampling keeps the transparent edges free of dark fringes.
image.convert('RGBa').resize((760, round(760 * image.height / image.width)), Image.Resampling.LANCZOS).convert('RGBA').save(small, 'WEBP', quality=90, method=6)

sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest_path = out / 'posters.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
manifest[scene] = {'pictures': {p.name: sha(p) for p in (big, small)}, 'inputs': {s: sha(root / s) for s in SOURCES}}
manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n', encoding='utf-8', newline='\n')
print(scene, big.stat().st_size, small.stat().st_size)
