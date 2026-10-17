import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

// Each page scene's loading picture must come from the scene as it is now: a stale one would jump when the 3D takes over.
const manifest = JSON.parse(fs.readFileSync(new URL('../scenes/posters/posters.json', import.meta.url)));
const sha = path => createHash('sha256').update(fs.readFileSync(new URL('../' + path, import.meta.url))).digest('hex');
for (const scene of ['mailbox', 'workshop']) {
  assert(manifest[scene], `${scene} has no loading picture`);
  for (const [path, expected] of Object.entries(manifest[scene].inputs))
    assert.equal(sha(path), expected, `${path} changed: re-make the ${scene} loading picture (tools/scene-poster.html, tools/poster/scene_finish.py)`);
  for (const [name, expected] of Object.entries(manifest[scene].pictures)) assert.equal(sha('scenes/posters/' + name), expected);
}
console.log('PASS: the mailbox and workshop loading pictures match their scenes.');
