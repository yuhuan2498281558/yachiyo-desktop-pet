const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value: ${name}`);
    return args[index + 1];
  };
  const packaged = option('--exe');
  const minutes = Number(option('--soak-minutes') || 0);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 30) throw new Error('Soak must be 0–30 minutes');
  const root = path.join(__dirname, '..');
  const directory = path.join(root, 'tmp', `electron-smoke-${Date.now()}`);
  fs.mkdirSync(directory, { recursive: true });
  const executable = packaged ? path.resolve(packaged) : require('electron');
  if (!fs.existsSync(executable)) throw new Error('Executable does not exist');
  const reportPath = path.join(directory, 'report.json');
  const env = { ...process.env, YACHIYO_TEST_USER_DATA: path.join(directory, 'profile'),
    YACHIYO_TEST_CODEX_HOME: path.join(directory, 'empty-codex'),
    YACHIYO_SMOKE_REPORT: reportPath, YACHIYO_SOAK_MS: String(minutes * 60000) };
  for (const key of ['YACHIYO_CAPTURE_PATH', 'YACHIYO_CAPTURE_DELAY_MS', 'YACHIYO_CAPTURE_DRAG_BUFFER', 'ELECTRON_RUN_AS_NODE']) delete env[key];
  async function launch(environment, timeoutMs) {
    await new Promise((resolve, reject) => {
      const child = spawn(executable, packaged ? [] : [root], {
        cwd: root, env: environment, windowsHide: true, stdio: 'inherit'
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Electron verification timed out'));
      }, timeoutMs);
      child.on('error', (error) => { clearTimeout(timer); reject(error); });
      child.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(); else reject(new Error(`Electron exited with ${code}`));
      });
    });
  }
  console.log(`Report: ${reportPath}`);
  await launch(env, minutes * 60000 + 120000);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (!report.passed) throw new Error(report.error || 'Smoke checks failed');
  const preferencesPath = path.join(env.YACHIYO_TEST_USER_DATA, 'preferences.json');
  const saved = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
  if (saved.wandering !== false || saved.yachiyoRenderer !== 'live2d') throw new Error('Exit preference flush failed');
  if (saved.graphicsMode !== 'economy' || saved.gazeStyle !== 'eyes-only') throw new Error('Quality/gaze preferences were not persisted');
  const capturePath = path.join(directory, 'restart.png');
  const restartEnv = { ...env, YACHIYO_CAPTURE_PATH: capturePath, YACHIYO_CAPTURE_DELAY_MS: '3000' };
  delete restartEnv.YACHIYO_SMOKE_REPORT;
  delete restartEnv.YACHIYO_SOAK_MS;
  await launch(restartEnv, 30000);
  const restarted = JSON.parse(fs.readFileSync(`${capturePath}.json`, 'utf8'));
  if (!restarted.live2dActive || restarted.walking) throw new Error('Restart did not restore stable Live2D');
  report.checks.push('persisted preferences verified after normal restart');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Passed ${report.checks.length} Electron checks.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
