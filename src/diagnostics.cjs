const fs = require('node:fs');
const path = require('node:path');

const CATEGORIES = new Set(['codex', 'form', 'animation', 'config']);
const EVENT_PATTERN = /^[a-z][a-z0-9-]{0,47}$/;
const STRING_PATTERN = /^[A-Za-z0-9._,-]{1,64}$/;
const FORBIDDEN_DETAIL_KEYS = new Set([
  'text', 'body', 'prompt', 'message', 'content', 'payload',
  'transcript', 'session', 'rollout', 'filePath', 'path', 'input', 'output'
]);
const DEFAULT_MAX_BYTES = 256 * 1024;
const MAX_LINE_BYTES = 1024;

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeDetailValue(value) {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9) {
    return Number.isInteger(value) ? value : Number(value.toFixed(3));
  }
  if (typeof value === 'string' && STRING_PATTERN.test(value)) return value;
  return undefined;
}

function sanitizeDetails(details) {
  if (!isObjectRecord(details)) return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(details)) {
    if (FORBIDDEN_DETAIL_KEYS.has(key)) continue;
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,31}$/.test(key)) continue;
    const next = sanitizeDetailValue(value);
    if (next !== undefined) sanitized[key] = next;
  }
  return sanitized;
}

function buildRecord(category, event, details, now) {
  if (!CATEGORIES.has(category) || typeof event !== 'string' || !EVENT_PATTERN.test(event)) {
    return null;
  }
  return {
    ts: (now || new Date()).toISOString(),
    category,
    event,
    ...sanitizeDetails(details)
  };
}

function readTailText(filePath, keepBytes) {
  const stats = fs.statSync(filePath);
  if (stats.size <= keepBytes) return fs.readFileSync(filePath);
  const length = Math.min(stats.size, keepBytes);
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buffer, 0, length, stats.size - length);
  } finally {
    fs.closeSync(fd);
  }
  const text = buffer.toString('utf8');
  const firstLineBreak = text.indexOf('\n');
  return firstLineBreak >= 0 ? text.slice(firstLineBreak + 1) : text;
}

function truncateToTail(filePath, keepBytes) {
  const tail = readTailText(filePath, keepBytes);
  fs.writeFileSync(filePath, tail);
}

function appendCapped(filePath, line, maxBytes, keepBytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let size = 0;
  try {
    size = fs.statSync(filePath).size;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const lineBytes = Buffer.byteLength(line);
  if (lineBytes > MAX_LINE_BYTES) return;
  if (size + lineBytes > maxBytes) {
    const budget = Math.max(0, Math.min(keepBytes, maxBytes - lineBytes));
    try {
      if (budget <= 0) fs.writeFileSync(filePath, '');
      else truncateToTail(filePath, budget);
    } catch {
      try { fs.unlinkSync(filePath); } catch {
        // A broken log should not stop the pet; the next append starts a new file.
      }
    }
  }
  fs.appendFileSync(filePath, line);
}

function describeCodexTransition(previous, next) {
  const wasWorking = Boolean(previous?.working);
  const working = Boolean(next?.working);
  const activeCount = Number.isFinite(next?.activeCount) ? Math.max(0, Math.trunc(next.activeCount)) : 0;
  const outcome = working ? null : (next?.outcome === 'failed' ? 'failed' : 'ready');

  if (working && !wasWorking) {
    return { event: 'task-started', details: { activeCount } };
  }
  if (!working && wasWorking) {
    return {
      event: outcome === 'failed' ? 'task-aborted' : 'task-complete',
      details: { outcome, activeCount }
    };
  }
  if (!working && (previous?.outcome === 'failed' ? 'failed' : 'ready') !== outcome) {
    return {
      event: outcome === 'failed' ? 'task-aborted' : 'task-complete',
      details: { outcome, activeCount }
    };
  }
  return null;
}

class DiagnosticLog {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.maxBytes = Math.max(1024, Number(options.maxBytes) || DEFAULT_MAX_BYTES);
    const requestedKeep = Number(options.keepBytes);
    this.keepBytes = Math.max(
      512,
      Math.min(
        Number.isFinite(requestedKeep) ? requestedKeep : Math.floor(this.maxBytes * 0.75),
        this.maxBytes - 256
      )
    );
  }

  write(category, event, details, now) {
    try {
      const record = buildRecord(category, event, details, now);
      if (!record) return false;
      appendCapped(
        this.filePath,
        `${JSON.stringify(record)}\n`,
        this.maxBytes,
        this.keepBytes
      );
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = {
  CATEGORIES,
  DEFAULT_MAX_BYTES,
  DiagnosticLog,
  buildRecord,
  describeCodexTransition,
  sanitizeDetails
};
