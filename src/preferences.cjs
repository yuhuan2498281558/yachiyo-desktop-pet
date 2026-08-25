const fs = require('node:fs');
const path = require('node:path');

const SIZE_PRESETS = {
  small: { width: 230, height: 280, label: '小巧' },
  medium: { width: 290, height: 350, label: '标准' },
  large: { width: 360, height: 430, label: '大号' }
};

const SCENE_MODES = new Set(['none', 'starry-sea']);
const IDENTITY_MODES = new Set(['auto', 'yachiyo', 'kaguya']);

const DEFAULT_PREFERENCES = {
  size: 'medium',
  wandering: false,
  clickThrough: false,
  gazeTracking: true,
  companions: true,
  identityMode: 'auto',
  sceneMode: 'none',
  visible: true,
  x: null,
  y: null
};

class WriteLock {
  constructor() {
    this._chain = Promise.resolve();
  }

  run(task) {
    const next = this._chain.then(() => task(), () => task());
    this._chain = next.then(() => undefined, () => undefined);
    return next;
  }
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBoolean(value) {
  return value === true || value === false;
}

function isSavedCoordinate(value) {
  return value === null || Number.isFinite(value);
}

function normalizePreferences(raw) {
  if (!isObjectRecord(raw)) return { ...DEFAULT_PREFERENCES };

  return {
    size: SIZE_PRESETS[raw.size] ? raw.size : DEFAULT_PREFERENCES.size,
    wandering: isBoolean(raw.wandering) ? raw.wandering : DEFAULT_PREFERENCES.wandering,
    clickThrough: isBoolean(raw.clickThrough) ? raw.clickThrough : DEFAULT_PREFERENCES.clickThrough,
    gazeTracking: isBoolean(raw.gazeTracking) ? raw.gazeTracking : DEFAULT_PREFERENCES.gazeTracking,
    companions: isBoolean(raw.companions) ? raw.companions : DEFAULT_PREFERENCES.companions,
    identityMode: IDENTITY_MODES.has(raw.identityMode) ? raw.identityMode : DEFAULT_PREFERENCES.identityMode,
    sceneMode: SCENE_MODES.has(raw.sceneMode) ? raw.sceneMode : DEFAULT_PREFERENCES.sceneMode,
    visible: isBoolean(raw.visible) ? raw.visible : DEFAULT_PREFERENCES.visible,
    x: isSavedCoordinate(raw.x) ? raw.x : DEFAULT_PREFERENCES.x,
    y: isSavedCoordinate(raw.y) ? raw.y : DEFAULT_PREFERENCES.y
  };
}

function tempPathFor(filePath) {
  return `${filePath}.tmp`;
}

function atomicWriteFile(filePath, contents) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const tempPath = tempPathFor(filePath);
  const fd = fs.openSync(tempPath, 'w');
  try {
    fs.writeFileSync(fd, contents);
    fs.fsyncSync(fd);
  } catch (error) {
    fs.closeSync(fd);
    try { fs.unlinkSync(tempPath); } catch {
      // Best-effort cleanup of a failed temp write.
    }
    throw error;
  }
  fs.closeSync(fd);

  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (error.code === 'EEXIST' || error.code === 'EPERM' || error.code === 'EACCES') {
      try {
        fs.unlinkSync(filePath);
        fs.renameSync(tempPath, filePath);
        return;
      } catch (retryError) {
        try { fs.unlinkSync(tempPath); } catch {
          // Best-effort cleanup of a failed replace.
        }
        throw retryError;
      }
    }
    try { fs.unlinkSync(tempPath); } catch {
      // Best-effort cleanup of a failed rename.
    }
    throw error;
  }
}

function serializePreferences(value) {
  return JSON.stringify(normalizePreferences(value), null, 2);
}

function loadPreferencesFile(filePath) {
  try {
    return normalizePreferences(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

class PreferenceStore {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.value = { ...DEFAULT_PREFERENCES };
    this.debounceMs = Number.isFinite(options.debounceMs) ? options.debounceMs : 250;
    this._timer = null;
    this._lock = new WriteLock();
  }

  load() {
    this.value = loadPreferencesFile(this.filePath);
    return this.value;
  }

  save() {
    return this._lock.run(() => {
      atomicWriteFile(this.filePath, serializePreferences(this.value));
    });
  }

  scheduleSave() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      this.save().catch(() => {
        // A read-only profile should not stop the pet from running.
      });
    }, this.debounceMs);
  }

  flush() {
    clearTimeout(this._timer);
    this._timer = null;
    try {
      atomicWriteFile(this.filePath, serializePreferences(this.value));
    } catch {
      // A read-only profile should not stop the pet from running.
    }
  }
}

module.exports = {
  DEFAULT_PREFERENCES,
  IDENTITY_MODES,
  PreferenceStore,
  SCENE_MODES,
  SIZE_PRESETS,
  WriteLock,
  atomicWriteFile,
  loadPreferencesFile,
  normalizePreferences,
  tempPathFor
};
