const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PreferencesStore, normalizePreferences, resolveStorageDirectory } = require('../src/preferences-store.cjs');
const { Diagnostics } = require('../src/diagnostics.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-preferences-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'preferences.json');
}

test('validates stored types without treating the string false as true', () => {
  const value = normalizePreferences({ wandering: 'false', clickThrough: 1, visible: false,
    x: '12', y: 13.7, size: 'giant', identityMode: 'kaguya', yachiyoRenderer: 'sprite', unknown: true });
  assert.equal(value.wandering, false);
  assert.equal(value.clickThrough, false);
  assert.equal(value.visible, false);
  assert.equal(value.x, null);
  assert.equal(value.y, 14);
  assert.equal(value.size, 'medium');
  assert.equal(value.identityMode, 'kaguya');
  assert.equal(value.yachiyoRenderer, 'sprite');
  assert.equal(value.unknown, undefined);
});

test('exit flush persists the latest pending change before debounce expires', (t) => {
  const file = fixture(t);
  const store = new PreferencesStore(file, { delayMs: 60000 });
  store.schedule({ wandering: true });
  store.flush();
  store.schedule({ wandering: false, x: 800, y: 200, size: 'large', graphicsMode: 'economy', gazeStyle: 'eyes-only' });
  assert.equal(store.flush(), true);
  const restarted = new PreferencesStore(file).load();
  assert.equal(restarted.wandering, false);
  assert.equal(restarted.size, 'large');
  assert.equal(restarted.x, 800);
  assert.equal(restarted.graphicsMode, 'economy');
  assert.equal(restarted.gazeStyle, 'eyes-only');
});

test('old profiles retain standard graphics and new enum values are validated', () => {
  assert.equal(normalizePreferences({}).graphicsMode, 'standard');
  assert.equal(normalizePreferences({ gazeStyle: 'unknown' }).gazeStyle, 'gentle');
  assert.equal(normalizePreferences({ graphicsMode: true }).graphicsMode, 'standard');
});

test('failed atomic replacement preserves old config and supports retry', (t) => {
  const file = fixture(t);
  const initial = new PreferencesStore(file);
  initial.schedule({ size: 'large' });
  initial.flush();
  let fail = true;
  const errors = [];
  const store = new PreferencesStore(file, { io: { ...fs, renameSync(...args) {
    if (fail) throw Object.assign(new Error('locked'), { code: 'EPERM' });
    fs.renameSync(...args);
  } }, onError: (event) => errors.push(event) });
  store.schedule({ size: 'small' });
  assert.equal(store.flush(), false);
  assert.equal(new PreferencesStore(file).load().size, 'large');
  fail = false;
  assert.equal(store.flush(), true);
  assert.equal(new PreferencesStore(file).load().size, 'small');
  assert.deepEqual(errors, ['preferences-save']);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['preferences.json']);
});

test('invalid JSON and BOM configs start safely and read errors are reported', (t) => {
  const file = fixture(t);
  const errors = [];
  const store = new PreferencesStore(file, { onError: (event) => errors.push(event) });
  fs.writeFileSync(file, '{ broken', 'utf8');
  assert.equal(store.load().wandering, false);
  assert.deepEqual(errors, ['preferences-load']);
  fs.writeFileSync(file, '\uFEFF{"size":"large"}', 'utf8');
  assert.equal(store.load().size, 'large');
});

test('junction profiles resolve before creating logs and saving preferences', (t) => {
  const file = fixture(t);
  const parent = path.dirname(file);
  const actual = path.join(parent, 'actual-profile');
  const alias = path.join(parent, 'profile-link');
  fs.mkdirSync(actual);
  fs.symlinkSync(actual, alias, 'junction');
  const resolved = resolveStorageDirectory(alias);
  assert.equal(resolved, fs.realpathSync(actual));
  const store = new PreferencesStore(path.join(resolved, 'preferences.json'));
  store.schedule({ wandering: false, size: 'large' });
  assert.equal(store.flush(), true);
  const logger = new Diagnostics(path.join(resolved, 'logs'));
  logger.record('startup', { version: '0.3.2' });
  assert.equal(new PreferencesStore(path.join(alias, 'preferences.json')).load().size, 'large');
  const logFile = path.join(actual, 'logs', 'diagnostics.jsonl');
  assert.equal(JSON.parse(fs.readFileSync(logFile, 'utf8')).event, 'startup');
  assert.equal(resolveStorageDirectory(path.join(parent, 'new-profile')), path.join(parent, 'new-profile'));
});
