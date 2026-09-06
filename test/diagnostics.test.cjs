const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Diagnostics } = require('../src/diagnostics.cjs');

test('diagnostics rotate within a fixed budget and omit session content', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-diagnostics-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = new Diagnostics(dir, { maxBytes: 1024 });
  for (let i = 0; i < 100; i++) log.record('activity', { working: true, activeCount: i,
    text: 'private session text', message: 'private error text', filePath: 'private path' });
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 2);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(Buffer.byteLength(content) <= 1024);
    assert.equal(content.includes('private'), false);
    content.trim().split('\n').forEach((line) => assert.equal(JSON.parse(line).event, 'activity'));
  }
});
