const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

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
        const stats = fs.statSync(fullPath);
        const modifiedAt = stats.mtimeMs;
        if (modifiedAt >= cutoff) result.push({ filePath: fullPath, modifiedAt, size: stats.size });
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
  const cache = options.cache;
  const seen = new Set();
  let filesRead = 0;
  let latestTerminal = null;
  for (const rollout of rollouts) {
    seen.add(rollout.filePath);
    let status;
    try {
      const cached = cache?.get(rollout.filePath);
      if (cached && cached.modifiedAt === rollout.modifiedAt && cached.size === rollout.size) {
        status = cached.status;
      } else {
        status = classifyRolloutText(readTail(rollout.filePath));
        filesRead += 1;
        // A partial write or oversized record is not a terminal lifecycle event.
        if (status === 'unknown' && cached?.status === 'working') status = 'working';
        cache?.set(rollout.filePath, { ...rollout, status });
      }
    } catch {
      continue;
    }
    if (status === 'working') active.push(rollout.filePath);
    else if (!latestTerminal && (status === 'ready' || status === 'failed')) {
      latestTerminal = { status, filePath: rollout.filePath, modifiedAt: rollout.modifiedAt };
    }
  }
  if (cache) for (const file of cache.keys()) if (!seen.has(file)) cache.delete(file);
  if (options.metrics) options.metrics.filesRead = filesRead;
  return {
    working: active.length > 0,
    activeCount: active.length,
    outcome: active.length > 0 ? null : latestTerminal?.status || 'ready'
  };
}

class CodexActivityMonitor {
  constructor(options = {}) {
    this.options = options;
    this.worker = null;
    this.restartTimer = null;
    this.running = false;
    this.lastKey = '';
  }

  start(callback) {
    this.stop();
    this.running = true;
    this.lastKey = '';
    const launch = () => {
      if (!this.running) return;
      const { codexHome, lookbackMs, pollMs } = this.options;
      const worker = new Worker(path.join(__dirname, 'codex-activity-worker.cjs'), {
        workerData: { codexHome, lookbackMs, pollMs }
      });
      this.worker = worker;
      worker.on('message', ({ activity, metrics, errorCode }) => {
        if (this.worker !== worker || !this.running) return;
        if (errorCode) { this.options.onError?.('activity-scan', { code: errorCode }); return; }
        this.options.onMetrics?.(metrics);
        const key = JSON.stringify(activity);
        if (key !== this.lastKey) {
          this.lastKey = key;
          callback(activity);
        }
      });
      worker.on('error', (error) => this.options.onError?.('activity-worker', error));
      worker.on('exit', (code) => {
        if (this.worker !== worker || !this.running) return;
        this.worker = null;
        this.options.onError?.('activity-worker-exit', { code: String(code) });
        this.restartTimer = setTimeout(launch, 5000);
      });
    };
    launch();
  }

  stop() {
    this.running = false;
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    const worker = this.worker;
    this.worker = null;
    return worker?.terminate();
  }
}

module.exports = { classifyRolloutText, CodexActivityMonitor, scanCodexActivity };
