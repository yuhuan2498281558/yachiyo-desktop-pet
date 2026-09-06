const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PREFERENCES = Object.freeze({
  size: 'medium', wandering: false, clickThrough: false, gazeTracking: true,
  companions: true, identityMode: 'auto', yachiyoRenderer: 'live2d',
  sceneMode: 'none', visible: true, graphicsMode: 'standard', gazeStyle: 'gentle', x: null, y: null
});

function resolveStorageDirectory(directory) {
  // Windows recursive mkdir can fail when adding a child through a junction.
  // Use the existing real directory; a new profile keeps its original path.
  try { return fs.realpathSync(directory); } catch { return directory; }
}

function normalizePreferences(saved) {
  const result = { ...DEFAULT_PREFERENCES };
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return result;
  for (const key of ['wandering', 'clickThrough', 'gazeTracking', 'companions', 'visible']) {
    if (typeof saved[key] === 'boolean') result[key] = saved[key];
  }
  const enums = {
    size: ['small', 'medium', 'large'], identityMode: ['auto', 'yachiyo', 'kaguya'],
    yachiyoRenderer: ['live2d', 'sprite', 'sprite-hd'], sceneMode: ['none', 'starry-sea'],
    graphicsMode: ['standard', 'economy'], gazeStyle: ['gentle', 'eyes-only']
  };
  for (const [key, values] of Object.entries(enums)) {
    if (values.includes(saved[key])) result[key] = saved[key];
  }
  for (const key of ['x', 'y']) {
    if (Number.isFinite(saved[key])) result[key] = Math.round(saved[key]);
  }
  return result;
}

class PreferencesStore {
  constructor(filePath, { io = fs, delayMs = 250, onError = () => {} } = {}) {
    this.filePath = filePath;
    this.io = io;
    this.delayMs = delayMs;
    this.onError = onError;
    this.timer = null;
    this.pending = null;
  }

  load() {
    try {
      return normalizePreferences(JSON.parse(this.io.readFileSync(this.filePath, 'utf8').replace(/^\uFEFF/, '')));
    } catch (error) {
      if (error.code !== 'ENOENT') this.onError('preferences-load', error);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  schedule(preferences) {
    this.pending = normalizePreferences(preferences);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return true;
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    let descriptor;
    try {
      this.io.mkdirSync(path.dirname(this.filePath), { recursive: true });
      descriptor = this.io.openSync(temporary, 'w');
      this.io.writeFileSync(descriptor, JSON.stringify(this.pending, null, 2), 'utf8');
      this.io.fsyncSync(descriptor);
      this.io.closeSync(descriptor);
      descriptor = undefined;
      this.io.renameSync(temporary, this.filePath);
      this.pending = null;
      return true;
    } catch (error) {
      this.onError('preferences-save', error);
      return false;
    } finally {
      if (descriptor !== undefined) { try { this.io.closeSync(descriptor); } catch {} }
      try { this.io.unlinkSync(temporary); } catch {}
    }
  }
}

module.exports = { DEFAULT_PREFERENCES, normalizePreferences, PreferencesStore, resolveStorageDirectory };
