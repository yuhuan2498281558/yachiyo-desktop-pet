const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DRAG_MOVE_INTERVAL,
  DRAG_START_DISTANCE,
  exceedsDragThreshold,
  mergeMovement
} = require('../src/renderer/interaction.js');

test('ignores pointer jitter below the drag threshold', () => {
  const origin = { x: 100, y: 100 };
  assert.equal(exceedsDragThreshold(origin, { x: 104, y: 103 }), false);
  assert.equal(exceedsDragThreshold(origin, { x: 105, y: 103 }), false);
});

test('starts dragging once the pointer reaches the threshold', () => {
  const origin = { x: 100, y: 100 };
  assert.equal(exceedsDragThreshold(origin, { x: 106, y: 100 }), true);
  assert.equal(exceedsDragThreshold(origin, { x: 100, y: 106 }, DRAG_START_DISTANCE), true);
});

test('coalesces high-frequency drag movement before moving the window', () => {
  let pending = { x: 0, y: 0 };
  pending = mergeMovement(pending, { x: 2, y: -1 });
  pending = mergeMovement(pending, { x: 4, y: 3 });
  pending = mergeMovement(pending, { x: -1, y: 2 });
  assert.deepEqual(pending, { x: 5, y: 4 });
  assert.equal(DRAG_MOVE_INTERVAL, 32);
});
