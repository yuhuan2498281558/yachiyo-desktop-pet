const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(api) {
  const report = { checks: [], passed: false };
  const reportPath = path.resolve(process.env.YACHIYO_SMOKE_REPORT);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const window = api.getWindow();
  const wc = window.webContents;
  const evaluate = (source) => wc.executeJavaScript(source);
  async function until(check, label, timeout = 10000) {
    const deadline = Date.now() + timeout;
    while (!(await check())) {
      if (Date.now() >= deadline) throw new Error(`Timed out: ${label}`);
      await delay(50);
    }
  }
  async function release() {
    const bounds = window.getBounds();
    wc.sendInputEvent({ type: 'mouseUp', x: 150, y: 180, globalX: bounds.x + 150,
      globalY: bounds.y + 180, button: 'left', clickCount: 1 });
    await until(() => !api.getState().dragging, 'pointer released');
  }
  try {
    await until(() => !wc.isLoading(), 'document ready');
    api.setPreference('identityMode', 'yachiyo');
    api.setPreference('yachiyoRenderer', 'live2d');
    api.setPreference('wandering', true);
    api.applySize('large');
    api.showPet();
    window.focus();
    await until(() => evaluate('live2dRenderer?.isActive()'), 'Live2D ready');
    assert.equal(await evaluate('live2dRenderer.model.autoUpdate'), false);
    report.checks.push('Live2D loaded in real Electron');

    const initialPosition = window.getPosition();
    api.startWalking();
    api.tickWalking();
    await delay(750);
    assert.equal(api.getState().walk.active, false);
    assert.deepEqual(window.getPosition(), initialPosition);
    report.checks.push('old wandering=true cannot move Live2D');

    for (let index = 0; index < 3; index++) {
      api.setPreference('graphicsMode', index === 1 ? 'economy' : 'standard');
      await until(() => evaluate(`live2dRenderer.application.ticker.maxFPS === ${index === 1 ? 30 : 60}`), 'quality applied');
      window.focus();
      await evaluate(`pet.addEventListener('pointermove', (event) => {
        window.lastTestPointer = { pointerId: event.pointerId, screenX: event.screenX, screenY: event.screenY,
          clientX: event.clientX, clientY: event.clientY, buttons: event.buttons };
      }, { once: true })`);
      const bounds = window.getBounds();
      wc.sendInputEvent({ type: 'mouseDown', x: 150, y: 180, globalX: bounds.x + 150,
        globalY: bounds.y + 180, button: 'left', clickCount: 1 });
      await until(() => api.getState().dragging, 'pointer captured');
      wc.sendInputEvent({ type: 'mouseMove', x: 125, y: 165, globalX: bounds.x + 125,
        globalY: bounds.y + 165, modifiers: ['leftButtonDown'] });
      await until(() => evaluate('live2dRenderer.windowDragging'), 'static drag snapshot');
      const sample = await evaluate(`(() => {
        const c = document.getElementById('live2dDragCanvas');
        const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        return { pixels: c.toDataURL(), alpha: data.reduce((n, v, i) => n + (i % 4 === 3 ? v : 0), 0),
          ticker: live2dRenderer.application.ticker.started };
      })()`);
      assert.ok(sample.alpha > 0);
      assert.equal(sample.ticker, false);
      const frozenClock = await evaluate('live2dRenderer.model.elapsedTime');
      await delay(150);
      assert.equal(await evaluate('live2dRenderer.model.elapsedTime'), frozenClock);
      assert.equal(await evaluate("document.getElementById('live2dDragCanvas').toDataURL()"), sample.pixels);
      api.startWalking();
      assert.equal(api.getState().walk.active, false);
      if (index === 0) {
        fs.writeFileSync(`${reportPath}.drag.png`, (await wc.capturePage()).toPNG());
        wc.send('pet:work-state', { mode: 'auto', working: true, activeCount: 1 });
        await delay(80);
        assert.equal(await evaluate('form'), 'yachiyo');
      }
      await release();
      if (index === 0) {
        wc.send('pet:work-state', { mode: 'auto', working: true, activeCount: 2 });
        await until(() => evaluate("form === 'kaguya' && !transient"), 'deferred transformation');
        assert.equal(api.getState().rendererBusy, false);
        wc.send('pet:work-state', { mode: 'yachiyo', working: false, outcome: 'ready' });
      }
      await until(() => evaluate('live2dRenderer.isActive() && !live2dRenderer.windowDragging'), 'Live2D resumes');
    }
    assert.notDeepEqual(window.getPosition(), initialPosition);
    report.checks.push('three real pointer drags preserve frozen pixels, move window and resume Live2D');
    report.checks.push('work transition is deferred until release; duplicate work count does not cancel it');

    wc.send('pet:work-state', { mode: 'auto', working: true });
    await until(() => evaluate('transient'), 'transformation starts');
    const transformBounds = window.getBounds();
    wc.sendInputEvent({ type: 'mouseDown', x: 150, y: 180, globalX: transformBounds.x + 150,
      globalY: transformBounds.y + 180, button: 'left', clickCount: 1 });
    await until(() => api.getState().dragging, 'drag during transformation');
    const heldFrame = await evaluate('sprite.style.backgroundPosition || sprite.style.cssText');
    await delay(1100);
    assert.equal(await evaluate('sprite.style.backgroundPosition || sprite.style.cssText'), heldFrame);
    assert.equal(await evaluate('form'), 'yachiyo');
    await release();
    await until(() => evaluate("form === 'kaguya' && !transient"), 'paused transformation resumes');
    wc.send('pet:work-state', { mode: 'yachiyo', working: false, outcome: 'ready' });
    await until(() => evaluate('live2dRenderer.isActive()'), 'Live2D after held transformation');
    report.checks.push('drag pauses an already running Sprite transformation until release');

    api.setPreference('yachiyoRenderer', 'sprite');
    await until(() => evaluate('!live2dRenderer.isActive()'), 'Sprite fallback');
    api.startWalking();
    assert.equal(api.getState().walk.active, true);
    api.setClickThrough(true);
    assert.equal(api.getState().walk.active, false);
    api.setClickThrough(false);
    api.startWalking();
    api.hidePet();
    assert.equal(api.getState().walk.active, false);
    api.showPet();
    report.checks.push('Sprite walking works; click-through and hiding stop movement');

    api.setPreference('yachiyoRenderer', 'sprite-hd');
    await until(() => evaluate('hdSpriteRenderer.isActive()'), 'decoded HD atlas ready');
    assert.equal(await evaluate('live2dRenderer.isActive()'), false);
    assert.equal(await evaluate("getComputedStyle(sprite).display"), 'none');
    const hdPosition = window.getPosition();
    api.startWalking(); api.tickWalking();
    await delay(150);
    assert.equal(api.getState().walk.active, false);
    assert.deepEqual(window.getPosition(), hdPosition);
    const hdAlpha = await evaluate(`(() => {
      const canvas = document.createElement('canvas'); canvas.width = 2304; canvas.height = 832;
      const ctx = canvas.getContext('2d'); ctx.drawImage(hdSpriteRenderer.image, 0, 0);
      const data = ctx.getImageData(0, 0, 2304, 832).data;
      let transparent = 0, opaque = 0, alphaMismatch = 0, bodyMismatch = 0;
      for (let y = 0; y < 832; y++) for (let x = 0; x < 768; x++) {
        const p = (y * 2304 + x) * 4;
        if (data[p + 3] === 0) transparent++;
        if (data[p + 3] === 255) opaque++;
        for (const offset of [768 * 4, 1536 * 4]) {
          if (data[p + 3] !== data[p + offset + 3]) alphaMismatch++;
          if (x < 347 || x >= 424 || y < 114 || y >= 142) for (let c = 0; c < 4; c++) {
            if (data[p + c] !== data[p + offset + c]) bodyMismatch++;
          }
        }
      }
      return { transparent, opaque, alphaMismatch, bodyMismatch };
    })()`);
    assert.ok(hdAlpha.transparent > 300000 && hdAlpha.opaque > 200000);
    assert.equal(await evaluate("hdSpriteRenderer.image.src.endsWith('/yachiyo-hd-idle-v3.webp')"), true);
    assert.equal(hdAlpha.alphaMismatch, 0); assert.equal(hdAlpha.bodyMismatch, 0);
    report.hdAlpha = hdAlpha;
    report.checks.push('HD lossless atlas has true alpha and identical non-eye pixels; auto-walk blocked');

    await until(() => evaluate("hdSpriteRenderer.extras.run?.status === 'ready' && hdSpriteRenderer.extras.gaze?.status === 'ready'"), 'HD motion assets decoded');
    assert.equal(await evaluate("hdSpriteRenderer.extras.run.image.src.endsWith('/yachiyo-hd-run-gentle-v5.webp')"), true);
    const motionPixels = await evaluate(`(() => {
      const read = (image) => { const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
        const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data; };
      const run = read(hdSpriteRenderer.extras.run.image), gaze = read(hdSpriteRenderer.extras.gaze.image), idle = read(hdSpriteRenderer.image);
      let headMismatch = 0, gazeOutside = 0, gazeAlpha = 0, eyeChanges = 0, runChanges = 0, transparent = 0, runBorderPixels = 0;
      const headTop = [832, 832, 832, 832];
      for (let y = 0; y < 832; y++) for (let x = 0; x < 768; x++) {
        const p = (y * 3072 + x) * 4;
        if (run[p + 3] === 0) transparent++;
        for (let frame = 0; frame < 4; frame++) {
          const alpha = run[p + frame * 768 * 4 + 3];
          if (alpha && (x === 0 || x === 767 || y === 0 || y === 831)) runBorderPixels++;
          if (alpha > 200 && x >= 400 && x < 560 && y < 265) headTop[frame] = Math.min(headTop[frame], y);
        }
        for (let c = 0; c < 4; c++) if (run[p + c] !== run[p + 768 * 4 + c]) {
          if (y < 265) headMismatch++; else runChanges++;
        }
      }
      for (let gy = 0; gy < 17; gy++) for (let gx = 0; gx < 17; gx++) {
        for (let y = 0; y < 40; y++) for (let x = 0; x < 88; x++) {
          const p = ((gy * 40 + y) * 1496 + gx * 88 + x) * 4, q = ((110 + y) * 2304 + 342 + x) * 4;
          if (gaze[p + 3] !== idle[q + 3]) gazeAlpha++;
          const eye = y >= 8 && y < 27 && ((x >= 9 && x < 34) || (x >= 53 && x < 77));
          for (let c = 0; c < 3; c++) if (gaze[p + c] !== idle[q + c] && gaze[p + 3]) {
            if (eye) eyeChanges++; else gazeOutside++;
          }
        }
      }
      return { headChangedPixels: headMismatch, headTop, runBorderPixels, gazeOutside, gazeAlpha, eyeChanges, runChanges, transparent };
    })()`);
    // Whole side drawings keep natural head variation. A rectangular head paste
    // was visually rejected because it produced a seam across the neck/hair.
    assert.equal(motionPixels.runBorderPixels, 0);
    assert.ok(motionPixels.headTop.every((y) => y > 50 && y < 140));
    assert.ok(Math.max(...motionPixels.headTop) - Math.min(...motionPixels.headTop) <= 24);
    assert.equal(motionPixels.gazeOutside, 0); assert.equal(motionPixels.gazeAlpha, 0);
    assert.ok(motionPixels.eyeChanges > 0 && motionPixels.runChanges > 1000 && motionPixels.transparent > 300000);
    report.hdMotion = motionPixels;
    report.checks.push('side-run frames are unclipped with bounded head alignment; eye-only gaze verified after decode');

    const runPosition = window.getPosition();
    wc.send('pet:command', 'run-hd');
    await delay(350);
    assert.equal(await evaluate('hdSpriteRenderer.running'), false);
    assert.deepEqual(window.getPosition(), runPosition);
    report.checks.push('retired in-place run command cannot animate or move HD');

    api.setPreference('gazeTracking', false);
    await until(() => evaluate('!gazeTracking'), 'global gaze off for deterministic IPC check');
    await evaluate('gazeTracking = true; hdSpriteRenderer.setContext({ gazeTracking: true });');
    wc.send('pet:gaze', { index: 4, x: 1, y: -1 });
    await until(() => evaluate("document.getElementById('hdGaze').dataset.direction === '16,0'"), 'HD follows mouse IPC');
    fs.writeFileSync(`${reportPath}.hd-gaze.png`, (await wc.capturePage()).toPNG());
    api.setPreference('gazeTracking', false);
    await until(() => evaluate("document.getElementById('hdGaze').dataset.direction === '8,8'"), 'HD gaze recenters');
    api.setPreference('gazeTracking', true);
    report.checks.push('HD mouse gaze IPC eases to target and global toggle restores neutral eyes');

    window.focus();
    const hdBounds = window.getBounds();
    wc.sendInputEvent({ type: 'mouseDown', x: 150, y: 180, globalX: hdBounds.x + 150,
      globalY: hdBounds.y + 180, button: 'left', clickCount: 1 });
    await until(() => api.getState().dragging, 'HD pointer captured');
    assert.equal(await evaluate('hdSpriteRenderer.running'), false);
    let cursorX = hdBounds.x + 150;
    const cursorY = hdBounds.y + 180;
    const runFrames = new Set();
    for (const direction of [-1, 1]) {
      const positionBefore = window.getPosition()[0];
      for (let i = 0; i < 13; i++) {
        cursorX += direction * 10;
        const bounds = window.getBounds();
        wc.sendInputEvent({ type: 'mouseMove', x: cursorX - bounds.x, y: cursorY - bounds.y,
          globalX: cursorX, globalY: cursorY, modifiers: ['leftButtonDown'] });
        await delay(70);
        assert.equal(await evaluate('hdSpriteRenderer.running && hdSpriteRenderer.isActive() && !walking && !transient'), true);
        assert.equal(await evaluate('hdSpriteRenderer.runDirection'), direction);
        assert.equal(await evaluate("getComputedStyle(sprite).display"), 'none');
        runFrames.add(await evaluate('hdSpriteRenderer.frame'));
      }
      assert.equal(Math.sign(window.getPosition()[0] - positionBefore), direction);
      fs.writeFileSync(`${reportPath}.hd-run-${direction < 0 ? 'left' : 'right'}.png`, (await wc.capturePage()).toPNG());
    }
    assert.equal(runFrames.size, 4);
    await delay(250);
    assert.equal(await evaluate('hdSpriteRenderer.running'), false);
    assert.equal(await evaluate('hdSpriteRenderer.frame'), 0);
    assert.equal(await evaluate('hdSpriteRenderer.timer'), null);
    assert.equal(await evaluate('hdSpriteRenderer.isActive()'), true);
    assert.equal(await evaluate("getComputedStyle(document.getElementById('hdSprite')).transform"), 'none');
    const heldPosition = window.getPosition();
    await delay(250); assert.deepEqual(window.getPosition(), heldPosition);
    // Restart by movement, then release immediately: no queued run may survive release.
    const releaseBounds = window.getBounds();
    wc.sendInputEvent({ type: 'mouseMove', x: cursorX - releaseBounds.x + 15, y: cursorY - releaseBounds.y,
      globalX: cursorX + 15, globalY: cursorY, modifiers: ['leftButtonDown'] });
    await until(() => evaluate('hdSpriteRenderer.running'), 'HD drag restarts run');
    await release();
    assert.equal(await evaluate('hdSpriteRenderer.running'), false);
    await until(() => evaluate('hdSpriteRenderer.timer !== null'), 'HD blink resumes');
    for (let i = 0; i < 10; i++) wc.send('pet:command', 'hello');
    await delay(300);
    assert.equal(await evaluate('transient || walking'), false);
    assert.equal(await evaluate('hdSpriteRenderer.isActive()'), true);
    api.hidePet();
    await until(() => evaluate('hdSpriteRenderer.timer === null'), 'HD hidden timer paused');
    const hiddenHD = await evaluate('hdSpriteRenderer.frame');
    await delay(500); assert.equal(await evaluate('hdSpriteRenderer.frame'), hiddenHD);
    api.showPet();
    await until(() => evaluate('hdSpriteRenderer.timer !== null'), 'HD visible timer resumes');
    for (const size of ['small', 'medium', 'large']) {
      api.applySize(size); await delay(150);
      assert.equal(await evaluate('hdSpriteRenderer.isActive()'), true);
      fs.writeFileSync(`${reportPath}.hd-${size}.png`, (await wc.capturePage()).toPNG());
    }
    report.checks.push('HD real left/right drags animate four slow frames; stop/release restore idle; clicks, hide and sizes work');
    wc.send('pet:work-state', { mode: 'auto', working: true });
    await until(() => evaluate("form === 'kaguya' && !transient"), 'HD to Kaguya');
    assert.equal(await evaluate('hdSpriteRenderer.isActive()'), false);
    wc.send('pet:work-state', { mode: 'yachiyo', working: false, outcome: 'ready' });
    await until(() => evaluate('hdSpriteRenderer.isActive()'), 'HD restored after Kaguya');
    api.setSceneMode('starry-sea');
    await until(() => evaluate("sceneMode === 'starry-sea' && !hdSpriteRenderer.isActive()"), 'HD scene fallback');
    api.setSceneMode('none');
    await until(() => evaluate('hdSpriteRenderer.isActive()'), 'HD restored after scene');
    api.setPreference('yachiyoRenderer', 'sprite');
    await until(() => evaluate("!hdSpriteRenderer.isActive() && getComputedStyle(sprite).display !== 'none'"), 'classic restored');
    report.checks.push('HD form/scene round-trips and classic switch retain the selected renderer');

    for (const size of ['small', 'medium', 'large']) {
      api.applySize(size);
      await delay(80);
      assert.equal(api.getState().preferences.size, size);
    }
    api.setSceneMode('starry-sea');
    await until(() => evaluate("sceneMode === 'starry-sea'"), 'scene entry');
    assert.equal(api.getState().walk.active, false);
    api.setSceneMode('none');
    api.setPreference('yachiyoRenderer', 'live2d');
    await until(() => evaluate('live2dRenderer.isActive()'), 'Live2D after scene');
    assert.ok(api.contextMenuTemplate().some((item) => item.label === '退出'));
    report.checks.push('three sizes, scene round-trip, renderer switching and tray menu construction');

    api.setPreference('gazeStyle', 'eyes-only');
    await until(() => evaluate("live2dRenderer.gazeStyle === 'eyes-only'"), 'eyes-only applied');
    await evaluate('live2dRenderer.setGaze({x: 1, y: -1})');
    await delay(500);
    assert.equal(Math.abs(await evaluate("live2dRenderer.model.internalModel.coreModel.getParameterValueById('ParamAngleX')")), 0);
    api.hidePet();
    await until(() => evaluate('!live2dRenderer.application.ticker.started'), 'hidden ticker paused');
    const hiddenClock = await evaluate('live2dRenderer.model.elapsedTime');
    await delay(300);
    assert.equal(await evaluate('live2dRenderer.model.elapsedTime'), hiddenClock);
    api.showPet();
    await until(() => evaluate('live2dRenderer.isActive() && live2dRenderer.application.ticker.started'), 'show resumes rendering');
    const about = api.contextMenuTemplate().find((item) => item.label?.startsWith('关于与诊断'));
    assert.ok(about?.submenu.some((item) => item.label.includes('已就绪')));
    assert.ok(about.submenu.some((item) => item.label === '打开日志文件夹'));
    report.checks.push('quality modes preserve drag snapshots; eyes-only, hide/resume and diagnostics menu work');

    // Controlled short samples are comparative diagnostics, not a battery-life claim.
    report.graphics = [];
    for (const quality of ['standard', 'economy']) {
      api.setPreference('graphicsMode', quality);
      await delay(1200);
      api.app.getAppMetrics();
      const frames = await evaluate(`(() => {
        window.testFrames = 0;
        window.countTestFrame = () => { window.testFrames++; };
        live2dRenderer.application.ticker.add(window.countTestFrame);
        return performance.now();
      })()`);
      await delay(6000);
      const sample = await evaluate(`(() => {
        live2dRenderer.application.ticker.remove(window.countTestFrame);
        return { fps: window.testFrames * 1000 / (performance.now() - ${frames}),
          resolution: live2dRenderer.application.renderer.resolution,
          width: live2dRenderer.canvas.width, height: live2dRenderer.canvas.height };
      })()`);
      const processes = api.app.getAppMetrics();
      report.graphics.push({ quality, ...sample,
        cpuPercent: +processes.reduce((sum, entry) => sum + entry.cpu.percentCPUUsage, 0).toFixed(2) });
      assert.ok(sample.fps > 10 && sample.fps < (quality === 'economy' ? 35 : 70));
      assert.equal(sample.resolution, Math.min(await evaluate('devicePixelRatio'), quality === 'economy' ? 1 : 2));
    }
    report.checks.push('standard/economy frame rates and render resolutions measured');

    fs.writeFileSync(`${reportPath}.idle.png`, (await wc.capturePage()).toPNG());
    const soakMs = Math.min(1800000, Math.max(0, Number(process.env.YACHIYO_SOAK_MS) || 0));
    if (soakMs) {
      const startedAt = Date.now();
      const restingPosition = window.getPosition();
      report.soak = { requestedMs: soakMs, samples: [] };
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      while (Date.now() - startedAt < soakMs) {
        await delay(Math.min(30000, soakMs - (Date.now() - startedAt)));
        assert.equal(api.getState().walk.active, false);
        assert.deepEqual(window.getPosition(), restingPosition);
        assert.equal(await evaluate('live2dRenderer.isActive()'), true);
        const processes = api.app.getAppMetrics();
        const sample = { elapsedMs: Date.now() - startedAt,
          workingSetMB: Math.round(processes.reduce((sum, entry) => sum + entry.memory.workingSetSize, 0) / 1024),
          cpuPercent: +processes.reduce((sum, entry) => sum + entry.cpu.percentCPUUsage, 0).toFixed(2) };
        report.soak.samples.push(sample);
        console.log(`SOAK ${JSON.stringify(sample)}`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      }
      report.soak.elapsedMs = Date.now() - startedAt;
      report.checks.push('30-minute Live2D soak: no spontaneous movement or renderer fallback');
    }
    // Quit inside the debounce window; the launcher verifies the persisted file.
    api.setPreference('wandering', false);
    report.checks.push('exit requested immediately after preference change');
    report.passed = true;
  } catch (error) {
    report.error = error.stack;
    try { report.renderer = await evaluate(`({ form, transient, dragging, walking,
      live2d: live2dRenderer.state, buffer: live2dRenderer.windowDragging, moved,
      hd: { status: hdSpriteRenderer.status, context: hdSpriteRenderer.context,
        url: hdSpriteRenderer.image?.src, width: hdSpriteRenderer.image?.naturalWidth },
      activePointerId, dragOrigin, lastPointer, testPointer: window.lastTestPointer })`); } catch {}
    report.main = api.getState();
  } finally {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    api.app.quit();
  }
}
module.exports = { run };
