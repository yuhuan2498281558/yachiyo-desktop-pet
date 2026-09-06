const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, shell, Tray } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { CodexActivityMonitor } = require('./codex-activity.cjs');
const { gazeDirection } = require('./gaze.cjs');
const { DEFAULT_PREFERENCES, PreferencesStore, resolveStorageDirectory } = require('./preferences-store.cjs');
const { Diagnostics } = require('./diagnostics.cjs');
const { canAutoWalk } = require('./renderer/behavior.js');

// Integration diagnostics always use a separate profile, including packaged runs.
if (process.env.YACHIYO_TEST_USER_DATA) {
  const testProfile = path.resolve(process.env.YACHIYO_TEST_USER_DATA);
  fs.mkdirSync(testProfile, { recursive: true });
  app.setPath('userData', testProfile);
}

const SIZE_PRESETS = {
  small: { width: 230, height: 280, label: '小巧' },
  medium: { width: 290, height: 350, label: '标准' },
  large: { width: 360, height: 430, label: '大号' }
};

const SCENE_SIZE = { width: 1100, height: 620 };
const SCENE_MARGIN = 24;
const SCENE_MODES = new Set(['none', 'starry-sea']);

let petWindow = null;
let tray = null;
let preferences = { ...DEFAULT_PREFERENCES };
let activity = { working: false, activeCount: 0, outcome: 'ready' };
let preferencesStore = null;
let diagnostics = null;
let dragging = false;
let rendererBusy = false;
let live2dStatus = 'not-loaded';
let walkingTimer = null;
let gazeTimer = null;
let boundsTimer = null;
let lastGazeKey = '';
let activityMonitor = null;
let enforcingBounds = false;
let walk = {
  active: false,
  direction: -1,
  speed: 1,
  endsAt: 0,
  nextAt: Date.now() + 7000
};

function preferencesPath() {
  return path.join(resolveStorageDirectory(app.getPath('userData')), 'preferences.json');
}

function loadPreferences() {
  preferencesStore = new PreferencesStore(preferencesPath(), {
    onError: (event, error) => diagnostics?.record(event, { code: error.code || 'INVALID_JSON' })
  });
  preferences = preferencesStore.load();
}

function savePreferencesSoon() {
  preferencesStore?.schedule(preferences);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function currentWorkArea(bounds = petWindow?.getBounds()) {
  return screen.getDisplayMatching(bounds || screen.getPrimaryDisplay().workArea).workArea;
}

function sceneSizeForArea(area) {
  const availableWidth = Math.max(1, area.width - SCENE_MARGIN);
  const availableHeight = Math.max(1, area.height - SCENE_MARGIN);
  const scale = Math.min(1, availableWidth / SCENE_SIZE.width, availableHeight / SCENE_SIZE.height);
  return {
    width: Math.max(1, Math.floor(SCENE_SIZE.width * scale)),
    height: Math.max(1, Math.floor(SCENE_SIZE.height * scale))
  };
}

function currentTargetSize(bounds = petWindow?.getBounds()) {
  if (preferences.sceneMode === 'starry-sea') {
    return sceneSizeForArea(currentWorkArea(bounds));
  }
  return SIZE_PRESETS[preferences.size];
}

function validSavedPosition(size) {
  if (!Number.isFinite(preferences.x) || !Number.isFinite(preferences.y)) return null;
  const area = screen.getDisplayNearestPoint({ x: preferences.x, y: preferences.y }).workArea;
  return {
    x: clamp(preferences.x, area.x, area.x + area.width - size.width),
    y: clamp(preferences.y, area.y, area.y + area.height - size.height)
  };
}

function defaultPosition(size) {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - size.width - 22,
    y: area.y + area.height - size.height
  };
}

function enforcePetBounds() {
  if (!petWindow || petWindow.isDestroyed() || enforcingBounds) return;
  const target = currentTargetSize();
  const bounds = petWindow.getBounds();
  const area = currentWorkArea(bounds);
  const bottom = bounds.y + bounds.height;
  const x = clamp(bounds.x, area.x, area.x + area.width - target.width);
  const y = clamp(bottom - target.height, area.y, area.y + area.height - target.height);
  if (
    bounds.width === target.width
    && bounds.height === target.height
    && bounds.x === x
    && bounds.y === y
  ) return;

  enforcingBounds = true;
  try {
    if (petWindow.isMaximized()) petWindow.unmaximize();
    if (petWindow.isFullScreen()) petWindow.setFullScreen(false);
    petWindow.setBounds({ x, y, width: target.width, height: target.height }, false);
    petWindow.setMinimumSize(target.width, target.height);
    petWindow.setMaximumSize(target.width, target.height);
  } finally {
    enforcingBounds = false;
  }
}

function effectiveWorkState() {
  if (preferences.identityMode === 'kaguya') {
    return { mode: 'kaguya', working: true, activeCount: activity.activeCount, outcome: null };
  }
  if (preferences.identityMode === 'yachiyo') {
    return { mode: 'yachiyo', working: false, activeCount: activity.activeCount, outcome: 'ready' };
  }
  return { mode: 'auto', ...activity };
}

function sendState() {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.webContents.send('pet:preferences', preferences);
  petWindow.webContents.send('pet:work-state', effectiveWorkState());
}

function createPetWindow() {
  const savedBounds = Number.isFinite(preferences.x) && Number.isFinite(preferences.y)
    ? { x: preferences.x, y: preferences.y, width: 1, height: 1 }
    : undefined;
  const size = currentTargetSize(savedBounds);
  const position = validSavedPosition(size) || defaultPosition(size);
  petWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: size.width,
    minHeight: size.height,
    maxWidth: size.width,
    maxHeight: size.height,
    ...position,
    useContentSize: true,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    thickFrame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    title: '八千代与辉夜桌宠',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  petWindow.setAlwaysOnTop(true, 'floating');
  petWindow.setResizable(false);
  petWindow.setMaximizable(false);
  petWindow.setFullScreenable(false);
  petWindow.setIgnoreMouseEvents(preferences.clickThrough, { forward: true });
  petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  petWindow.webContents.on('did-finish-load', () => {
    dragging = false;
    rendererBusy = false;
    live2dStatus = 'not-loaded';
    rebuildTrayMenu();
    stopWalking();
    sendState();
    const capturePath = process.env.YACHIYO_CAPTURE_PATH;
    if (capturePath) {
      petWindow.showInactive();
      fs.mkdirSync(path.dirname(capturePath), { recursive: true });
      const requestedDelay = Number(process.env.YACHIYO_CAPTURE_DELAY_MS);
      const captureDelay = Number.isFinite(requestedDelay)
        ? clamp(requestedDelay, 500, 30000)
        : 1400;
      setTimeout(async () => {
        try {
          if (process.env.YACHIYO_CAPTURE_DRAG_BUFFER === '1') {
            await petWindow.webContents.executeJavaScript('live2dRenderer?.beginWindowDrag()');
            await new Promise((resolve) => setTimeout(resolve, 120));
          }
          const rendererState = await petWindow.webContents.executeJavaScript(`({
            form: document.getElementById('avatar')?.dataset.form,
            live2dState: document.getElementById('avatar')?.dataset.live2dState,
            live2dError: document.getElementById('avatar')?.dataset.live2dError,
            live2dActive: document.getElementById('avatar')?.classList.contains('live2d-active'),
            hdSpriteActive: document.getElementById('avatar')?.classList.contains('hd-sprite-active'),
            hdSpriteStatus: document.getElementById('hdSprite')?.dataset.status,
            live2dDragBuffer: document.getElementById('avatar')?.classList.contains('live2d-drag-buffer'),
            live2dTickerStarted: Boolean(live2dRenderer?.application?.ticker?.started),
            live2dDragBufferSize: {
              width: document.getElementById('live2dDragCanvas')?.width,
              height: document.getElementById('live2dDragCanvas')?.height
            },
            live2dDragBufferAlpha: (() => {
              const canvas = document.getElementById('live2dDragCanvas');
              const context = canvas?.getContext('2d');
              if (!canvas || !context) return 0;
              const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
              let alpha = 0;
              for (let index = 3; index < data.length; index += 256) alpha += data[index];
              return alpha;
            })(),
            live2dRendererPlugins: Object.keys(live2dRenderer?.application?.renderer?.plugins || {}),
            live2dExtractMethods: (() => {
              const extract = live2dRenderer?.application?.renderer?.plugins?.extract;
              return extract ? Object.getOwnPropertyNames(Object.getPrototypeOf(extract)) : [];
            })(),
            walking: document.getElementById('avatar')?.classList.contains('walking'),
            petLive2dStatus: document.getElementById('pet')?.dataset.live2dStatus,
            petLive2dMessage: document.getElementById('pet')?.dataset.live2dMessage
          })`);
          const image = await petWindow.webContents.capturePage();
          fs.writeFileSync(capturePath, image.toPNG());
          fs.writeFileSync(`${capturePath}.json`, JSON.stringify(rendererState, null, 2));
        } catch (error) {
          fs.writeFileSync(`${capturePath}.error.txt`, error instanceof Error ? error.stack : String(error));
        } finally {
          app.quit();
        }
      }, captureDelay);
    } else if (preferences.visible) {
      petWindow.showInactive();
    }
  });
  petWindow.on('move', () => {
    enforcePetBounds();
    const [x, y] = petWindow.getPosition();
    preferences.x = x;
    preferences.y = y;
    savePreferencesSoon();
  });
  petWindow.on('will-resize', (event) => event.preventDefault());
  petWindow.on('resize', enforcePetBounds);
  petWindow.on('maximize', enforcePetBounds);
  petWindow.on('enter-full-screen', enforcePetBounds);
  petWindow.on('closed', () => {
    dragging = false;
    rendererBusy = false;
    petWindow = null;
  });
  petWindow.webContents.on('render-process-gone', (_event, details) => {
    dragging = false;
    rendererBusy = true;
    live2dStatus = 'renderer-gone';
    stopWalking();
    diagnostics?.record('renderer-gone', { reason: details.reason });
    rebuildTrayMenu();
  });
}

function showPet() {
  if (!petWindow) createPetWindow();
  preferences.visible = true;
  petWindow.showInactive();
  sendState();
  savePreferencesSoon();
  rebuildTrayMenu();
}

function hidePet() {
  if (!petWindow) return;
  preferences.visible = false;
  stopWalking();
  petWindow.hide();
  sendState();
  savePreferencesSoon();
  rebuildTrayMenu();
}

function summonPet() {
  if (!petWindow) createPetWindow();
  const size = petWindow.getBounds();
  const position = defaultPosition(size);
  petWindow.setPosition(position.x, position.y);
  showPet();
  petWindow.webContents.send('pet:command', 'hello');
}

function applySize(sizeName) {
  const size = SIZE_PRESETS[sizeName];
  if (!size || !petWindow) return;
  preferences.size = sizeName;
  if (preferences.sceneMode !== 'none') {
    sendState();
    savePreferencesSoon();
    rebuildTrayMenu();
    return;
  }
  const oldBounds = petWindow.getBounds();
  const area = currentWorkArea(oldBounds);
  const bottom = oldBounds.y + oldBounds.height;
  const x = clamp(oldBounds.x, area.x, area.x + area.width - size.width);
  const y = clamp(bottom - size.height, area.y, area.y + area.height - size.height);
  enforcingBounds = true;
  try {
    petWindow.setMinimumSize(1, 1);
    petWindow.setMaximumSize(10000, 10000);
    petWindow.setBounds({ x, y, width: size.width, height: size.height }, false);
    petWindow.setMinimumSize(size.width, size.height);
    petWindow.setMaximumSize(size.width, size.height);
  } finally {
    enforcingBounds = false;
  }
  sendState();
  savePreferencesSoon();
  rebuildTrayMenu();
}

function applyWindowTargetSize() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const oldBounds = petWindow.getBounds();
  const area = currentWorkArea(oldBounds);
  const target = currentTargetSize(oldBounds);
  const right = oldBounds.x + oldBounds.width;
  const bottom = oldBounds.y + oldBounds.height;
  const x = clamp(right - target.width, area.x, area.x + area.width - target.width);
  const y = clamp(bottom - target.height, area.y, area.y + area.height - target.height);
  enforcingBounds = true;
  try {
    if (petWindow.isMaximized()) petWindow.unmaximize();
    if (petWindow.isFullScreen()) petWindow.setFullScreen(false);
    petWindow.setMinimumSize(1, 1);
    petWindow.setMaximumSize(10000, 10000);
    petWindow.setBounds({ x, y, width: target.width, height: target.height }, false);
    petWindow.setMinimumSize(target.width, target.height);
    petWindow.setMaximumSize(target.width, target.height);
  } finally {
    enforcingBounds = false;
  }
}

function setSceneMode(mode) {
  if (!SCENE_MODES.has(mode)) return;
  const changed = preferences.sceneMode !== mode;
  preferences.sceneMode = mode;
  diagnostics?.record('scene', { sceneMode: mode });
  stopWalking();
  applyWindowTargetSize();
  sendState();
  if (changed) petWindow?.webContents.send('pet:scene-command', { type: 'switch', mode });
  savePreferencesSoon();
  rebuildTrayMenu();
}

function replayStarrySeaSteps() {
  if (preferences.sceneMode !== 'starry-sea') {
    setSceneMode('starry-sea');
    return;
  }
  petWindow?.webContents.send('pet:scene-command', { type: 'replay', mode: 'starry-sea' });
}

function setClickThrough(enabled) {
  preferences.clickThrough = enabled;
  if (enabled) stopWalking();
  petWindow?.setIgnoreMouseEvents(enabled, { forward: true });
  sendState();
  savePreferencesSoon();
  rebuildTrayMenu();
}

function setPreference(key, value) {
  preferences[key] = value;
  if (key === 'gazeTracking') lastGazeKey = '';
  if (!canWander()) stopWalking();
  if (key === 'yachiyoRenderer') diagnostics?.record('renderer-mode', { renderer: value });
  if (key === 'wandering' && !value) stopWalking();
  if (key === 'wandering' && value) walk.nextAt = Date.now() + 650;
  if (key === 'identityMode' && value === 'kaguya' && preferences.wandering) {
    walk.nextAt = Date.now() + 650;
  }
  sendState();
  savePreferencesSoon();
  rebuildTrayMenu();
}

function modelStatusText() {
  if (live2dStatus === 'renderer-gone') return '渲染进程已退出 · 请重启桌宠';
  if (preferences.sceneMode !== 'none') return '场景中（Sprite）';
  if (effectiveWorkState().working) return '辉夜（Sprite）';
  if (preferences.yachiyoRenderer === 'sprite') return '八千代（Sprite）';
  if (rendererBusy) return '形态切换中（Sprite）';
  if (preferences.yachiyoRenderer === 'sprite-hd') return '八千代 · 高清 Sprite 待机模式';
  return ({ ready: '八千代 Live2D · 已就绪', failed: 'Live2D 加载失败 · Sprite 回退',
    'context-lost': 'WebGL 上下文丢失 · Sprite 回退',
    'drag-failed': 'Live2D · 上次拖动快照失败' })[live2dStatus] || 'Live2D · 尚未就绪';
}

async function openLocalFolder(directory) {
  try {
    const error = await shell.openPath(directory);
    if (error) throw new Error('OPEN_PATH_FAILED');
  } catch {
    dialog.showErrorBox('无法打开文件夹', `请手动打开：\n${directory}`);
  }
}

function contextMenuTemplate() {
  return [
    {
      label: preferences.visible ? '隐藏桌宠' : '显示桌宠',
      click: () => (preferences.visible ? hidePet() : showPet())
    },
    { label: '召回到右下角', click: summonPet },
    { type: 'separator' },
    {
      label: '形态',
      submenu: [
        { label: '自动：工作时辉夜', type: 'radio', checked: preferences.identityMode === 'auto', click: () => setPreference('identityMode', 'auto') },
        { label: '锁定八千代', type: 'radio', checked: preferences.identityMode === 'yachiyo', click: () => setPreference('identityMode', 'yachiyo') },
        { label: '锁定辉夜', type: 'radio', checked: preferences.identityMode === 'kaguya', click: () => setPreference('identityMode', 'kaguya') }
      ]
    },
    {
      label: '八千代形象',
      submenu: [
        {
          label: 'Live2D（GitHub 原版）',
          type: 'radio',
          checked: preferences.yachiyoRenderer === 'live2d',
          click: () => setPreference('yachiyoRenderer', 'live2d')
        },
        {
          label: '经典 Sprite（兼容模式）',
          type: 'radio',
          checked: preferences.yachiyoRenderer === 'sprite',
          click: () => setPreference('yachiyoRenderer', 'sprite')
        },
        {
          label: '高清 Sprite（新版八千代）',
          type: 'radio',
          checked: preferences.yachiyoRenderer === 'sprite-hd',
          click: () => setPreference('yachiyoRenderer', 'sprite-hd')
        }
      ]
    },
    {
      label: 'Live2D 画质',
      submenu: [
        { label: '标准 · 60 FPS', type: 'radio', checked: preferences.graphicsMode === 'standard', click: () => setPreference('graphicsMode', 'standard') },
        { label: '省电 · 30 FPS / 1× 渲染', type: 'radio', checked: preferences.graphicsMode === 'economy', click: () => setPreference('graphicsMode', 'economy') }
      ]
    },
    {
      label: 'Live2D 视线风格',
      submenu: [
        { label: '柔和转头', type: 'radio', checked: preferences.gazeStyle === 'gentle', click: () => setPreference('gazeStyle', 'gentle') },
        { label: '仅眼睛跟随', type: 'radio', checked: preferences.gazeStyle === 'eyes-only', click: () => setPreference('gazeStyle', 'eyes-only') }
      ]
    },
    {
      label: '场景',
      submenu: [
        { label: '关闭场景', type: 'radio', checked: preferences.sceneMode === 'none', click: () => setSceneMode('none') },
        { label: '星降之海', type: 'radio', checked: preferences.sceneMode === 'starry-sea', click: () => setSceneMode('starry-sea') },
        { type: 'separator' },
        { label: '重播踩阶梯', enabled: preferences.sceneMode === 'starry-sea', click: replayStarrySeaSteps }
      ]
    },
    {
      label: '全局视线追随',
      type: 'checkbox',
      checked: preferences.gazeTracking,
      click: ({ checked }) => setPreference('gazeTracking', checked)
    },
    {
      label: '使魔伴随（FUSHI & 面蛸）',
      type: 'checkbox',
      checked: preferences.companions !== false,
      click: ({ checked }) => setPreference('companions', checked)
    },
    {
      label: '随机散步（Sprite 形象）',
      type: 'checkbox',
      checked: preferences.wandering,
      click: ({ checked }) => setPreference('wandering', checked)
    },
    {
      label: '鼠标穿透（从托盘关闭）',
      type: 'checkbox',
      checked: preferences.clickThrough,
      click: ({ checked }) => setClickThrough(checked)
    },
    {
      label: '尺寸',
      submenu: Object.entries(SIZE_PRESETS).map(([key, value]) => ({
        label: value.label,
        type: 'radio',
        checked: preferences.size === key,
        click: () => applySize(key)
      }))
    },
    { type: 'separator' },
    { label: '打个招呼', click: () => petWindow?.webContents.send('pet:command', 'hello') },
    { label: '跳一下', click: () => petWindow?.webContents.send('pet:command', 'hop') },
    { type: 'separator' },
    {
      label: `关于与诊断 · v${app.getVersion()}`,
      submenu: [
        { label: modelStatusText(), enabled: false },
        { label: '版本与运行状态', click: () => dialog.showMessageBox({ type: 'info', title: '桌宠运行状态',
          message: `八千代与辉夜桌宠 v${app.getVersion()}`,
          detail: `${modelStatusText()}\n画质：${preferences.graphicsMode === 'economy' ? '省电 30 FPS' : '标准 60 FPS'}\nLive2D 不自动散步；拖动仅平移。\n\n程序：${app.isPackaged ? path.dirname(process.execPath) : app.getAppPath()}\n数据：${resolveStorageDirectory(app.getPath('userData'))}` }) },
        { label: '打开程序文件夹', click: () => openLocalFolder(app.isPackaged ? path.dirname(process.execPath) : app.getAppPath()) },
        { label: '打开日志文件夹', click: () => openLocalFolder(path.join(resolveStorageDirectory(app.getPath('userData')), 'logs')) }
      ]
    },
    { label: '退出', click: () => app.quit() }
  ];
}

function rebuildTrayMenu() {
  if (tray) tray.setContextMenu(Menu.buildFromTemplate(contextMenuTemplate()));
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'))
    .resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip('八千代与辉夜桌宠');
  rebuildTrayMenu();
  tray.on('click', showPet);
}

function stopWalking() {
  if (!walk.active) return;
  walk.active = false;
  walk.nextAt = Date.now() + 12000 + Math.random() * 18000;
  diagnostics?.record('walking', { walking: false });
  petWindow?.webContents.send('pet:walking', { active: false, direction: walk.direction });
}

function canWander() {
  return canAutoWalk({ ...preferences, working: effectiveWorkState().working,
    dragging, transient: rendererBusy });
}

function startWalking() {
  if (!petWindow || !canWander() || preferences.clickThrough || !preferences.visible) return;
  walk.active = true;
  diagnostics?.record('walking', { walking: true });
  walk.direction = Math.random() > 0.5 ? 1 : -1;
  walk.speed = 0.7 + Math.random() * 0.8;
  walk.endsAt = Date.now() + 4500 + Math.random() * 4500;
  petWindow.webContents.send('pet:walking', { active: true, direction: walk.direction });
}

function tickWalking() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const now = Date.now();
  if (!walk.active) {
    if (now >= walk.nextAt) startWalking();
    return;
  }
  if (now >= walk.endsAt || !canWander() || !preferences.visible) {
    stopWalking();
    return;
  }
  const bounds = petWindow.getBounds();
  const area = currentWorkArea(bounds);
  let x = bounds.x + Math.round(walk.speed * walk.direction);
  const minimum = area.x;
  const maximum = area.x + area.width - bounds.width;
  if (x <= minimum || x >= maximum) {
    walk.direction *= -1;
    x = clamp(x, minimum, maximum);
    petWindow.webContents.send('pet:walking', { active: true, direction: walk.direction });
  }
  petWindow.setPosition(x, bounds.y);
}

function tickGaze() {
  if (!petWindow || petWindow.isDestroyed() || preferences.sceneMode !== 'none' || !preferences.visible || !preferences.gazeTracking) return;
  const gaze = gazeDirection(screen.getCursorScreenPoint(), petWindow.getBounds());
  const key = `${gaze.index}:${gaze.x.toFixed(2)}:${gaze.y.toFixed(2)}`;
  if (key === lastGazeKey) return;
  lastGazeKey = key;
  petWindow.webContents.send('pet:gaze', gaze);
}

function registerIpc() {
  const validSender = (event) => petWindow && event.sender === petWindow.webContents;
  ipcMain.on('pet:move-by', (event, delta) => {
    if (!validSender(event) || !dragging || !Number.isFinite(delta?.x) || !Number.isFinite(delta?.y)) return;
    stopWalking();
    const bounds = petWindow.getBounds();
    const area = currentWorkArea(bounds);
    const x = clamp(bounds.x + Math.round(delta.x), area.x, area.x + area.width - bounds.width);
    const y = clamp(bounds.y + Math.round(delta.y), area.y, area.y + area.height - bounds.height);
    petWindow.setPosition(x, y);
  });
  ipcMain.on('pet:context-menu', (event) => {
    if (validSender(event)) Menu.buildFromTemplate(contextMenuTemplate()).popup({ window: petWindow });
  });
  ipcMain.on('pet:dragging', (event, value) => {
    if (!validSender(event) || typeof value !== 'boolean') return;
    dragging = value;
    stopWalking();
    // A long stationary hold must never restart wandering underneath the pointer.
    walk.nextAt = Date.now() + 12000;
    diagnostics?.record('dragging', { dragging });
  });
  ipcMain.on('pet:busy', (event, value) => {
    if (!validSender(event) || typeof value !== 'boolean') return;
    rendererBusy = value;
    if (value) stopWalking();
    rebuildTrayMenu();
  });
  ipcMain.on('pet:renderer-status', (event, status) => {
    if (!validSender(event) || !['ready', 'failed', 'context-lost', 'drag-failed'].includes(status)) return;
    live2dStatus = status;
    diagnostics?.record('live2d', { status });
    rebuildTrayMenu();
  });
}

const gotLock = process.env.YACHIYO_CAPTURE_PATH || (process.env.YACHIYO_SMOKE_REPORT && process.env.YACHIYO_TEST_USER_DATA)
  ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', summonPet);
  app.whenReady().then(() => {
    app.setAppUserModelId('local.yachiyo.desktopPet');
    diagnostics = new Diagnostics(path.join(resolveStorageDirectory(app.getPath('userData')), 'logs'));
    diagnostics.record('startup', { version: app.getVersion() });
    loadPreferences();
    registerIpc();
    createPetWindow();
    createTray();
    activityMonitor = new CodexActivityMonitor({
      codexHome: process.env.YACHIYO_TEST_USER_DATA ? process.env.YACHIYO_TEST_CODEX_HOME : undefined,
      onError: (event, error) => diagnostics.record(event, { code: error.code || 'WORKER_FAILED' })
    });
    activityMonitor.start((nextActivity) => {
      const wasWorking = activity.working;
      activity = nextActivity;
      diagnostics.record('activity', nextActivity);
      if (!wasWorking && activity.working && preferences.identityMode !== 'kaguya') stopWalking();
      sendState();
      rebuildTrayMenu();
    });
    walkingTimer = setInterval(tickWalking, 25);
    gazeTimer = setInterval(tickGaze, 50);
    boundsTimer = setInterval(enforcePetBounds, 250);
    if (process.env.YACHIYO_SMOKE_REPORT && process.env.YACHIYO_TEST_USER_DATA) {
      require('./runtime-smoke.cjs').run({ app, getWindow: () => petWindow,
        setPreference, applySize, setSceneMode, setClickThrough, showPet, hidePet,
        startWalking, stopWalking, tickWalking, contextMenuTemplate,
        getState: () => ({ preferences: { ...preferences }, dragging, rendererBusy, walk: { ...walk } })
      });
    }
  });
}

app.on('window-all-closed', () => {
  // The tray owns the app lifecycle on Windows.
});

app.on('before-quit', () => {
  clearInterval(walkingTimer);
  clearInterval(gazeTimer);
  clearInterval(boundsTimer);
  preferencesStore?.flush();
  diagnostics?.record('shutdown');
  activityMonitor?.stop();
});
