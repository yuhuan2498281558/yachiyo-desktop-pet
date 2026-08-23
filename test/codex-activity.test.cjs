const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyRolloutText } = require('../src/codex-activity.cjs');

function line(type, payload) {
  return JSON.stringify({ type, payload });
}

test('keeps a task working through tool activity', () => {
  const text = [
    line('event_msg', { type: 'user_message' }),
    line('response_item', { type: 'custom_tool_call' }),
    line('response_item', { type: 'custom_tool_call_output' })
  ].join('\n');
  assert.equal(classifyRolloutText(text), 'working');
});

test('task_complete wins over earlier activity', () => {
  const text = [
    line('event_msg', { type: 'user_message' }),
    line('response_item', { type: 'reasoning' }),
    line('event_msg', { type: 'task_complete' })
  ].join('\n');
  assert.equal(classifyRolloutText(text), 'ready');
});

test('a new turn after completion becomes working again', () => {
  const text = [
    line('event_msg', { type: 'task_complete' }),
    line('event_msg', { type: 'user_message' }),
    line('response_item', { type: 'reasoning' })
  ].join('\n');
  assert.equal(classifyRolloutText(text), 'working');
});

test('turn_aborted reports failure', () => {
  const text = [
    line('event_msg', { type: 'user_message' }),
    line('event_msg', { type: 'turn_aborted' })
  ].join('\n');
  assert.equal(classifyRolloutText(text), 'failed');
});
