const fs = require('node:fs');
const path = require('node:path');

// Only allow bounded scalar metadata. Never log rollout text or raw error messages.
const FIELDS = new Set(['code', 'status', 'working', 'activeCount', 'outcome', 'form',
  'dragging', 'walking', 'sceneMode', 'renderer', 'reason', 'version', 'durationMs', 'filesRead']);

class Diagnostics {
  constructor(directory, { maxBytes = 256 * 1024 } = {}) {
    this.filePath = path.join(directory, 'diagnostics.jsonl');
    this.maxBytes = maxBytes;
  }

  record(event, details = {}) {
    try {
      const entry = { time: new Date().toISOString(), event: String(event).slice(0, 64) };
      for (const [key, value] of Object.entries(details)) {
        if (FIELDS.has(key) && ['boolean', 'number', 'string'].includes(typeof value)) {
          entry[key] = typeof value === 'string' ? value.slice(0, 80) : value;
        }
      }
      const line = `${JSON.stringify(entry)}\n`;
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      let size = 0;
      try { size = fs.statSync(this.filePath).size; } catch {}
      if (size + Buffer.byteLength(line) > this.maxBytes) {
        const previous = `${this.filePath}.1`;
        try { fs.unlinkSync(previous); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        fs.renameSync(this.filePath, previous);
      }
      fs.appendFileSync(this.filePath, line, 'utf8');
    } catch {
      // Diagnostics must never interrupt window interaction or shutdown.
    }
  }
}

module.exports = { Diagnostics };
