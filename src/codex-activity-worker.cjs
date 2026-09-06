const { parentPort, workerData } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');
const { scanCodexActivity } = require('./codex-activity.cjs');

const cache = new Map();
function poll() {
  const start = performance.now();
  const metrics = {};
  try {
    const activity = scanCodexActivity({ ...workerData, cache, metrics });
    metrics.durationMs = Math.round((performance.now() - start) * 100) / 100;
    parentPort.postMessage({ activity, metrics });
  } catch (error) {
    parentPort.postMessage({ errorCode: error.code || 'SCAN_FAILED' });
  }
  // Schedule after completion: slow scans cannot overlap or build up a queue.
  setTimeout(poll, Math.max(50, workerData.pollMs ?? 1000));
}
if (parentPort) poll();
