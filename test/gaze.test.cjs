const test = require('node:test');
const assert = require('node:assert/strict');
const { gazeDirection } = require('../src/gaze.cjs');

const bounds = { x: 100, y: 100, width: 200, height: 200 };

test('maps global cursor points to the 16-direction atlas', () => {
  assert.equal(gazeDirection({ x: 200, y: 0 }, bounds).index, 0);
  assert.equal(gazeDirection({ x: 500, y: 184 }, bounds).index, 4);
  assert.equal(gazeDirection({ x: 200, y: 500 }, bounds).index, 8);
  assert.equal(gazeDirection({ x: 0, y: 184 }, bounds).index, 12);
});
