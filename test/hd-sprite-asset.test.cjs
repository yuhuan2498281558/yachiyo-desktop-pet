const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');

test('running uses the short-step profile redraw, never the retired front or wide-stride run', () => {
  const side = JSON.parse(fs.readFileSync(path.join(root, 'assets/sprites/yachiyo-hd-run-gentle-v5.json'), 'utf8'));
  const motion = JSON.parse(fs.readFileSync(path.join(root, 'assets/sprites/yachiyo-hd-motion-v3.json'), 'utf8'));
  assert.equal(motion.run.asset, side.asset);
  assert.equal(motion.run.sha256, side.atlasSha256);
  assert.equal(side.frameMs, 280);
  assert.deepEqual(side.eyeAnchor, [450, 185]);
  assert.equal(side.gait, 'short low steps with restrained hair and coat');
  assert.ok(side.bounds.every(([left, top, right, bottom]) => right - left <= 350 && bottom - top >= 680));
  assert.equal(side.headAlignment, 'shared eye anchor; no rectangular compositing');
  assert.ok(side.reference.includes('PDF page 21'));
  const renderer = fs.readFileSync(path.join(root, 'src/renderer/pet.js'), 'utf8');
  assert.ok(renderer.includes(side.asset));
  assert.ok(!renderer.includes('yachiyo-hd-run-v3.webp'));
  assert.ok(!renderer.includes('yachiyo-hd-run-side-v4.webp'));
  const files = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).build.files;
  assert.ok(files.includes('!assets/sprites/yachiyo-hd-run-v3.webp'));
  assert.ok(files.includes('!assets/sprites/yachiyo-hd-run-side-v4.webp'));
});

test('HD run and gaze assets are versioned and match recorded hashes', () => {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'assets/sprites/yachiyo-hd-motion-v3.json'), 'utf8'));
  assert.equal(metadata.sourceIdleSha256, '1ac3e29303fd2fdcb9b80a8adda7f6a582b2a36d086bdcba2c7400c70eaf0884');
  assert.deepEqual(metadata.run.size, [3072, 832]);
  assert.deepEqual(metadata.gaze.patch, [342, 110, 88, 40]);
  for (const asset of [metadata.run, metadata.gaze]) {
    const bytes = fs.readFileSync(path.join(root, 'assets/sprites', asset.asset));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
});

test('HD runtime uses the approved v003 atlas, with recorded provenance and eye-only changes', () => {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'assets/sprites/yachiyo-hd-idle-v3.json'), 'utf8'));
  const bytes = fs.readFileSync(path.join(root, 'assets/sprites', metadata.asset));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), metadata.atlasSha256);
  assert.equal(metadata.masterSha256, '275a7b896953c77cb07d33d5c80de7e34c968577a59402529af117a719fb4008');
  assert.deepEqual(metadata.frameSize, [768, 832]);
  assert.deepEqual(metadata.atlasSize, [2304, 832]);
  assert.equal(metadata.identicalAlpha, true);
  assert.equal(metadata.nonEyePixelsIdentical, true);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  const renderer = fs.readFileSync(path.join(root, 'src/renderer/pet.js'), 'utf8');
  assert.ok(renderer.includes(metadata.asset));
  assert.ok(!renderer.includes('yachiyo-hd-idle-v1.webp'));
  const files = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).build.files;
  assert.ok(files.includes('!assets/sprites/yachiyo-hd-idle-v1.webp'));
});
