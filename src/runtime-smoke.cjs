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
    assert.equal(await evaluate("live2dRenderer.model.internalModel.coreModel.getParameterValueById('ParamAngleX')"), 0);
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
      activePointerId, dragOrigin, lastPointer, testPointer: window.lastTestPointer })`); } catch {}
    report.main = api.getState();
  } finally {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    api.app.quit();
  }
}
module.exports = { run };
