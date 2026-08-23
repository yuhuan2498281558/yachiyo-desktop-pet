const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ACTIVE_EVENT_TYPES = new Set([
  'agent_message', 'agent_reasoning', 'context_compacted', 'token_count', 'user_message'
]);
const ACTIVE_RESPONSE_TYPES = new Set([
  'custom_tool_call', 'custom_tool_call_output', 'function_call',
  'function_call_output', 'message', 'reasoning'
]);

function classifyRolloutText(text) {
  let status = 'unknown';
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const payloadType = entry.payload?.type;
    if (entry.type === 'turn_context') status = 'working';
    else if (entry.type === 'event_msg' && payloadType === 'task_complete') status = 'ready';
    else if (entry.type === 'event_msg' && payloadType === 'turn_aborted') status = 'failed';
    else if (entry.type === 'event_msg' && ACTIVE_EVENT_TYPES.has(payloadType)) status = 'working';
    else if (entry.type === 'response_item' && ACTIVE_RESPONSE_TYPES.has(payloadType)) status = 'working';
  }
  return status;
}

function readTail(filePath, maximumBytes = 2 * 1024 * 1024) {
  const stats = fs.statSync(filePath);
  const length = Math.min(stats.size, maximumBytes);
  const buffer = Buffer.alloc(length);
  const descriptor = fs.openSync(filePath, 'r');
  try {
    fs.readSync(descriptor, buffer, 0, length, stats.size - length);
  } finally {
    fs.closeSync(descriptor);
  }
  let text = buffer.toString('utf8');
  if (stats.size > length) {
    const firstLineBreak = text.indexOf('\n');
    text = firstLineBreak >= 0 ? text.slice(firstLineBreak + 1) : '';
  }
  return text;
}

function collectRecentRollouts(root, cutoff, result = []) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectRecentRollouts(fullPath, cutoff, result);
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      try {
        const modifiedAt = fs.statSync(fullPath).mtimeMs;
        if (modifiedAt >= cutoff) result.push({ filePath: fullPath, modifiedAt });
      } catch {
        // A rollout can rotate between enumeration and stat.
      }
    }
  }
  return result;
}

function scanCodexActivity(options = {}) {
  const now = options.now ?? Date.now();
  const lookbackMs = options.lookbackMs ?? 8 * 60 * 60 * 1000;
  const codexHome = options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const rollouts = collectRecentRollouts(path.join(codexHome, 'sessions'), now - lookbackMs)
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  const active = [];
  let latestTerminal = null;
  for (const rollout of rollouts) {
    let status;
    try {
      status = classifyRolloutText(readTail(rollout.filePath));
    } catch {
      continue;
    }
    if (status === 'working') active.push(rollout.filePath);
    else if (!latestTerminal && (status === 'ready' || status === 'failed')) {
      latestTerminal = { status, filePath: rollout.filePath, modifiedAt: rollout.modifiedAt };
    }
  }
  return {
    working: active.length > 0,
    activeCount: active.length,
    outcome: active.length > 0 ? null : latestTerminal?.status || 'ready'
  };
}

class CodexActivityMonitor {
  constructor(options = {}) {
    this.options = options;
    this.interval = null;
    this.lastKey = '';
  }

  start(callback) {
    const poll = () => {
      const activity = scanCodexActivity(this.options);
      const key = JSON.stringify(activity);
      if (key !== this.lastKey) {
        this.lastKey = key;
        callback(activity);
      }
    };
    poll();
    this.interval = setInterval(poll, this.options.pollMs ?? 1000);
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
  }
}

module.exports = { classifyRolloutText, CodexActivityMonitor, scanCodexActivity };
