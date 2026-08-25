(function (global) {
  'use strict';

  const KINDS = new Set(['once', 'loop', 'hold']);

  function sameAction(left, right) {
    return Boolean(left)
      && Boolean(right)
      && left.kind === right.kind
      && left.name === right.name;
  }

  class SpriteActionQueue {
    constructor(hooks = {}) {
      this._onStart = typeof hooks.onStart === 'function' ? hooks.onStart : () => {};
      this._onStop = typeof hooks.onStop === 'function' ? hooks.onStop : () => {};
      this._nextId = 0;
      this.current = null;
      this.pending = [];
    }

    get transient() {
      return this.current?.kind === 'once';
    }

    snapshot() {
      const summarize = (action) => (action ? { kind: action.kind, name: action.name } : null);
      return {
        current: summarize(this.current),
        pending: this.pending.map((action) => summarize(action))
      };
    }

    append(action) {
      const item = this._normalize(action);
      if (!item) return null;
      this.pending.push(item);
      this._pump();
      return item.id;
    }

    replace(action) {
      const item = this._normalize(action);
      if (!item) return null;
      if (sameAction(this.current, item) && item.kind !== 'once') {
        this.pending = [];
        return this.current.id;
      }
      this.pending = [item];
      if (!this.current) {
        this._pump();
      } else if (this.current.kind !== 'once') {
        this._stopCurrent();
        this._pump();
      }
      return item.id;
    }

    interrupt(action) {
      const item = this._normalize(action);
      if (!item) return null;
      this.pending = [];
      this._stopCurrent();
      this.pending.push(item);
      this._pump();
      return item.id;
    }

    complete(expectedId) {
      if (!this.current) return;
      if (expectedId !== undefined && this.current.id !== expectedId) return;
      const finished = this.current;
      this.current = null;
      if (typeof finished.onComplete === 'function') finished.onComplete();
      this._pump();
    }

    clear() {
      this.pending = [];
      this._stopCurrent();
    }

    _normalize(action) {
      if (!action || !KINDS.has(action.kind)) return null;
      return {
        id: ++this._nextId,
        kind: action.kind,
        name: typeof action.name === 'string' ? action.name : '',
        onComplete: typeof action.onComplete === 'function' ? action.onComplete : null
      };
    }

    _stopCurrent() {
      if (!this.current) return;
      const stopped = this.current;
      this.current = null;
      this._onStop(stopped);
    }

    _pump() {
      if (this.current || this.pending.length === 0) return;
      this.current = this.pending.shift();
      this._onStart(this.current);
    }
  }

  const api = { SpriteActionQueue };
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.SpriteActionQueue = SpriteActionQueue;
})(typeof window !== 'undefined' ? window : globalThis);
