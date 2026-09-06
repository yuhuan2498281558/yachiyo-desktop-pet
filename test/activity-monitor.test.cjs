const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scanCodexActivity, CodexActivityMonitor } = require('../src/codex-activity.cjs');
const event = (type) => `${JSON.stringify({ type: 'event_msg', payload: { type } })}\n`;
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-activity-'));
  const sessions = path.join(root, 'sessions');
  fs.mkdirSync(sessions);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, file: path.join(sessions, 'test.jsonl') };
}

test('unchanged files are not reread; append, truncation and deletion update cached state', (t) => {
  const { root, file } = fixture(t);
  const cache = new Map();
  const metrics = {};
  const scan = () => scanCodexActivity({ codexHome: root, cache, metrics });
  fs.writeFileSync(file, event('user_message'));
  assert.equal(scan().working, true);
  assert.equal(metrics.filesRead, 1);
  assert.equal(scan().working, true);
  assert.equal(metrics.filesRead, 0);
  fs.appendFileSync(file, event('task_complete'));
  assert.equal(scan().working, false);
  assert.equal(metrics.filesRead, 1);
  fs.writeFileSync(file, event('turn_aborted'));
  assert.equal(scan().outcome, 'failed');
  fs.unlinkSync(file);
  assert.equal(scan().activeCount, 0);
  assert.equal(cache.size, 0);
});

test('worker reports lifecycle changes without duplicate callbacks and stops cleanly', async (t) => {
  const { root, file } = fixture(t);
  fs.writeFileSync(file, event('user_message'));
  const received = [];
  let workerError;
  const monitor = new CodexActivityMonitor({ codexHome: root, pollMs: 50,
    onError: (_event, error) => { workerError = error; } });
  // Stop before deleting the fixture, including on assertion failure.
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('worker lifecycle timeout')), 5000);
      monitor.start((activity) => {
        received.push(activity);
        if (activity.working) {
          setTimeout(() => fs.appendFileSync(file, event('task_complete')), 180);
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    assert.equal(workerError, undefined);
    assert.deepEqual(received.map((entry) => entry.working), [true, false]);
  } finally {
    await monitor.stop();
  }
  assert.equal(monitor.worker, null);
});
