const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { SpriteActionQueue } = require('../src/renderer/sprite-actions.js');

function createQueue() {
  const events = [];
  const queue = new SpriteActionQueue({
    onStart: (action) => events.push(`start:${action.kind}:${action.name}`),
    onStop: (action) => events.push(`stop:${action.kind}:${action.name}`)
  });
  return { queue, events };
}

test('exposes SpriteActionQueue on the renderer window', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'sprite-actions.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  assert.equal(typeof sandbox.window.SpriteActionQueue, 'function');
  const queue = new sandbox.window.SpriteActionQueue();
  queue.append({ kind: 'once', name: 'jump' });
  assert.equal(queue.transient, true);
});

test('append plays immediately when idle and then runs once-shots in order', () => {
  const { queue, events } = createQueue();
  const first = queue.append({ kind: 'once', name: 'waiting' });
  const second = queue.append({ kind: 'once', name: 'jump' });

  assert.deepEqual(queue.snapshot(), {
    current: { kind: 'once', name: 'waiting' },
    pending: [{ kind: 'once', name: 'jump' }]
  });
  assert.equal(queue.transient, true);

  queue.complete(first);
  assert.deepEqual(queue.snapshot(), {
    current: { kind: 'once', name: 'jump' },
    pending: []
  });
  queue.complete(second);
  assert.deepEqual(queue.snapshot(), { current: null, pending: [] });
  assert.deepEqual(events, [
    'start:once:waiting',
    'start:once:jump'
  ]);
});

test('replace swaps a loop immediately and does not interrupt a one-shot', () => {
  const { queue, events } = createQueue();
  queue.replace({ kind: 'loop', name: 'right' });
  queue.replace({ kind: 'loop', name: 'left' });
  assert.deepEqual(queue.snapshot().current, { kind: 'loop', name: 'left' });

  const hop = queue.interrupt({ kind: 'once', name: 'jump' });
  queue.replace({ kind: 'loop', name: 'kaguyaRun' });
  assert.deepEqual(queue.snapshot(), {
    current: { kind: 'once', name: 'jump' },
    pending: [{ kind: 'loop', name: 'kaguyaRun' }]
  });

  queue.complete(hop);
  assert.deepEqual(queue.snapshot(), {
    current: { kind: 'loop', name: 'kaguyaRun' },
    pending: []
  });
  assert.deepEqual(events, [
    'start:loop:right',
    'stop:loop:right',
    'start:loop:left',
    'stop:loop:left',
    'start:once:jump',
    'start:loop:kaguyaRun'
  ]);
});

test('replace of the same loop is a no-op', () => {
  const { queue, events } = createQueue();
  queue.replace({ kind: 'loop', name: 'working' });
  queue.replace({ kind: 'loop', name: 'working' });
  assert.deepEqual(queue.snapshot(), {
    current: { kind: 'loop', name: 'working' },
    pending: []
  });
  assert.deepEqual(events, ['start:loop:working']);
});

test('interrupt cancels current and pending without running onComplete', () => {
  const { queue, events } = createQueue();
  let finished = false;
  queue.interrupt({
    kind: 'once',
    name: 'transform',
    onComplete: () => {
      finished = true;
    }
  });
  queue.append({ kind: 'once', name: 'waiting' });
  queue.interrupt({ kind: 'once', name: 'jump' });

  assert.equal(finished, false);
  assert.deepEqual(queue.snapshot(), {
    current: { kind: 'once', name: 'jump' },
    pending: []
  });
  assert.deepEqual(events, [
    'start:once:transform',
    'stop:once:transform',
    'start:once:jump'
  ]);
});

test('clear drops the queue so idle/gaze can take over', () => {
  const { queue, events } = createQueue();
  queue.replace({ kind: 'loop', name: 'working' });
  queue.append({ kind: 'once', name: 'hello' });
  queue.clear();
  assert.deepEqual(queue.snapshot(), { current: null, pending: [] });
  assert.equal(queue.transient, false);
  assert.deepEqual(events, [
    'start:loop:working',
    'stop:loop:working'
  ]);
});
