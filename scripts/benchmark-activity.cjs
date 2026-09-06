const { performance, monitorEventLoopDelay } = require('node:perf_hooks');
const { scanCodexActivity, CodexActivityMonitor } = require('../src/codex-activity.cjs');

async function main() {
  const cache = new Map();
  const results = [];
  for (let index = 0; index < 6; index++) {
    const metrics = {};
    const started = performance.now();
    scanCodexActivity({ cache, metrics });
    results.push({ ms: +(performance.now() - started).toFixed(2), filesRead: metrics.filesRead });
  }
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  const workerSamples = [];
  const monitor = new CodexActivityMonitor({
    pollMs: 100,
    onMetrics: (metrics) => workerSamples.push(metrics),
    onError: (event, error) => { throw new Error(`${event}: ${error.code}`); }
  });
  monitor.start(() => {});
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await monitor.stop();
  loop.disable();
  console.log(JSON.stringify({ directScan: results, workerSamples,
    mainThreadDelay: { meanMs: +(loop.mean / 1e6).toFixed(2), maxMs: +(loop.max / 1e6).toFixed(2) }
  }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
