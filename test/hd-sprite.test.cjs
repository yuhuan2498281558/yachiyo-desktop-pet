const test = require('node:test');
const assert = require('node:assert/strict');
const Renderer = require('../src/renderer/hd-sprite.js');

function fixture(motion = false) {
  let clock = 0, id = 0, errors = 0;
  const tasks = new Map(), classes = new Set(), images = [], listeners = new Map();
  const doc = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name) };
  const renderer = new Renderer({ avatar: { classList: {
    toggle: (name, on) => on ? classes.add(name) : classes.delete(name), remove: (name) => classes.delete(name)
  } }, element: { style: {}, dataset: {} }, url: 'atlas.webp', document: doc,
  ...(motion ? { runUrl: 'run.webp', gazeUrl: 'gaze.webp', gazeElement: { style: {}, dataset: {} } } : {}),
  imageFactory: () => { const image = { naturalWidth: 2304, naturalHeight: 832 }; images.push(image); return image; },
  now: () => clock, random: () => 0.5,
  schedule: (fn, ms) => { tasks.set(++id, { fn, due: clock + ms }); return id; },
  cancel: (timer) => tasks.delete(timer), onError: () => errors++ });
  renderer.setContext({ mode: 'sprite-hd', form: 'yachiyo', sceneMode: 'none', visible: true });
  function advance(ms) {
    const end = clock + ms;
    for (;;) {
      const next = [...tasks.entries()].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      clock = next[1].due; tasks.delete(next[0]); next[1].fn();
    }
    clock = end;
  }
  return { renderer, images, classes, tasks, doc, listeners, advance, errors: () => errors };
}

test('HD atlas is decoded before swapping and blink uses open-half-closed-half-open', async () => {
  const f = fixture(), r = f.renderer;
  assert.equal(r.isActive(), false);
  await f.images[0].onload();
  assert.equal(r.isActive(), true);
  assert.equal(f.tasks.size, 1);
  f.advance(3499); assert.equal(r.frame, 0);
  f.advance(1); assert.equal(r.frame, 1);
  f.advance(70); assert.equal(r.frame, 2);
  f.advance(100); assert.equal(r.frame, 1);
  f.advance(90); assert.equal(r.frame, 0);
  assert.equal(f.images.length, 1);
});

async function loadedMotion() {
  const f = fixture(true);
  await f.images[0].onload();
  f.images[1].naturalWidth = 3072;
  f.images[2].naturalWidth = 1496; f.images[2].naturalHeight = 680;
  await f.images[1].onload(); await f.images[2].onload();
  return f;
}

test('horizontal drag runs at 280ms per frame, direction flips preserve phase and stopping returns idle', async () => {
  const f = await loadedMotion(), r = f.renderer;
  assert.equal(r.running, false);
  f.advance(20000); assert.equal(r.running, false);
  assert.equal(r.updateDrag(10), false);
  r.setContext({ dragging: true });
  assert.equal(r.running, false);
  assert.equal(r.updateDrag(10), true);
  assert.equal(r.element.dataset.action, 'run');
  for (let i = 1; i <= 12; i++) {
    f.advance(100);
    assert.equal(r.frame, Math.floor(i * 100 / 280) % 4);
    assert.equal(r.updateDrag(5), true);
    assert.equal(r.react(), true);
  }
  const phase = r.frame;
  r.updateDrag(-2); assert.equal(r.element.dataset.direction, 'right');
  r.updateDrag(-7); assert.equal(r.element.dataset.direction, 'left');
  assert.equal(r.frame, phase);
  assert.equal(r.element.style.transform, 'scaleX(-1)');
  r.updateDrag(1); assert.equal(r.element.dataset.direction, 'left');
  f.advance(180);
  assert.equal(r.running, false); assert.equal(r.frame, 0);
  assert.equal(r.element.dataset.action, 'idle');
  assert.equal(r.element.style.transform, 'none');
  assert.equal(r.timer, null);
  assert.equal(r.updateDrag(-10), true);
  r.setContext({ dragging: false }); assert.equal(r.running, false);
  assert.equal(r.dragIdleTimer, null);
});

test('vertical drag and tiny jitter do not start a run; hidden/mode/scene/form cancel a run', async () => {
  const f = await loadedMotion(), r = f.renderer;
  r.setContext({ dragging: true });
  for (const dx of [0, 1, -1, 1, -1, NaN]) r.updateDrag(dx);
  assert.equal(r.running, false);
  r.updateDrag(3); f.advance(200); r.updateDrag(2);
  assert.equal(r.running, false);
  for (const change of [{ visible: false }, { mode: 'live2d' }, { sceneMode: 'starry-sea' }, { form: 'kaguya' }, { transient: true }]) {
    r.setContext({ mode: 'sprite-hd', form: 'yachiyo', sceneMode: 'none', transient: false, visible: true, dragging: true });
    assert.equal(r.updateDrag(10), true);
    r.setContext(change); assert.equal(r.running, false);
    assert.equal(r.dragIdleTimer, null);
  }
});

test('eye follow eases to a clamped target, freezes on drag and recenters when disabled', async () => {
  const f = await loadedMotion(), r = f.renderer;
  r.setGaze({ x: 2, y: -3 });
  f.advance(33);
  assert.ok(r.gaze.x > 0 && r.gaze.x < 1);
  r.setContext({ dragging: true });
  const frozen = { ...r.gaze };
  r.setGaze({ x: -1, y: 1 }); f.advance(5000);
  assert.deepEqual(r.gaze, frozen); assert.equal(r.gazeTimer, null);
  r.setContext({ dragging: false }); f.advance(1000);
  assert.equal(r.gazeElement.dataset.direction, '16,0');
  assert.equal(r.gazeTimer, null);
  r.setContext({ gazeTracking: false });
  assert.equal(r.gazeElement.dataset.direction, '8,8');
  r.setGaze({ x: -1, y: 1 }); f.advance(1000);
  assert.deepEqual(r.gaze, { x: 0, y: 0 });
  r.setContext({ gazeTracking: true }); r.setGaze({ x: NaN, y: Infinity });
  assert.deepEqual(r.gazeTarget, { x: 0, y: 0 });
});

test('eye layer never covers blinking/running and hidden state leaves no motion timers', async () => {
  const f = await loadedMotion(), r = f.renderer;
  assert.equal(r.gazeElement.style.display, 'block');
  r.react(); assert.equal(r.gazeElement.style.display, 'none');
  f.advance(260); assert.equal(r.gazeElement.style.display, 'block');
  r.setContext({ dragging: true }); r.updateDrag(10); assert.equal(r.gazeElement.style.display, 'none');
  r.setContext({ visible: false }); r.setGaze({ x: 1, y: 1 });
  assert.equal(f.tasks.size, 0);
  r.setContext({ visible: true }); f.advance(33);
  r.destroy(); assert.equal(f.tasks.size, 0);
  assert.equal(r.gazeElement.style.display, 'none');
});

test('optional motion assets can fail or time out without replacing the approved idle', async () => {
  for (const failure of ['missing', 'size', 'decode', 'timeout']) {
    const f = fixture(true), r = f.renderer;
    await f.images[0].onload();
    if (failure === 'missing') f.images[1].onerror();
    if (failure === 'size') await f.images[1].onload();
    if (failure === 'decode') { f.images[1].decode = async () => { throw Error(); }; await f.images[1].onload(); }
    if (failure === 'timeout') f.advance(10000);
    assert.equal(r.isActive(), true);
    assert.equal(r.extras.run.status, 'failed');
    r.setContext({ dragging: true }); assert.equal(r.updateDrag(10), false);
    assert.equal(r.element.dataset.action, 'idle');
    r.destroy(); assert.equal(f.tasks.size, 0);
  }
});

test('drag, hidden window, document hidden and form transitions freeze the remaining blink time', async () => {
  const f = fixture(), r = f.renderer;
  await f.images[0].onload();
  f.advance(1200);
  for (const [off, on] of [[{ dragging: true }, { dragging: false }],
    [{ visible: false }, { visible: true }], [{ transient: true }, { transient: false }],
    [{ form: 'kaguya' }, { form: 'yachiyo' }], [{ sceneMode: 'starry-sea' }, { sceneMode: 'none' }]]) {
    r.setContext(off);
    assert.equal(f.tasks.size, 0);
    f.advance(9000); assert.equal(r.frame, 0);
    r.setContext(on);
    assert.equal(r.remaining, 2300);
  }
  f.doc.hidden = true; f.listeners.get('visibilitychange')();
  f.advance(10000); assert.equal(r.frame, 0);
  f.doc.hidden = false; f.listeners.get('visibilitychange')();
  f.advance(2300); assert.equal(r.frame, 1);
  r.setContext({ dragging: true }); f.advance(10000); assert.equal(r.frame, 1);
  r.setContext({ dragging: false }); f.advance(70); assert.equal(r.frame, 2);
});

test('rapid clicks are consumed without restarting blink or falling back to classic actions', async () => {
  const f = fixture(), r = f.renderer;
  await f.images[0].onload();
  assert.equal(r.react(), true);
  f.advance(70); assert.equal(r.frame, 2);
  for (let i = 0; i < 20; i++) assert.equal(r.react(), true);
  f.advance(190); assert.equal(r.frame, 0);
  r.setContext({ mode: 'sprite' });
  assert.equal(r.react(), false);
  assert.equal(f.tasks.size, 0);
  r.setContext({ mode: 'sprite-hd' });
  assert.equal(f.images.length, 1);
});

test('missing, malformed, timed-out and decode-failed atlases fall back; mode toggle retries once', async () => {
  for (const failure of ['missing', 'size', 'timeout', 'decode']) {
    const f = fixture(), r = f.renderer;
    if (failure === 'missing') f.images[0].onerror();
    if (failure === 'size') { f.images[0].naturalWidth = 1; await f.images[0].onload(); }
    if (failure === 'timeout') f.advance(10000);
    if (failure === 'decode') { f.images[0].decode = () => Promise.reject(new Error()); await f.images[0].onload(); }
    assert.equal(r.status, 'failed', failure);
    assert.equal(r.isActive(), false);
    assert.equal(f.errors(), 1);
    r.setContext({ visible: true }); assert.equal(f.images.length, 1);
    r.setContext({ mode: 'sprite' }); r.setContext({ mode: 'sprite-hd' });
    await f.images[1].onload(); assert.equal(r.isActive(), true);
  }
});

test('destroy cancels timers/listeners and an in-flight decode cannot reactivate the renderer', async () => {
  const f = fixture(), r = f.renderer;
  let resolve;
  f.images[0].decode = () => new Promise((done) => { resolve = done; });
  const loading = f.images[0].onload();
  r.destroy(); resolve(); await loading;
  f.advance(20000);
  assert.equal(f.tasks.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(r.isActive(), false);
});
