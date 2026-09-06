const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  contains(name) {
    return this.values.has(name);
  }

  toggle(name, force) {
    if (force) this.values.add(name);
    else this.values.delete(name);
  }

  add(name) {
    this.values.add(name);
  }

  remove(name) {
    this.values.delete(name);
  }
}

function loadRenderer(pixi, now = () => 0) {
  const events = [];
  const window = {
    PIXI: pixi,
    devicePixelRatio: 1,
    performance: { now },
    dispatchEvent: (event) => events.push(event)
  };
  const sandbox = {
    window,
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    clearTimeout,
    setTimeout,
    console: { error() {} }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'live2d.js'), 'utf8');
  vm.runInNewContext(source, sandbox);
  return { Renderer: window.YachiyoLive2DRenderer, events };
}

function createElements() {
  const dragDraws = [];
  return {
    avatar: {
      clientWidth: 200,
      clientHeight: 300,
      dataset: {},
      classList: new FakeClassList()
    },
    canvas: {
      width: 200,
      height: 300,
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      }
    },
    dragCanvas: {
      width: 0,
      height: 0,
      getContext() {
        return {
          clearRect() {},
          drawImage(...args) { dragDraws.push(args); },
          createImageData(width, height) {
            return { data: new Uint8ClampedArray(width * height * 4) };
          },
          putImageData(...args) { dragDraws.push(args); }
        };
      }
    },
    dragDraws
  };
}

test('Live2D renderer stays active while Yachiyo is walking', async () => {
  let now = 0;
  const parameters = new Map();
  const expressions = [];
  const updates = [];
  const model = {
    update(delta) { updates.push(delta); },
    width: 100,
    height: 240,
    anchor: { set() {} },
    scale: { set(value) { model.lastScale = value; } },
    internalModel: {
      coreModel: {
        setParameterValueById(name, value) {
          parameters.set(name, value);
        }
      }
    },
    expression(name) {
      expressions.push(name);
    }
  };
  const application = {
    stage: { addChild() {} },
    tickerCallbacks: [],
    ticker: { add(callback, _context, priority) { application.tickerCallbacks.push({ callback, priority }); } },
    renderer: {
      resolution: 1,
      resize(width, height) { application.size = { width, height }; },
      render() { application.renderCount = (application.renderCount || 0) + 1; },
      plugins: {
        extract: {
          pixels() {
            const pixels = new Uint8Array(200 * 300 * 4);
            pixels.fill(255);
            return pixels;
          }
        }
      },
      gl: {
        RGBA: 6408,
        UNSIGNED_BYTE: 5121,
        finish() {},
        readPixels(_x, _y, _width, _height, _format, _type, pixels) { pixels.fill(255); }
      }
    },
    start() { application.started = true; },
    stop() { application.started = false; },
    destroy() {}
  };
  const pixi = {
    Application: class Application {
      constructor(options) {
        application.options = options;
        return application;
      }
    },
    UPDATE_PRIORITY: { HIGH: 25, UTILITY: -50 },
    RenderTexture: {
      create(options) {
        return {
          options,
          destroy() { application.renderTextureDestroyed = true; }
        };
      }
    },
    live2d: { Live2DModel: { from: async () => model } }
  };
  const { Renderer, events } = loadRenderer(pixi, () => now);
  const { avatar, canvas, dragCanvas, dragDraws } = createElements();
  const renderer = new Renderer({ avatar, canvas, dragCanvas, modelUrl: 'model3.json' });

  renderer.setMode('live2d');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(renderer.state, 'ready');
  assert.equal(renderer.isActive(), true);
  assert.equal(application.started, true);
  assert.equal(application.options.preserveDrawingBuffer, true);
  assert.deepEqual(application.size, { width: 200, height: 300 });
  assert.equal(events.at(-1).detail.status, 'ready');

  renderer.setGaze({ x: 0.5, y: -0.25 });
  assert.equal(parameters.get('ParamEyeBallX'), 0, 'gaze events update only the target');
  renderer.updateFrame(16);
  assert.ok(parameters.get('ParamEyeBallX') > 0 && parameters.get('ParamEyeBallX') < 0.5);
  assert.equal(parameters.get('ParamAngleX'), renderer.gaze.x * 8);

  assert.equal(renderer.react('hello'), true);
  assert.equal(renderer.react('hello'), true);
  assert.deepEqual(expressions, ['neutral', 'smile']);

  renderer.setContext({ walking: true, walkingDirection: -1 });
  assert.equal(renderer.isActive(), true);
  assert.equal(application.started, true);
  now = 105;
  for (const entry of application.tickerCallbacks.sort((a, b) => b.priority - a.priority)) entry.callback();
  assert.equal(parameters.get('ParamAngle_Foot_L'), 18);
  assert.equal(parameters.get('ParamAngle_Foot_R'), -18);
  assert.equal(parameters.get('ParamAngle_BodyX'), -2.2);
  assert.notEqual(model.y, 300 * 0.515);
  assert.equal(renderer.beginWindowDrag(), true);
  assert.equal(avatar.classList.contains('live2d-drag-buffer'), true);
  assert.equal(application.started, false);
  assert.equal(application.renderCount > 0, true);
  assert.equal(dragDraws.length > 0, true);
  const frozenDrawCount = dragDraws.length;
  renderer.beginWindowDrag();
  assert.equal(dragDraws.length, frozenDrawCount);
  const frozenUpdateCount = updates.length;
  assert.equal(application.tickerCallbacks.length, 1);
  application.tickerCallbacks[0].callback();
  assert.equal(dragDraws.length, frozenDrawCount);
  assert.equal(updates.length, frozenUpdateCount);
  renderer.endWindowDrag();
  assert.equal(application.started, true);
  assert.equal(avatar.classList.contains('live2d-drag-buffer'), false);
  application.ticker.deltaMS = 8000;
  application.tickerCallbacks[0].callback();
  assert.equal(updates.at(-1), 50, 'resume cannot apply seconds of accumulated physics');
  assert.equal(application.ticker.maxFPS, 60);

  renderer.setOptions({ graphicsMode: 'economy', gazeStyle: 'eyes-only' });
  assert.equal(application.ticker.maxFPS, 30);
  renderer.updateFrame(33);
  assert.equal(parameters.get('ParamAngleX'), 0);
  assert.ok(parameters.get('ParamEyeBallX') > 0);
  renderer.setContext({ visible: false });
  assert.equal(application.started, false);
  const hiddenClock = updates.length;
  application.tickerCallbacks[0].callback();
  assert.equal(updates.length, hiddenClock);
  renderer.setContext({ visible: true });
  assert.equal(application.started, true);
  renderer.setOptions({ graphicsMode: 'standard' });
  assert.equal(application.ticker.maxFPS, 60);

  renderer.setContext({ walking: false, form: 'kaguya' });
  assert.equal(parameters.get('ParamAngle_Foot_L'), 0);
  assert.equal(renderer.isActive(), false);

  renderer.setContext({ form: 'yachiyo' });
  renderer.setMode('sprite');
  assert.equal(renderer.isActive(), false);
  renderer.destroy();
  assert.equal(avatar.classList.contains('live2d-drag-buffer'), false);
});

test('gaze easing is frame-rate independent and frozen during dragging', () => {
  const { Renderer } = loadRenderer(undefined);
  const a = new Renderer({ ...createElements() });
  const b = new Renderer({ ...createElements() });
  a.setGaze({ x: 1, y: -1 });
  b.setGaze({ x: 1, y: -1 });
  for (let i = 0; i < 60; i++) a.updateFrame(1000 / 60);
  for (let i = 0; i < 30; i++) b.updateFrame(1000 / 30);
  assert.ok(Math.abs(a.gaze.x - b.gaze.x) < 1e-12);
  assert.ok(a.gaze.x > 0.99 && a.gaze.x < 1);
  a.windowDragging = true;
  const frozen = a.gaze.x;
  a.setGaze({ x: -1, y: 0 });
  a.updateFrame(50);
  assert.equal(a.gaze.x, frozen);
  a.destroy(); b.destroy();
});

test('expression cooldown, deferred neutral and async failures are contained', async () => {
  let now = 0;
  const { Renderer } = loadRenderer(undefined, () => now);
  const renderer = new Renderer({ ...createElements() });
  renderer.avatar.classList.add('live2d-active');
  renderer.state = 'ready';
  const expressions = [];
  renderer.model = { expression(name) { expressions.push(name); return Promise.resolve(true); } };
  renderer.react(); renderer.react();
  assert.deepEqual(expressions, ['smile']);
  now = 100; renderer.react('hop');
  assert.equal(renderer.hopStartedAt, 100, 'double click can upgrade a pending single click');
  now = 200; renderer.react('hop');
  assert.equal(renderer.hopStartedAt, 100, 'repeated hop does not restart');
  now = 1000; renderer.react();
  assert.deepEqual(expressions, ['smile', 'surprised', 'shy']);
  renderer.windowDragging = true;
  renderer.setExpression('neutral');
  assert.equal(expressions.length, 3);
  assert.equal(renderer.pendingExpression, 'neutral');
  renderer.windowDragging = false;
  renderer.model.expression = () => Promise.reject(new Error('missing expression'));
  renderer.setExpression('neutral');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renderer.currentExpression, null);
  renderer.destroy();
});

test('Live2D renderer keeps the Sprite fallback when its runtime is missing', async () => {
  const { Renderer, events } = loadRenderer(undefined);
  const { avatar, canvas } = createElements();
  const renderer = new Renderer({ avatar, canvas, modelUrl: 'missing.model3.json' });

  renderer.setMode('live2d');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(renderer.state, 'failed');
  assert.equal(renderer.isActive(), false);
  assert.equal(events.at(-1).detail.status, 'failed');
  const failedEvents = events.length;
  renderer.setMode('live2d');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, failedEvents, 'preference broadcasts must not trigger retry loops');
});

test('destroy during model loading disposes the late model without restarting rendering', async () => {
  let resolveModel;
  let modelDestroyed = false;
  let appDestroyed = false;
  const pixi = {
    Application: class {
      destroy() { appDestroyed = true; }
    },
    live2d: { Live2DModel: { from: () => new Promise((resolve) => { resolveModel = resolve; }) } }
  };
  const { Renderer, events } = loadRenderer(pixi);
  const renderer = new Renderer({ ...createElements(), modelUrl: 'model3.json' });
  renderer.setMode('live2d');
  renderer.destroy();
  resolveModel({ destroy() { modelDestroyed = true; } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(modelDestroyed, true);
  assert.equal(appDestroyed, true);
  assert.equal(renderer.isActive(), false);
  assert.equal(events.length, 0);
});
