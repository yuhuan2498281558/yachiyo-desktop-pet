const test = require('node:test');
const assert = require('node:assert/strict');
const { canAutoWalk, BehaviorCoordinator } = require('../src/renderer/behavior.js');

const idle = { wandering: true, visible: true, clickThrough: false, dragging: false,
  transient: false, sceneMode: 'none', working: false, identityMode: 'auto', yachiyoRenderer: 'sprite' };

test('Live2D cannot auto-walk even with an old enabled wandering preference', () => {
  assert.equal(canAutoWalk(idle), true);
  assert.equal(canAutoWalk({ ...idle, yachiyoRenderer: 'live2d' }), false);
  assert.equal(canAutoWalk({ ...idle, yachiyoRenderer: 'sprite-hd' }), false);
  assert.equal(canAutoWalk({ ...idle, identityMode: 'kaguya', working: true, yachiyoRenderer: 'sprite-hd' }), true);
  assert.equal(canAutoWalk({ ...idle, identityMode: 'kaguya', working: true, yachiyoRenderer: 'live2d' }), true);
  for (const override of [{ dragging: true }, { transient: true }, { visible: false },
    { sceneMode: 'starry-sea' }, { clickThrough: true }, { wandering: false }, { working: true }]) {
    assert.equal(canAutoWalk({ ...idle, ...override }), false, JSON.stringify(override));
  }
});

test('drag owns the character; latest work and preferences are deferred until release', () => {
  const coordinator = new BehaviorCoordinator();
  coordinator.beginDrag();
  coordinator.defer('work', { working: true });
  coordinator.defer('preferences', { size: 'large' });
  coordinator.defer('work', { working: false });
  assert.equal(coordinator.acceptsWalking(idle, true), false);
  assert.equal(coordinator.acceptsWalking(idle, false), true);
  const pending = coordinator.endDrag();
  assert.deepEqual(pending.get('work'), { working: false });
  assert.deepEqual(pending.get('preferences'), { size: 'large' });
  assert.equal(coordinator.endDrag().size, 0);
});

test('work counts and duplicate notifications never restart the same transformation', () => {
  const coordinator = new BehaviorCoordinator();
  assert.equal(coordinator.acceptWork({ mode: 'auto', working: true, activeCount: 1 }), true);
  assert.equal(coordinator.acceptWork({ mode: 'auto', working: true, activeCount: 2 }), false);
  assert.equal(coordinator.acceptWork({ mode: 'auto', working: false, outcome: 'failed' }), true);
  assert.equal(coordinator.acceptWork({ mode: 'auto', working: false, outcome: 'ready' }), false);
  assert.equal(coordinator.acceptWork({ mode: 'yachiyo', working: false }), true);
});
