const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  DiagnosticLog,
  buildRecord,
  describeCodexTransition,
  sanitizeDetails
} = require('../src/diagnostics.cjs');

function makeLogPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yachiyo-diag-')), 'diagnostics.jsonl');
}

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('buildRecord keeps status fields and drops conversation-like keys', () => {
  const record = buildRecord('codex', 'task-started', {
    activeCount: 1,
    text: 'user prompt that must never be stored',
    prompt: 'ignore me',
    payload: { type: 'user_message', text: 'secret' },
    filePath: 'C:\\Users\\me\\.codex\\sessions\\rollout.jsonl'
  }, new Date('2026-08-25T10:00:00.000Z'));

  assert.deepEqual(record, {
    ts: '2026-08-25T10:00:00.000Z',
    category: 'codex',
    event: 'task-started',
    activeCount: 1
  });
  assert.equal(JSON.stringify(record).includes('secret'), false);
  assert.equal(JSON.stringify(record).includes('prompt'), false);
});

test('sanitizeDetails rejects unknown categories, free text, and forbidden keys', () => {
  assert.equal(buildRecord('network', 'ping', { ok: true }), null);
  assert.equal(buildRecord('codex', 'Task Started', { activeCount: 1 }), null);
  assert.deepEqual(sanitizeDetails({
    message: 'turn contents',
    outcome: 'failed',
    note: 'has spaces so it is dropped'
  }), { outcome: 'failed' });
});

test('describeCodexTransition emits lifecycle events without copying extra fields', () => {
  const started = describeCodexTransition(
    { working: false, activeCount: 0, outcome: 'ready', text: 'prior turn' },
    { working: true, activeCount: 2, outcome: null, payload: 'tool output' }
  );
  assert.deepEqual(started, { event: 'task-started', details: { activeCount: 2 } });

  const completed = describeCodexTransition(
    { working: true, activeCount: 1, outcome: null },
    { working: false, activeCount: 0, outcome: 'ready', transcript: 'final answer' }
  );
  assert.deepEqual(completed, {
    event: 'task-complete',
    details: { outcome: 'ready', activeCount: 0 }
  });

  const aborted = describeCodexTransition(
    { working: true, activeCount: 1, outcome: null },
    { working: false, activeCount: 0, outcome: 'failed' }
  );
  assert.deepEqual(aborted, {
    event: 'task-aborted',
    details: { outcome: 'failed', activeCount: 0 }
  });
});

test('DiagnosticLog writes the listed event classes as JSONL', () => {
  const filePath = makeLogPath();
  const log = new DiagnosticLog(filePath);
  assert.equal(log.write('codex', 'task-started', { activeCount: 1 }), true);
  assert.equal(log.write('form', 'switch', { mode: 'kaguya', working: true }), true);
  assert.equal(log.write('animation', 'walk-start', { direction: 1 }), true);
  assert.equal(log.write('config', 'invalid', { reason: 'SyntaxError' }), true);
  assert.equal(log.write('codex', 'task-started', { text: 'do not write this prompt' }), true);

  const lines = readLines(filePath);
  assert.equal(lines.length, 5);
  assert.equal(lines[0].category, 'codex');
  assert.equal(lines[1].category, 'form');
  assert.equal(lines[2].category, 'animation');
  assert.equal(lines[3].category, 'config');
  assert.equal(Object.prototype.hasOwnProperty.call(lines[4], 'text'), false);
  assert.equal(fs.readFileSync(filePath, 'utf8').includes('prompt'), false);
});

test('DiagnosticLog rotates so the file cannot grow without a cap', () => {
  const filePath = makeLogPath();
  const log = new DiagnosticLog(filePath, { maxBytes: 2048, keepBytes: 768 });
  for (let index = 0; index < 80; index += 1) {
    log.write('animation', 'command', { name: 'hop' });
  }
  const size = fs.statSync(filePath).size;
  assert.ok(size <= 2048, `log grew to ${size} bytes`);
  assert.ok(size >= 512, `rotation removed too much, size ${size}`);
  const lines = readLines(filePath);
  assert.ok(lines.length >= 3);
  assert.equal(lines.at(-1).event, 'command');
});
