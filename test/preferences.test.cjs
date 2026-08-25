const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  DEFAULT_PREFERENCES,
  PreferenceStore,
  WriteLock,
  atomicWriteFile,
  describePreferencesLoad,
  loadPreferencesFile,
  normalizePreferences,
  tempPathFor
} = require('../src/preferences.cjs');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'yachiyo-prefs-'));
}

function prefsPath(directory) {
  return path.join(directory, 'preferences.json');
}

function writeRaw(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

test('normalizePreferences keeps valid saved settings and fills defaults', () => {
  const normalized = normalizePreferences({
    size: 'large',
    wandering: true,
    clickThrough: true,
    gazeTracking: false,
    companions: false,
    identityMode: 'kaguya',
    sceneMode: 'starry-sea',
    visible: false,
    x: 120,
    y: 80,
    extra: 'drop-me'
  });

  assert.deepEqual(normalized, {
    size: 'large',
    wandering: true,
    clickThrough: true,
    gazeTracking: false,
    companions: false,
    identityMode: 'kaguya',
    sceneMode: 'starry-sea',
    visible: false,
    x: 120,
    y: 80
  });
});

test('normalizePreferences rejects invalid values and non-objects', () => {
  assert.deepEqual(normalizePreferences(null), DEFAULT_PREFERENCES);
  assert.deepEqual(normalizePreferences('{"size":"large"}'), DEFAULT_PREFERENCES);
  assert.deepEqual(normalizePreferences([]), DEFAULT_PREFERENCES);

  const repaired = normalizePreferences({
    size: 'huge',
    wandering: 'yes',
    clickThrough: 1,
    gazeTracking: 'on',
    companions: null,
    identityMode: 'both',
    sceneMode: 'concert',
    visible: 'true',
    x: '100',
    y: Number.NaN
  });

  assert.deepEqual(repaired, DEFAULT_PREFERENCES);
});

test('loadPreferencesFile uses defaults for missing, torn, or invalid JSON', () => {
  const directory = makeTempDir();
  const missing = prefsPath(directory);
  const torn = path.join(directory, 'torn.json');
  const invalid = path.join(directory, 'invalid.json');
  writeRaw(torn, '{"size":"large","x":12');
  writeRaw(invalid, '[]');

  assert.deepEqual(loadPreferencesFile(missing), DEFAULT_PREFERENCES);
  assert.deepEqual(loadPreferencesFile(torn), DEFAULT_PREFERENCES);
  assert.deepEqual(loadPreferencesFile(invalid), DEFAULT_PREFERENCES);
});

test('loadPreferencesFile repairs mixed valid and invalid fields', () => {
  const filePath = prefsPath(makeTempDir());
  writeRaw(filePath, JSON.stringify({
    size: 'small',
    identityMode: 'yachiyo',
    sceneMode: 'nope',
    x: 42,
    y: 24,
    wandering: true
  }));

  assert.deepEqual(loadPreferencesFile(filePath), {
    ...DEFAULT_PREFERENCES,
    size: 'small',
    identityMode: 'yachiyo',
    wandering: true,
    x: 42,
    y: 24
  });

  const described = describePreferencesLoad(filePath);
  assert.equal(described.status, 'repaired');
  assert.deepEqual(described.fields, ['sceneMode']);
  assert.equal(describePreferencesLoad(path.join(path.dirname(filePath), 'missing.json')).status, 'missing');
  writeRaw(path.join(path.dirname(filePath), 'torn.json'), '{"size":');
  assert.equal(describePreferencesLoad(path.join(path.dirname(filePath), 'torn.json')).status, 'invalid');
});

test('PreferenceStore round-trips size, position, form, and other settings', async () => {
  const filePath = prefsPath(makeTempDir());
  const store = new PreferenceStore(filePath);
  Object.assign(store.load(), {
    size: 'small',
    wandering: true,
    clickThrough: false,
    gazeTracking: false,
    companions: false,
    identityMode: 'yachiyo',
    sceneMode: 'none',
    visible: true,
    x: 640,
    y: 480
  });

  await store.save();

  const reloaded = new PreferenceStore(filePath).load();
  assert.equal(reloaded.size, 'small');
  assert.equal(reloaded.identityMode, 'yachiyo');
  assert.equal(reloaded.sceneMode, 'none');
  assert.equal(reloaded.x, 640);
  assert.equal(reloaded.y, 480);
  assert.equal(reloaded.wandering, true);
  assert.equal(reloaded.gazeTracking, false);
  assert.equal(reloaded.companions, false);
  assert.equal(fs.existsSync(tempPathFor(filePath)), false);
});

test('atomicWriteFile replaces destination without leaving a temp file', () => {
  const filePath = prefsPath(makeTempDir());
  writeRaw(filePath, 'NOT JSON{{{');
  atomicWriteFile(filePath, JSON.stringify({ ok: true }, null, 2));

  assert.equal(fs.existsSync(tempPathFor(filePath)), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), { ok: true });
});

test('write lock serializes overlapping saves and keeps the last complete state', async () => {
  const filePath = prefsPath(makeTempDir());
  const store = new PreferenceStore(filePath);
  store.load();

  store.value.size = 'small';
  store.value.x = 10;
  const first = store.save();
  store.value.size = 'large';
  store.value.x = 99;
  store.value.identityMode = 'kaguya';
  const second = store.save();

  await Promise.all([first, second]);

  const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(saved.size, 'large');
  assert.equal(saved.x, 99);
  assert.equal(saved.identityMode, 'kaguya');
  assert.equal(fs.existsSync(tempPathFor(filePath)), false);
});

test('WriteLock runs tasks one at a time', async () => {
  const lock = new WriteLock();
  const order = [];
  let concurrent = 0;
  let maxConcurrent = 0;

  function job(name, delayMs) {
    return lock.run(async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      order.push(`start-${name}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      order.push(`end-${name}`);
      concurrent -= 1;
    });
  }

  await Promise.all([job('a', 40), job('b', 10)]);
  assert.equal(maxConcurrent, 1);
  assert.deepEqual(order, ['start-a', 'end-a', 'start-b', 'end-b']);
});

test('flush writes pending preference changes immediately', () => {
  const filePath = prefsPath(makeTempDir());
  const store = new PreferenceStore(filePath, { debounceMs: 30_000 });
  store.load();
  store.value.size = 'large';
  store.value.x = 15;
  store.value.y = 25;
  store.scheduleSave();
  store.flush();

  const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(saved.size, 'large');
  assert.equal(saved.x, 15);
  assert.equal(saved.y, 25);
});
