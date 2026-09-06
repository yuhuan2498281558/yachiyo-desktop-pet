(function (root, factory) {
  const Renderer = factory();
  if (typeof module === 'object' && module.exports) module.exports = Renderer;
  else root.YachiyoHDSpriteRenderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const FRAMES = [0, 1, 2, 1];
  const RUN_FRAME_MS = 280;
  const DRAG_IDLE_MS = 180;
  return class HDSpriteRenderer {
    constructor({ avatar, element, url, runUrl, gazeUrl, gazeElement, onError = () => {},
      imageFactory = () => new Image(), now = () => performance.now(),
      schedule = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id), random = Math.random,
      document: doc = globalThis.document }) {
      Object.assign(this, { avatar, element, url, runUrl, gazeUrl, gazeElement, onError, imageFactory, now, schedule, cancel, random, doc });
      this.context = {};
      this.phase = 0;
      this.remaining = 3500;
      this.timer = null;
      this.loadTimer = null;
      this.status = 'idle';
      this.lastReaction = -Infinity;
      this.destroyed = false;
      this.extras = {};
      this.running = false;
      this.runStep = 0;
      this.runDirection = 1;
      this.directionTravel = 0;
      this.dragIdleTimer = null;
      this.gaze = { x: 0, y: 0 };
      this.gazeTarget = { x: 0, y: 0 };
      this.gazeTimer = null;
      this.onVisibility = () => { if (doc?.hidden) this.stopRun(); this.sync(); };
      doc?.addEventListener('visibilitychange', this.onVisibility);
      this.paint();
    }

    setContext(context) {
      const previousMode = this.context.mode;
      const wasDragging = this.context.dragging;
      this.context = { ...this.context, ...context };
      if (wasDragging !== this.context.dragging) this.directionTravel = 0;
      if (this.running && (this.context.mode !== 'sprite-hd' || this.context.form !== 'yachiyo'
        || this.context.sceneMode !== 'none' || this.context.transient || this.context.visible === false
        || (wasDragging && !this.context.dragging))) this.stopRun();
      if (this.context.gazeTracking === false) {
        this.gaze = { x: 0, y: 0 };
        this.gazeTarget = { x: 0, y: 0 };
      }
      if (this.context.mode === 'sprite-hd' && previousMode !== 'sprite-hd' && this.status === 'failed') {
        this.status = 'idle';
      }
      if (!this.destroyed && this.context.mode === 'sprite-hd' && this.status === 'idle') this.load();
      if (this.status === 'ready' && this.context.mode === 'sprite-hd' && previousMode !== 'sprite-hd') this.loadExtras(true);
      this.sync();
    }

    loadExtras(retry = false) {
      for (const [name, url, width, height] of [['run', this.runUrl, 3072, 832], ['gaze', this.gazeUrl, 1496, 680]]) {
        if (!url || (this.extras[name] && !(retry && this.extras[name].status === 'failed'))) continue;
        const image = this.imageFactory();
        const state = { image, status: 'loading', timer: null };
        this.extras[name] = state;
        const finish = (success) => {
          if (this.destroyed || this.extras[name] !== state || state.status !== 'loading') return;
          this.cancel(state.timer);
          state.timer = null;
          image.onload = image.onerror = null;
          state.status = success ? 'ready' : 'failed';
          if (success && name === 'gaze' && this.gazeElement) this.gazeElement.style.backgroundImage = `url("${url}")`;
          this.sync(); // Optional asset failure keeps the approved idle, never the classic sprite.
        };
        image.onload = async () => {
          try {
            if (image.decode) await image.decode();
            finish(image.naturalWidth === width && image.naturalHeight === height);
          } catch { finish(false); }
        };
        image.onerror = () => finish(false);
        state.timer = this.schedule(() => finish(false), 10000);
        image.src = url;
      }
    }

    load() {
      this.status = 'loading';
      const image = this.imageFactory();
      this.image = image;
      const finish = (success) => {
        if (this.destroyed || this.image !== image || this.status !== 'loading') return;
        this.cancel(this.loadTimer);
        this.loadTimer = null;
        image.onload = image.onerror = null;
        this.status = success ? 'ready' : 'failed';
        if (success) { this.paint(); this.loadExtras(); }
        this.sync();
        if (!success && this.context.mode === 'sprite-hd') this.onError();
      };
      image.onload = async () => {
        try {
          if (image.decode) await image.decode();
          finish(image.naturalWidth === 2304 && image.naturalHeight === 832);
        } catch { finish(false); }
      };
      image.onerror = () => finish(false);
      this.loadTimer = this.schedule(() => finish(false), 10000);
      image.src = this.url;
    }

    isActive() {
      const c = this.context;
      return !this.destroyed && this.status === 'ready' && c.mode === 'sprite-hd'
        && c.form === 'yachiyo' && c.sceneMode === 'none' && !c.transient;
    }

    sync() {
      const active = this.isActive();
      this.avatar.classList.toggle('hd-sprite-active', active);
      this.element.dataset.status = this.status;
      if (active && this.context.visible !== false && (!this.context.dragging || this.running) && !this.doc?.hidden) {
        this.resume();
      } else this.pause();
      this.syncGaze();
    }

    paint() {
      this.frame = this.running ? this.runStep % 4 : FRAMES[this.phase];
      this.element.dataset.frame = String(this.frame);
      this.element.dataset.action = this.running ? 'run' : 'idle';
      this.element.dataset.direction = this.running && this.runDirection < 0 ? 'left' : 'right';
      this.element.style.transform = this.running && this.runDirection < 0 ? 'scaleX(-1)' : 'none';
      if (this.status === 'ready') this.element.style.backgroundImage = `url("${this.running ? this.runUrl : this.url}")`;
      this.element.style.backgroundSize = this.running ? '400% 100%' : '300% 100%';
      this.element.style.backgroundPosition = `${this.frame * (this.running ? 100 / 3 : 50)}% 0%`;
      this.paintGaze();
    }

    resume() {
      if (this.destroyed || this.timer !== null) return;
      this.deadline = this.now() + this.remaining;
      this.timer = this.schedule(() => {
        this.timer = null;
        if (this.running) {
          this.runStep = (this.runStep + 1) % 4;
          this.remaining = RUN_FRAME_MS;
        } else {
          this.phase = (this.phase + 1) % FRAMES.length;
          this.remaining = this.phase === 0 ? 3200 + this.random() * 1800 : [0, 70, 100, 90][this.phase];
        }
        this.paint();
        this.sync();
      }, this.remaining);
    }

    pause() {
      if (this.timer === null) return;
      this.remaining = Math.max(0, this.deadline - this.now());
      this.cancel(this.timer);
      this.timer = null;
    }

    react() {
      if (!this.isActive()) return false;
      if (this.running) return true;
      if (!this.context.dragging && this.context.visible !== false && !this.doc?.hidden
        && this.now() - this.lastReaction >= 1000) {
        this.lastReaction = this.now();
        this.pause();
        this.phase = 1;
        this.remaining = 70;
        this.paint();
        this.sync();
      }
      return true; // Also consume cooldown clicks, never trigger classic animations.
    }

    updateDrag(deltaX) {
      if (!this.isActive() || !this.context.dragging || this.context.visible === false || this.doc?.hidden
        || this.extras.run?.status !== 'ready' || !Number.isFinite(deltaX) || deltaX === 0) return false;
      if (this.now() - (this.lastDragAt ?? -Infinity) > DRAG_IDLE_MS) this.directionTravel = 0;
      this.lastDragAt = this.now();
      // Small reversals must accumulate before flipping: pointer jitter cannot flicker the pose.
      if (!this.running || Math.sign(deltaX) !== this.runDirection) this.directionTravel += deltaX;
      else this.directionTravel = 0;
      if (!this.running) {
        if (Math.abs(this.directionTravel) < 4) return false;
        this.runDirection = Math.sign(this.directionTravel);
        this.directionTravel = 0;
        this.pause();
        this.running = true;
        this.runStep = 0;
        this.remaining = RUN_FRAME_MS;
      } else if (Math.abs(this.directionTravel) >= 8) {
        this.runDirection = Math.sign(this.directionTravel);
        this.directionTravel = 0;
      }
      this.cancel(this.dragIdleTimer);
      this.dragIdleTimer = this.schedule(() => { this.stopRun(); this.sync(); }, DRAG_IDLE_MS);
      this.paint();
      this.sync();
      return true;
    }

    stopRun() {
      this.cancel(this.dragIdleTimer);
      this.dragIdleTimer = null;
      this.directionTravel = 0;
      if (!this.running) return;
      this.pause();
      this.running = false;
      this.phase = 0;
      this.remaining = 3500;
      this.paint();
    }

    setGaze(gaze) {
      if (this.destroyed || this.context.dragging || this.context.gazeTracking === false) return;
      const clamp = (v) => Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
      this.gazeTarget = { x: clamp(gaze?.x), y: clamp(gaze?.y) };
      this.syncGaze();
    }

    paintGaze() {
      if (!this.gazeElement) return;
      const shown = this.isActive() && !this.running && this.frame === 0 && this.extras.gaze?.status === 'ready';
      this.gazeElement.style.display = shown ? 'block' : 'none';
      const x = Math.round((this.gaze.x + 1) * 8), y = Math.round((this.gaze.y + 1) * 8);
      this.gazeElement.style.backgroundPosition = `${x * 6.25}% ${y * 6.25}%`;
      this.gazeElement.dataset.direction = `${x},${y}`;
    }

    syncGaze() {
      this.paintGaze();
      const enabled = this.isActive() && !this.running && this.context.visible !== false
        && !this.context.dragging && !this.doc?.hidden && this.context.gazeTracking !== false
        && this.extras.gaze?.status === 'ready';
      if (!enabled) {
        this.cancel(this.gazeTimer); this.gazeTimer = null;
        return;
      }
      if (this.gazeTimer !== null || Math.hypot(this.gaze.x - this.gazeTarget.x, this.gaze.y - this.gazeTarget.y) < .005) return;
      this.gazeTime = this.now();
      this.gazeTimer = this.schedule(() => {
        this.gazeTimer = null;
        const blend = 1 - Math.exp(-Math.min(100, this.now() - this.gazeTime) / 120);
        for (const axis of ['x', 'y']) this.gaze[axis] += (this.gazeTarget[axis] - this.gaze[axis]) * blend;
        this.syncGaze();
      }, 33);
    }

    destroy() {
      this.stopRun();
      this.pause();
      this.destroyed = true;
      this.cancel(this.loadTimer);
      this.cancel(this.gazeTimer);
      for (const state of Object.values(this.extras)) {
        this.cancel(state.timer);
        state.image.onload = state.image.onerror = null;
      }
      if (this.gazeElement) this.gazeElement.style.display = 'none';
      if (this.image) this.image.onload = this.image.onerror = null;
      this.doc?.removeEventListener('visibilitychange', this.onVisibility);
      this.avatar.classList.remove('hd-sprite-active');
    }
  };
});
