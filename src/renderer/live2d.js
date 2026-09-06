(function attachYachiyoLive2D(global) {
  'use strict';

  const RENDERER_MODES = new Set(['live2d', 'sprite']);

  class YachiyoLive2DRenderer {
    constructor({ avatar, canvas, dragCanvas, modelUrl }) {
      this.avatar = avatar;
      this.canvas = canvas;
      this.dragCanvas = dragCanvas;
      this.dragContext = dragCanvas?.getContext?.('2d') || null;
      this.dragPixels = null;
      this.dragImageData = null;
      this.dragRenderTexture = null;
      this.modelUrl = modelUrl;
      this.mode = 'sprite';
      this.state = 'idle';
      this.context = {
        form: 'yachiyo',
        visible: true,
        sceneMode: 'none',
        walking: false,
        walkingDirection: 1,
        transient: false
      };
      this.gaze = { x: 0, y: 0 };
      this.targetGaze = { x: 0, y: 0 };
      this.graphicsMode = 'standard';
      this.gazeStyle = 'gentle';
      this.lastReactionAt = -Infinity;
      this.lastReactionCommand = null;
      this.reactionIndex = 0;
      this.pendingExpression = null;
      this.application = null;
      this.model = null;
      this.naturalSize = null;
      this.basePosition = null;
      this.walkStartedAt = null;
      this.hopStartedAt = null;
      this.dragBufferTimer = null;
      this.expressionTimer = null;
      this.currentExpression = null;
      this.destroyed = false;
      this.windowDragging = false;
      this.contextLost = (event) => {
        event.preventDefault();
        this.state = 'failed';
        this.application?.stop();
        this.syncVisibility();
        this.emitStatus('context-lost');
      };
      this.canvas.addEventListener?.('webglcontextlost', this.contextLost);
      this.resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => this.resize())
        : null;
      this.resizeObserver?.observe(this.avatar);
    }

    setMode(mode) {
      const changed = this.mode !== mode;
      this.mode = RENDERER_MODES.has(mode) ? mode : 'live2d';
      if (this.mode === 'live2d' && (changed || this.state === 'idle')) this.load();
      this.syncVisibility();
    }

    setContext(nextContext) {
      const wasWalking = this.context.walking;
      this.context = { ...this.context, ...nextContext };
      if (!wasWalking && this.context.walking) this.walkStartedAt = this.now();
      if (wasWalking && !this.context.walking) this.walkStartedAt = null;
      this.syncVisibility();
      this.updateFrame();
    }

    isActive() {
      return this.avatar.classList.contains('live2d-active');
    }

    renderResolution() {
      return Math.min(global.devicePixelRatio || 1, this.graphicsMode === 'economy' ? 1 : 2);
    }

    setOptions({ graphicsMode, gazeStyle } = {}) {
      const quality = graphicsMode === 'economy' ? 'economy' : 'standard';
      this.gazeStyle = gazeStyle === 'eyes-only' ? 'eyes-only' : 'gentle';
      if (quality === this.graphicsMode) return;
      this.graphicsMode = quality;
      if (this.application) {
        this.application.ticker.maxFPS = quality === 'economy' ? 30 : 60;
        // resize is deferred during a frozen drag; no model/texture reload.
        this.resize();
      }
    }

    async load() {
      if (this.destroyed) return;
      if (this.state === 'loading' || this.state === 'ready' || this.mode !== 'live2d') return;
      if (this.state === 'failed' && this.application) {
        this.dragRenderTexture?.destroy(true);
        this.dragRenderTexture = null;
        this.dragPixels = null;
        this.dragImageData = null;
        if (this.dragCanvas) this.dragCanvas.width = 0;
        // The same DOM canvas is reused when the user retries via Sprite → Live2D.
        this.application.destroy(false, { children: true, texture: true, baseTexture: true });
        this.application = null;
        this.model = null;
        this.naturalSize = null;
      }
      this.state = 'loading';
      this.avatar.dataset.live2dState = 'loading';
      delete this.avatar.dataset.live2dError;

      try {
        if (!global.PIXI?.Application || !global.PIXI?.live2d?.Live2DModel) {
          throw new Error('Live2D runtime is unavailable');
        }

        this.application = new global.PIXI.Application({
          view: this.canvas,
          width: Math.max(1, this.avatar.clientWidth),
          height: Math.max(1, this.avatar.clientHeight),
          transparent: true,
          backgroundAlpha: 0,
          autoDensity: true,
          resolution: this.renderResolution(),
          antialias: true,
          autoStart: false,
          preserveDrawingBuffer: true
        });

        const model = await global.PIXI.live2d.Live2DModel.from(this.modelUrl, {
          autoInteract: false,
          autoUpdate: false
        });
        if (this.destroyed) { model.destroy(); return; }
        this.model = model;
        this.model.anchor.set(0.5, 0.5);
        this.model.interactive = false;
        this.naturalSize = {
          width: Math.max(1, this.model.width),
          height: Math.max(1, this.model.height)
        };
        this.application.stage.addChild(this.model);
        this.application.ticker.maxFPS = this.graphicsMode === 'economy' ? 30 : 60;
        this.application.ticker.add(
          () => {
            if (this.windowDragging || !this.isActive()) return;
            // The model's default shared ticker accumulates time even when this
            // application's rendering is paused. Keep one clock for both so a
            // long drag/hide cannot feed seconds of physics into the first frame.
            const delta = Math.min(this.application.ticker.deltaMS || 1000 / 60, 50);
            this.model?.update?.(delta);
            this.updateFrame(delta);
          },
          undefined,
          global.PIXI.UPDATE_PRIORITY?.HIGH ?? 25
        );
        this.state = 'ready';
        this.avatar.dataset.live2dState = 'ready';
        this.resize();
        this.setExpression('neutral');
        this.syncVisibility();
        this.emitStatus('ready');
      } catch (error) {
        if (this.destroyed) return;
        this.application?.stop();
        this.state = 'failed';
        this.avatar.dataset.live2dState = 'failed';
        this.avatar.dataset.live2dError = error instanceof Error ? error.message : String(error);
        this.syncVisibility();
        this.emitStatus('failed', error instanceof Error ? error.message : String(error));
        console.error('Live2D model failed to load; keeping Sprite fallback.', error);
      }
    }

    emitStatus(status, message = '') {
      global.dispatchEvent(new CustomEvent('pet-live2d-status', {
        detail: { status, message }
      }));
    }

    shouldShow() {
      return this.mode === 'live2d'
        && this.state === 'ready'
        && this.context.form === 'yachiyo'
        && this.context.sceneMode === 'none'
        && this.context.visible !== false
        && !this.context.transient;
    }

    syncVisibility() {
      const active = this.shouldShow();
      const wasActive = this.isActive();
      this.avatar.classList.toggle('live2d-active', active);
      this.canvas.setAttribute('aria-hidden', String(!active));
      if (this.application) {
        if (active && !wasActive) {
          this.resize();
          if (!this.windowDragging) {
            this.application.renderer.render(this.application.stage);
            this.application.start();
          }
        } else if (!active && wasActive) {
          this.application.stop();
        }
      }
      if (!active) this.avatar.classList.remove('live2d-drag-buffer');
    }

    resize(force = false) {
      if (!this.application || !this.model || !this.naturalSize) return;
      if (!force && this.avatar.classList.contains('live2d-drag-buffer')) return;
      const width = Math.max(1, this.avatar.clientWidth);
      const height = Math.max(1, this.avatar.clientHeight);
      this.application.renderer.resolution = this.renderResolution();
      this.application.renderer.resize(width, height);
      this.syncDragCanvasSize();

      // The imported model has generous transparent layout margins. A 1.23x
      // height fit makes its visible silhouette match the existing Sprite while
      // still keeping the hair ornaments, sleeves and shoes inside the window.
      const scale = Math.min(
        (width * 1.08) / this.naturalSize.width,
        (height * 1.23) / this.naturalSize.height
      );
      this.model.scale.set(scale);
      this.basePosition = {
        x: width * 0.5,
        y: height * 0.515
      };
      this.updateFrame();
      if (this.isActive() && !this.windowDragging) this.application.renderer.render(this.application.stage);
    }

    syncDragCanvasSize() {
      if (!this.dragCanvas) return;
      const width = Math.max(1, this.canvas.width || this.avatar.clientWidth);
      const height = Math.max(1, this.canvas.height || this.avatar.clientHeight);
      const sizeChanged = this.dragCanvas.width !== width || this.dragCanvas.height !== height;
      if (this.dragCanvas.width !== width) this.dragCanvas.width = width;
      if (this.dragCanvas.height !== height) this.dragCanvas.height = height;
      if (sizeChanged) {
        this.dragPixels = null;
        this.dragImageData = null;
        this.dragRenderTexture?.destroy(true);
        const resolution = this.application?.renderer?.resolution || 1;
        this.dragRenderTexture = global.PIXI?.RenderTexture?.create?.({
          width: Math.max(1, this.avatar.clientWidth),
          height: Math.max(1, this.avatar.clientHeight),
          resolution
        }) || null;
      }
    }

    copyDragFrame() {
      if (!this.dragContext || !this.avatar.classList.contains('live2d-drag-buffer')) return;
      this.syncDragCanvasSize();
      const gl = this.application?.renderer?.gl;
      const renderer = this.application?.renderer;
      const width = this.dragCanvas.width;
      const height = this.dragCanvas.height;
      const extract = renderer?.plugins?.extract;
      if (this.dragRenderTexture && extract?.pixels && this.dragContext.createImageData && this.dragContext.putImageData) {
        renderer.render(this.application.stage, {
          renderTexture: this.dragRenderTexture,
          clear: true
        });
        const pixels = extract.pixels(this.dragRenderTexture);
        if (pixels?.length === width * height * 4) {
          if (!this.dragImageData || this.dragImageData.data.length !== pixels.length) {
            this.dragImageData = this.dragContext.createImageData(width, height);
          }
          this.dragImageData.data.set(pixels);
          this.dragContext.putImageData(this.dragImageData, 0, 0);
          return;
        }
      }
      if (gl?.readPixels && this.dragContext.createImageData && this.dragContext.putImageData) {
        gl.finish?.();
        const pixelCount = width * height * 4;
        if (!this.dragPixels || this.dragPixels.length !== pixelCount) {
          this.dragPixels = new Uint8Array(pixelCount);
          this.dragImageData = this.dragContext.createImageData(width, height);
        }
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.dragPixels);
        const rowBytes = width * 4;
        for (let row = 0; row < height; row += 1) {
          const sourceStart = (height - row - 1) * rowBytes;
          this.dragImageData.data.set(
            this.dragPixels.subarray(sourceStart, sourceStart + rowBytes),
            row * rowBytes
          );
        }
        this.dragContext.putImageData(this.dragImageData, 0, 0);
        return;
      }
      this.dragContext.clearRect(0, 0, width, height);
      this.dragContext.drawImage(this.canvas, 0, 0, width, height);
    }

    prepareForWindowMove() {
      if (!this.isActive() || !this.application) return false;
      this.updateFrame();
      this.application.renderer.render(this.application.stage);
      this.copyDragFrame();
      return true;
    }

    beginWindowDrag() {
      if (!this.isActive() || !this.dragContext) return false;
      if (this.windowDragging) return true;
      clearTimeout(this.dragBufferTimer);
      this.dragBufferTimer = null;
      this.avatar.classList.add('live2d-drag-buffer');
      try {
        this.prepareForWindowMove();
        this.windowDragging = true;
        this.application?.stop();
      } catch {
        this.avatar.classList.remove('live2d-drag-buffer');
        this.emitStatus('drag-failed');
        return false;
      }
      return true;
    }

    endWindowDrag() {
      clearTimeout(this.dragBufferTimer);
      this.dragBufferTimer = null;
      this.windowDragging = false;
      if (this.pendingExpression) {
        const name = this.pendingExpression;
        this.pendingExpression = null;
        this.setExpression(name);
      }
      try {
        if (this.isActive()) {
          // Produce the first live frame before removing the snapshot. A fixed
          // timeout and opacity fade can expose a transparent WebGL surface.
          this.resize(true);
          this.application.renderer.render(this.application.stage);
          this.application.start();
        }
      } catch {
        this.state = 'failed';
        this.application?.stop();
        this.syncVisibility();
        this.emitStatus('failed');
      } finally {
        this.avatar.classList.remove('live2d-drag-buffer');
      }
    }

    setGaze(gaze) {
      this.targetGaze = {
        x: Math.max(-1, Math.min(1, Number(gaze?.x) || 0)),
        y: Math.max(-1, Math.min(1, Number(gaze?.y) || 0))
      };
    }

    now() {
      return global.performance?.now?.() ?? Date.now();
    }

    updateFrame(deltaMs = 0) {
      if (this.windowDragging) return;
      // Time-based easing has the same response at 30 and 60 fps. Only the
      // owned ticker advances it, so preference broadcasts cannot accelerate it.
      const blend = 1 - Math.exp(-Math.max(0, Math.min(deltaMs, 50)) / 160);
      this.gaze.x += (this.targetGaze.x - this.gaze.x) * blend;
      this.gaze.y += (this.targetGaze.y - this.gaze.y) * blend;
      this.applyGaze();
      this.applyMotion();
    }

    applyMotion() {
      if (!this.model || !this.basePosition) return;
      const now = this.now();
      const direction = this.context.walkingDirection < 0 ? -1 : 1;
      let offsetY = 0;
      let offsetX = 0;
      let rotation = 0;
      let stride = 0;

      if (this.context.walking) {
        const startedAt = this.walkStartedAt ?? now;
        this.walkStartedAt ??= startedAt;
        const phase = ((now - startedAt) / 420) * Math.PI * 2;
        stride = Math.sin(phase);
        const impact = 1 - Math.cos(phase * 2);
        offsetX += stride * 1.5;
        offsetY -= impact * 2.2;
        rotation += (stride * 0.7 - direction * 0.35) * (Math.PI / 180);
      }

      if (this.hopStartedAt !== null) {
        const progress = (now - this.hopStartedAt) / 620;
        if (progress >= 1) {
          this.hopStartedAt = null;
        } else {
          offsetY -= Math.sin(Math.max(0, progress) * Math.PI) * 12;
        }
      }

      this.applyWalkingParameters(stride);
      this.model.x = this.basePosition.x + offsetX;
      this.model.y = this.basePosition.y + offsetY;
      this.model.rotation = rotation;
    }

    setParameter(parameter, value) {
      const core = this.model?.internalModel?.coreModel;
      if (!core) return;
      try {
        core.setParameterValueById(parameter, value);
      } catch {
        // Runtime models are allowed to omit optional procedural parameters.
      }
    }

    applyWalkingParameters(stride) {
      const direction = this.context.walkingDirection < 0 ? -1 : 1;
      const activeStride = this.context.walking ? stride : 0;
      const bodySway = activeStride * 5;
      const runLean = this.context.walking ? direction * 2.2 : 0;
      const values = [
        ['ParamAngle_Foot_L', activeStride * 18],
        ['ParamAngle_Foot_R', activeStride * -18],
        ['ParamAngle_ShoulderL', activeStride * -4],
        ['ParamAngle_ShoulderR', activeStride * 4],
        ['ParamAngle_BodyX', runLean],
        ['ParamAngle_BodyZ', bodySway],
        ['ParamAngle_ChestZ', bodySway * -0.65],
        ['ParamAngle_HipZ', bodySway * 0.8],
        ['ParamAngle_HeadZ', bodySway * -0.35]
      ];
      for (const [parameter, value] of values) this.setParameter(parameter, value);
    }

    applyGaze() {
      if (this.windowDragging) return;
      if (!this.model?.internalModel?.coreModel || !this.isActive()) return;
      const { x, y } = this.gaze;
      const head = this.gazeStyle === 'eyes-only' ? 0 : 1;
      const values = [
        ['ParamEyeBallX', x],
        ['ParamEyeBallY', -y],
        ['ParamAngleX', x * 8 * head],
        ['ParamAngleY', -y * 6 * head],
        ['ParamAngleZ', x * -1.2 * head],
        ['ParamBodyAngleX', x * 1.5 * head],
        ['ParamBodyAngleY', -y * head]
      ];
      for (const [parameter, value] of values) {
        this.setParameter(parameter, value);
      }
    }

    setExpression(name) {
      if (this.destroyed) return;
      if (this.windowDragging) { this.pendingExpression = name; return; }
      if (!this.model || this.state !== 'ready' || this.currentExpression === name) return;
      try {
        this.currentExpression = name;
        const result = this.model.expression(name);
        Promise.resolve(result).then((applied) => {
          if (applied === false && this.currentExpression === name) this.currentExpression = null;
        }).catch(() => {
          if (this.currentExpression === name) this.currentExpression = null;
        });
      } catch {
        this.currentExpression = null;
        // Expression availability is model-specific; neutral rendering remains valid.
      }
    }

    react(command = 'hello') {
      if (!this.isActive()) return false;
      if (this.windowDragging) return true;
      if (this.now() - this.lastReactionAt < 900 && (command !== 'hop' || this.lastReactionCommand === 'hop')) return true;
      this.lastReactionAt = this.now();
      this.lastReactionCommand = command;
      clearTimeout(this.expressionTimer);
      if (command === 'hop') this.hopStartedAt = this.now();
      const friendly = ['smile', 'shy', 'bsmile'];
      this.setExpression(command === 'hop' ? 'surprised' : friendly[this.reactionIndex++ % friendly.length]);
      this.expressionTimer = setTimeout(() => this.setExpression('neutral'), 2200);
      return true;
    }

    destroy() {
      this.destroyed = true;
      this.canvas.removeEventListener?.('webglcontextlost', this.contextLost);
      clearTimeout(this.expressionTimer);
      clearTimeout(this.dragBufferTimer);
      this.resizeObserver?.disconnect();
      this.avatar.classList.remove('live2d-drag-buffer');
      this.application?.destroy(true, { children: true, texture: true, baseTexture: true });
      this.dragRenderTexture?.destroy(true);
      this.application = null;
      this.model = null;
      this.dragPixels = null;
      this.dragImageData = null;
      this.dragRenderTexture = null;
      this.basePosition = null;
      this.walkStartedAt = null;
      this.hopStartedAt = null;
      this.currentExpression = null;
    }
  }

  global.YachiyoLive2DRenderer = YachiyoLive2DRenderer;
})(window);
