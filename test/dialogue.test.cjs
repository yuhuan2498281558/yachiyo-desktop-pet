const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadDialogue() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dialogue.js'), 'utf8');
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => 0;
  const sandbox = { window: {}, Math: deterministicMath };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.petDialogue;
}

test('dialogue pools avoid the last three lines', () => {
  const dialogue = loadDialogue();
  const lines = Array.from({ length: 4 }, () => dialogue.pick('yachiyo.hello'));
  assert.equal(new Set(lines).size, 4);
});

test('dialogue contexts resolve for both identities and scenes', () => {
  const dialogue = loadDialogue();
  assert.ok(dialogue.pickFor('yachiyo', 'waiting'));
  assert.ok(dialogue.pickFor('kaguya', 'working'));
  assert.ok(dialogue.pickFor('kaguya', 'hop'));
  assert.ok(dialogue.pickFor('yachiyo', 'starrySea'));
  assert.equal(dialogue.pick('missing.pool'), '');
});
