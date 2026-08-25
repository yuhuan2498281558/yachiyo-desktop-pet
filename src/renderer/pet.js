const pet = document.getElementById('pet');
const avatar = document.getElementById('avatar');
const sprite = document.getElementById('sprite');
const bubble = document.getElementById('bubble');
const particles = document.getElementById('particles');
const statusDot = document.getElementById('statusDot');
const starrySeaScene = document.getElementById('starrySeaScene');
const sceneBackground = starrySeaScene.querySelector('.scene-background');
const sceneActorTrack = document.getElementById('sceneActorTrack');
const sceneActor = document.getElementById('sceneActor');
const sceneReflectionTrack = document.getElementById('sceneReflectionTrack');
const sceneReflection = document.getElementById('sceneReflection');
const sceneSteps = [...starrySeaScene.querySelectorAll('.light-steps span')];
const sceneFishPaths = [...starrySeaScene.querySelectorAll('[data-fish-path]')];
const KAGUYA_GAZE_STRIP = '../../assets/sprites/kaguya-gaze.webp';
const KAGUYA_RUN_STRIP = '../../assets/sprites/kaguya-run.webp';
const KAGUYA_RUN_LEFT_STRIP = '../../assets/sprites/kaguya-run-left.webp';
const YACHIYO_RUN_HIRES_STRIP = '../../assets/sprites/yachiyo-run-hires.webp';
const YACHIYO_RUN_HIRES_LEFT_STRIP = '../../assets/sprites/yachiyo-run-hires-left.webp';
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const STARRY_SEA_FRAME_COUNT = 12;
const STARRY_SEA_FINAL_FRAME = 11;
const STARRY_SEA_DURATION = 4800;
const STARRY_SEA_PREPARE_END = 150;
const STARRY_SEA_SETTLE_START = 4350;
const STARRY_SEA_STAND_TIME = 4530;
const STARRY_SEA_STEP_DURATION = 1050;
const STARRY_SEA_POSE_PHASES = [0, .12, .2, .27, .35, .42, .5, .62, .73, .84, .94, 1];
const STARRY_SEA_PATH_PHASES = [0, .15, .4, .58, .68, .76, .88, 1];
const STARRY_SEA_PATH_X_PROGRESS = [0, .1, .45, .82, .96, 1, 1, 1];
const STARRY_SEA_PATH_Y_PROGRESS = [0, 0, .1, .35, .75, 1.02, 1, 1];
const STARRY_SEA_LANDINGS = [
  { x: 0, y: 0, scale: .48 },
  { x: -1, y: 5.8, scale: .59 },
  { x: -10.8, y: 12.4, scale: .72 },
  { x: -23.2, y: 20, scale: .86 },
  { x: -39.2, y: 27.2, scale: 1 }
];
const STARRY_SEA_STEP_SEGMENTS = Array.from({ length: 4 }, (_value, index) => ({
  start: STARRY_SEA_PREPARE_END + index * STARRY_SEA_STEP_DURATION,
  end: STARRY_SEA_PREPARE_END + (index + 1) * STARRY_SEA_STEP_DURATION
}));
const STARRY_SEA_CONTACT_PHASE = .68;
const STARRY_SEA_STEP_TIMINGS = [
  0,
  ...STARRY_SEA_STEP_SEGMENTS.map(({ start }) => start + STARRY_SEA_STEP_DURATION * STARRY_SEA_CONTACT_PHASE)
];
// Reserved for foot-anchor corrections after a frame-by-frame visual pass.
const STARRY_SEA_FRAME_OFFSETS = Array.from({ length: STARRY_SEA_FRAME_COUNT }, () => ({
  x: 0,
  y: 0,
  rotation: 0
}));
const STARRY_SEA_POSE_MOTION = [
  { y: 0, rotation: 0 },
  { y: 0, rotation: -.08 },
  { y: 0, rotation: -.18 },
  { y: .03, rotation: -.24 },
  { y: .05, rotation: -.16 },
  { y: .1, rotation: 0 },
  { y: .18, rotation: .12 },
  { y: .38, rotation: .24 },
  { y: .8, rotation: .36 },
  { y: .55, rotation: .18 },
  { y: .22, rotation: .06 },
  { y: 0, rotation: 0 }
];

const FISH_PATHS = {
  'large-right-a': {
    duration: 30000,
    phase: .18,
    keyframes: [
      { transform: 'translate3d(-42vw, 0, 0) rotate(-3deg)', opacity: 0 },
      { transform: 'translate3d(5vw, -2vh, 0) rotate(1deg)', opacity: .09, offset: .3 },
      { transform: 'translate3d(72vw, 2vh, 0) rotate(-1deg)', opacity: .11, offset: .7 },
      { transform: 'translate3d(140vw, -1vh, 0) rotate(2deg)', opacity: 0 }
    ]
  },
  'large-left-a': {
    duration: 34000,
    phase: .62,
    keyframes: [
      { transform: 'translate3d(140vw, 3vh, 0) rotate(2deg)', opacity: 0 },
      { transform: 'translate3d(78vw, -2vh, 0) rotate(-1deg)', opacity: .08, offset: .3 },
      { transform: 'translate3d(15vw, 2vh, 0) rotate(1deg)', opacity: .1, offset: .7 },
      { transform: 'translate3d(-42vw, -1vh, 0) rotate(-2deg)', opacity: 0 }
    ]
  },
  'medium-right-a': {
    duration: 21500,
    phase: .42,
    keyframes: [
      { transform: 'translate3d(-34vw, 1vh, 0) rotate(-4deg)', opacity: 0 },
      { transform: 'translate3d(18vw, -2vh, 0) rotate(2deg)', opacity: .11, offset: .32 },
      { transform: 'translate3d(76vw, 2vh, 0) rotate(-2deg)', opacity: .13, offset: .72 },
      { transform: 'translate3d(128vw, -1vh, 0) rotate(3deg)', opacity: 0 }
    ]
  },
  'medium-left-a': {
    duration: 24000,
    phase: .04,
    keyframes: [
      { transform: 'translate3d(128vw, -1vh, 0) rotate(3deg)', opacity: 0 },
      { transform: 'translate3d(70vw, 2vh, 0) rotate(-2deg)', opacity: .1, offset: .3 },
      { transform: 'translate3d(12vw, -2vh, 0) rotate(2deg)', opacity: .12, offset: .7 },
      { transform: 'translate3d(-34vw, 1vh, 0) rotate(-3deg)', opacity: 0 }
    ]
  },
  'small-right-a': {
    duration: 17000,
    phase: .28,
    keyframes: [
      { transform: 'translate3d(-25vw, -1vh, 0) rotate(-5deg)', opacity: 0 },
      { transform: 'translate3d(16vw, 1vh, 0) rotate(3deg)', opacity: .07, offset: .34 },
      { transform: 'translate3d(74vw, -1vh, 0) rotate(-2deg)', opacity: .06, offset: .72 },
      { transform: 'translate3d(124vw, 2vh, 0) rotate(4deg)', opacity: 0 }
    ]
  },
  'small-left-a': {
    duration: 19000,
    phase: .73,
    keyframes: [
      { transform: 'translate3d(124vw, 2vh, 0) rotate(4deg)', opacity: 0 },
      { transform: 'translate3d(70vw, -1vh, 0) rotate(-2deg)', opacity: .06, offset: .34 },
      { transform: 'translate3d(12vw, 1vh, 0) rotate(2deg)', opacity: .07, offset: .72 },
      { transform: 'translate3d(-25vw, -1vh, 0) rotate(-4deg)', opacity: 0 }
    ]
  }
};

const ROWS = {
  idle: { row: 0, frames: 6, interval: 430 },
  right: { row: 1, frames: 8, interval: 110 },
  left: { row: 2, frames: 8, interval: 110 },
  transform: { row: 3, frames: 4, interval: 240 },
  jump: { row: 4, frames: 5, interval: 145 },
  failed: { row: 5, frames: 8, interval: 190 },
  waiting: { row: 6, frames: 6, interval: 260 },
  working: { row: 7, frames: 6, interval: 260 },
  // Negative row ids keep the two custom strips distinct from each other
  // and from the regular dual-atlas rows.
  kaguyaGaze: { row: -2, frames: 8, interval: 120 },
  kaguyaRun: { row: -1, frames: 4, interval: 110 },
  kaguyaHello: { row: 7, frames: 6, interval: 180 },
  review: { row: 8, frames: 6, interval: 230 }
};

const dialogue = window.petDialogue;

function pickDialogue(context = 'hello', speaker = form) {
  if (context === 'hello' && Math.random() < 0.12) {
    return dialogue?.pick('shared.identity') || '名字会变，陪伴你的心不会变。';
  }
  return dialogue?.pickFor(speaker, context) || '我会陪你把这一段好好走完。';
}

let form = 'yachiyo';
let desiredWorking = false;
let lastOutcome = 'ready';
let identityMode = 'auto';
let animationTimer = null;
let transitionToken = 0;
let walking = false;
let walkingDirection = 1;
let gazeTracking = true;
let lastGaze = { index: 0, x: 0, y: 0 };
let stableGazeIndex = 0;
let pendingGazeIndex = 0;
let pendingGazeFrames = 0;
let fushiReactionIndex = 0;
let dogeReactionIndex = 0;
let fushiReactionTimer = null;
let dogeReactionTimer = null;
let bubbleTimer = null;
let dragging = false;
let moved = false;
let lastPointer = null;
let sceneMode = 'none';
let sceneAnimationFrame = null;
let sceneAnimations = [];
let sceneRunToken = 0;
let renderedSceneFrame = -1;

function visualWalkingDirection(direction) {
  return direction < 0 ? -1 : 1;
}

function cancelFushiReaction() {
  const fushi = document.getElementById('fushiCompanion');
  clearTimeout(fushiReactionTimer);
  fushiReactionTimer = null;
  fushi?.classList.remove('reacted');
}

function cancelDogeReaction() {
  const doge = document.getElementById('dogeCompanion');
  clearTimeout(dogeReactionTimer);
  dogeReactionTimer = null;
  doge?.classList.remove('happy');
}

function syncFushiFacing() {
  const fushi = document.getElementById('fushiCompanion');
  if (!fushi || form !== 'yachiyo') return;
  if (walking) cancelFushiReaction();
  const gazeDirection = lastGaze.x < -0.16 ? -1 : lastGaze.x > 0.16 ? 1 : 0;
  const direction = walking ? walkingDirection : gazeDirection;
  if (direction !== 0) {
    const avatarWidth = avatar.clientWidth || pet.clientWidth || 290;
    const fushiWidth = fushi.offsetWidth || 62;
    const sideLeft = direction < 0 ? -4 : Math.max(-4, avatarWidth - fushiWidth + 4);
    fushi.dataset.facing = direction < 0 ? 'left' : 'right';
    fushi.style.setProperty('--fushi-facing', direction < 0 ? '-1' : '1');
    fushi.style.setProperty('--fushi-left', `${sideLeft}px`);
    fushi.classList.toggle('facing-left', direction < 0);
    fushi.classList.toggle('facing-right', direction > 0);
  }
}

function starrySeaFramePath(index) {
  return `../../assets/scenes/starry-sea/step-down-frames/${String(index).padStart(2, '0')}.webp`;
}

const sceneFrameCache = Array.from({ length: STARRY_SEA_FRAME_COUNT }, (_value, index) => {
  const image = new Image();
  image.src = starrySeaFramePath(index);
  return image;
});

function bindSceneFrameImage(image) {
  image.addEventListener('error', () => {
    if (!image.src.endsWith('/00.webp') && image.dataset.fallbackAttempted !== 'true') {
      image.dataset.fallbackAttempted = 'true';
      image.src = starrySeaFramePath(0);
      return;
    }
    image.style.visibility = 'hidden';
  });
  image.addEventListener('load', () => {
    image.style.visibility = 'visible';
  });
}

bindSceneFrameImage(sceneActor);
bindSceneFrameImage(sceneReflection);

sceneFishPaths.forEach((pathElement) => {
  const image = pathElement.querySelector('.fish-image');
  image.addEventListener('error', () => pathElement.classList.add('asset-missing'));
  image.addEventListener('load', () => pathElement.classList.remove('asset-missing'));
});

function renderSceneFrame(index) {
  const frame = Math.max(0, Math.min(STARRY_SEA_FRAME_COUNT - 1, index));
  if (frame === renderedSceneFrame) return;
  renderedSceneFrame = frame;
  const framePath = starrySeaFramePath(frame);
  for (const image of [sceneActor, sceneReflection]) {
    image.dataset.fallbackAttempted = 'false';
    image.src = framePath;
  }
}

function frameForSceneTime(elapsed) {
  if (elapsed >= STARRY_SEA_STAND_TIME) return 0;
  if (elapsed < STARRY_SEA_PREPARE_END) return 0;
  if (elapsed >= STARRY_SEA_SETTLE_START) return STARRY_SEA_FINAL_FRAME;
  const segment = STARRY_SEA_STEP_SEGMENTS.find(({ start, end }) => elapsed >= start && elapsed < end);
  if (!segment) return 0;
  const progress = (elapsed - segment.start) / (segment.end - segment.start);
  let frame = 0;
  for (let index = 1; index < STARRY_SEA_POSE_PHASES.length; index += 1) {
    const switchAt = (STARRY_SEA_POSE_PHASES[index - 1] + STARRY_SEA_POSE_PHASES[index]) / 2;
    if (progress < switchAt) break;
    frame = index;
  }
  return frame;
}

function resetSceneSteps() {
  sceneSteps.forEach((step) => step.classList.remove('is-active'));
}

function updateSceneSteps(elapsed) {
  sceneSteps.forEach((step, index) => {
    // The first platform is the starting pose, not a landing event. Only the
    // four actual stair contacts should briefly emit the landing ripple.
    const activation = index === 0 ? Number.POSITIVE_INFINITY : STARRY_SEA_STEP_TIMINGS[index];
    step.classList.toggle('is-active', elapsed >= activation && elapsed < activation + 520);
  });
}

function addSceneAnimation(element, keyframes, options, initialTime = 0) {
  const animation = element.animate(keyframes, options);
  if (initialTime > 0) {
    try {
      animation.currentTime = initialTime;
    } catch {
      // The animation will still start correctly if Chromium has not resolved it yet.
    }
  }
  sceneAnimations.push(animation);
  return animation;
}

function startFishAnimations() {
  sceneFishPaths.forEach((pathElement) => {
    const spec = FISH_PATHS[pathElement.dataset.fishPath];
    if (!spec || pathElement.classList.contains('asset-missing')) return;
    addSceneAnimation(
      pathElement,
      spec.keyframes,
      { duration: spec.duration, iterations: Infinity, easing: 'linear' },
      spec.duration * spec.phase
    );
  });
}

function sceneTrackTransform(start, end, xProgress, yProgress) {
  const x = start.x + (end.x - start.x) * xProgress;
  const y = start.y + (end.y - start.y) * yProgress;
  const scale = start.scale + (end.scale - start.scale) * xProgress;
  return `translate3d(${x}vw, ${y}vh, 0) scale(${scale})`;
}

function scenePathKeyframes() {
  const first = STARRY_SEA_LANDINGS[0];
  const final = STARRY_SEA_LANDINGS[STARRY_SEA_LANDINGS.length - 1];
  const keyframes = [
    { offset: 0, transform: sceneTrackTransform(first, first, 0, 0) },
    { offset: STARRY_SEA_PREPARE_END / STARRY_SEA_DURATION, transform: sceneTrackTransform(first, first, 0, 0) }
  ];

  STARRY_SEA_STEP_SEGMENTS.forEach(({ start }, stepIndex) => {
    const from = STARRY_SEA_LANDINGS[stepIndex];
    const to = STARRY_SEA_LANDINGS[stepIndex + 1];
    STARRY_SEA_PATH_PHASES.forEach((phase, phaseIndex) => {
      if (phaseIndex === 0) return;
      keyframes.push({
        offset: (start + phase * STARRY_SEA_STEP_DURATION) / STARRY_SEA_DURATION,
        transform: sceneTrackTransform(
          from,
          to,
          STARRY_SEA_PATH_X_PROGRESS[phaseIndex],
          STARRY_SEA_PATH_Y_PROGRESS[phaseIndex]
        )
      });
    });
  });

  keyframes.push({
    offset: 1,
    transform: sceneTrackTransform(final, final, 0, 0)
  });
  return keyframes;
}

function actorPoseTransform(frameIndex, reflected = false) {
  const pose = STARRY_SEA_POSE_MOTION[frameIndex];
  const correction = STARRY_SEA_FRAME_OFFSETS[frameIndex];
  const x = correction.x;
  const y = pose.y + correction.y;
  const rotation = pose.rotation + correction.rotation;
  const reflectionScale = reflected ? 'scale(1, -.32)' : 'scale(1)';
  return `translate3d(${x}%, ${reflected ? -y : y}%, 0) rotate(${reflected ? -rotation : rotation}deg) ${reflectionScale}`;
}

function actorPoseKeyframes(reflected = false) {
  const keyframes = [
    { offset: 0, transform: actorPoseTransform(0, reflected) },
    { offset: STARRY_SEA_PREPARE_END / STARRY_SEA_DURATION, transform: actorPoseTransform(0, reflected) }
  ];

  STARRY_SEA_STEP_SEGMENTS.forEach(({ start }, stepIndex) => {
    STARRY_SEA_POSE_PHASES.forEach((phase, frameIndex) => {
      if (frameIndex === 0) return;
      keyframes.push({
        offset: (start + phase * STARRY_SEA_STEP_DURATION) / STARRY_SEA_DURATION,
        transform: actorPoseTransform(frameIndex, reflected)
      });
    });
  });

  keyframes.push({
    offset: STARRY_SEA_STAND_TIME / STARRY_SEA_DURATION,
    transform: actorPoseTransform(0, reflected)
  }, {
    offset: 1,
    transform: actorPoseTransform(0, reflected)
  });
  return keyframes;
}

function stopSceneAnimation(resetFrame = false) {
  sceneRunToken += 1;
  if (sceneAnimationFrame !== null) cancelAnimationFrame(sceneAnimationFrame);
  sceneAnimationFrame = null;
  sceneAnimations.forEach((animation) => animation.cancel());
  sceneAnimations = [];
  pet.classList.remove('scene-reduced-motion');
  starrySeaScene.classList.remove('is-playing', 'is-finished');
  resetSceneSteps();
  if (resetFrame) {
    renderedSceneFrame = -1;
    renderSceneFrame(0);
  }
}

function showReducedMotionScene() {
  pet.classList.add('scene-reduced-motion');
  starrySeaScene.classList.add('is-finished');
  renderedSceneFrame = -1;
  renderSceneFrame(0);
  // Reduced-motion mode keeps the scene static; no step effect is shown
  // because there is no animated landing event to trigger it.
  resetSceneSteps();
}

function startSceneChoreography() {
  const durationOptions = { duration: STARRY_SEA_DURATION, easing: 'linear', fill: 'forwards' };

  addSceneAnimation(sceneBackground, [
    { transform: 'translate3d(0, 0, 0) scale(1.006)' },
    { transform: 'translate3d(-.18%, -.1%, 0) scale(1.015)', offset: .43 },
    { transform: 'translate3d(-.32%, -.2%, 0) scale(1.028)' }
  ], durationOptions);
  const pathKeyframes = scenePathKeyframes();
  addSceneAnimation(sceneActorTrack, pathKeyframes, durationOptions);
  addSceneAnimation(sceneReflectionTrack, pathKeyframes, durationOptions);
  addSceneAnimation(sceneActor, actorPoseKeyframes(), durationOptions);
  addSceneAnimation(sceneReflection, actorPoseKeyframes(true), durationOptions);
  startFishAnimations();
}

function playStarrySeaSteps() {
  if (sceneMode !== 'starry-sea') return;
  stopSceneAnimation(true);
  if (reducedMotionQuery.matches) {
    showReducedMotionScene();
    return;
  }

  const runToken = sceneRunToken;
  starrySeaScene.classList.add('is-playing');
  startSceneChoreography();
  const startedAt = performance.now();

  function renderTimeline(now) {
    if (runToken !== sceneRunToken || sceneMode !== 'starry-sea') return;
    const elapsed = Math.min(STARRY_SEA_DURATION, now - startedAt);
    renderSceneFrame(frameForSceneTime(elapsed));
    updateSceneSteps(elapsed);
    if (elapsed >= STARRY_SEA_DURATION) {
      sceneAnimationFrame = null;
      starrySeaScene.classList.remove('is-playing');
      starrySeaScene.classList.add('is-finished');
      return;
    }
    sceneAnimationFrame = requestAnimationFrame(renderTimeline);
  }

  sceneAnimationFrame = requestAnimationFrame(renderTimeline);
}

function applySceneMode(nextMode) {
  const normalizedMode = nextMode === 'starry-sea' ? 'starry-sea' : 'none';
  if (sceneMode === normalizedMode) return;
  sceneMode = normalizedMode;
  pet.dataset.scene = sceneMode;
  starrySeaScene.setAttribute('aria-hidden', String(sceneMode !== 'starry-sea'));
  stopSceneAnimation(sceneMode !== 'starry-sea');
  if (sceneMode === 'starry-sea') {
    requestAnimationFrame(playStarrySeaSteps);
  } else {
    renderStableState();
  }
}

reducedMotionQuery.addEventListener('change', () => {
  if (sceneMode === 'starry-sea') playStarrySeaSteps();
});

function setFrame(row, column) {
  const customYachiyoRun = form === 'yachiyo' && (row === ROWS.right.row || row === ROWS.left.row);
  if (customYachiyoRun) {
    sprite.style.backgroundImage = `url("${walkingDirection < 0 ? YACHIYO_RUN_HIRES_LEFT_STRIP : YACHIYO_RUN_HIRES_STRIP}")`;
    sprite.style.backgroundSize = '800% 100%';
    sprite.style.setProperty('--sprite-x', `${column / 7 * 100}%`);
    sprite.style.setProperty('--sprite-y', '0%');
    return;
  }
  const isKaguyaRun = form === 'kaguya' && row === ROWS.kaguyaRun.row;
  if (isKaguyaRun) {
    sprite.style.backgroundImage = `url("${walkingDirection < 0 ? KAGUYA_RUN_LEFT_STRIP : KAGUYA_RUN_STRIP}")`;
    sprite.style.backgroundSize = '400% 100%';
    sprite.style.setProperty('--sprite-x', `${column / 3 * 100}%`);
    sprite.style.setProperty('--sprite-y', '0%');
    return;
  }
  const isKaguyaGaze = form === 'kaguya' && row === ROWS.kaguyaGaze.row;
  if (isKaguyaGaze) {
    sprite.style.backgroundImage = `url("${KAGUYA_GAZE_STRIP}")`;
    sprite.style.backgroundSize = '800% 100%';
    sprite.style.setProperty('--sprite-x', `${column / 7 * 100}%`);
    sprite.style.setProperty('--sprite-y', '0%');
    return;
  }
  sprite.style.backgroundImage = 'url("../../assets/sprites/dual-atlas.webp")';
  sprite.style.backgroundSize = '800% 1100%';
  sprite.style.setProperty('--sprite-x', `${column / 7 * 100}%`);
  sprite.style.setProperty('--sprite-y', `${row / 10 * 100}%`);
}

function stopPlayback() {
  clearInterval(animationTimer);
  animationTimer = null;
}

function startPlayback(action) {
  stopPlayback();
  const sequence = ROWS[action.name];
  if (action.kind === 'loop') {
    if (!sequence) return;
    let frame = 0;
    setFrame(sequence.row, frame);
    animationTimer = setInterval(() => {
      frame = (frame + 1) % sequence.frames;
      setFrame(sequence.row, frame);
    }, sequence.interval);
    return;
  }
  if (action.kind !== 'once') return;
  if (!sequence) {
    spriteQueue.complete(action.id);
    return;
  }
  let frame = 0;
  setFrame(sequence.row, frame);
  animationTimer = setInterval(() => {
    frame += 1;
    if (frame >= sequence.frames) {
      stopPlayback();
      spriteQueue.complete(action.id);
    } else {
      setFrame(sequence.row, frame);
    }
  }, sequence.interval);
}

const spriteQueue = new window.SpriteActionQueue({
  onStart: startPlayback,
  onStop: stopPlayback
});

function stopAnimation() {
  spriteQueue.clear();
}

function playLoop(name) {
  if (!ROWS[name]) return;
  spriteQueue.replace({ kind: 'loop', name });
}

function playOnce(name, callback) {
  if (!ROWS[name]) return;
  spriteQueue.interrupt({ kind: 'once', name, onComplete: callback });
}

function renderGaze() {
  if (!gazeTracking) {
    setFrame(form === 'kaguya' ? ROWS.working.row : ROWS.idle.row, 0);
    return;
  }
  if (form === 'kaguya' && !walking && !spriteQueue.transient) {
    // Kaguya has no separate 16-direction strip yet. Keep her own gold-haired
    // row and use the same gaze vector for a small, visible head/body bias.
    const { x, y } = lastGaze;
    const column = y < -.35 ? (x < -.25 ? 0 : x > .25 ? 2 : 1)
      : y > .35 ? (x < -.25 ? 6 : x > .25 ? 7 : 5)
        : (x < -.25 ? 3 : x > .25 ? 5 : 4);
    setFrame(ROWS.kaguyaGaze.row, column);
    return;
  }
  const index = lastGaze.index;
  setFrame(index < 8 ? 9 : 10, index % 8);
}

function renderStableState() {
  avatar.dataset.form = form;
  avatar.classList.toggle('working', desiredWorking);
  avatar.classList.toggle('walking', walking);
  avatar.classList.toggle('walking-left', walking && walkingDirection < 0);
  syncFushiFacing();
  if (form === 'kaguya' && walking) cancelDogeReaction();
  statusDot.classList.toggle('working', desiredWorking);
  statusDot.classList.toggle('manual', identityMode !== 'auto');
  if (walking) {
    playLoop(form === 'kaguya' ? 'kaguyaRun' : (walkingDirection < 0 ? 'left' : 'right'));
    return;
  }
  if (desiredWorking && form !== 'kaguya') {
    playLoop('working');
    return;
  }
  if (spriteQueue.transient) return;
  stopAnimation();
  renderGaze();
}

function applyWorkState(nextState) {
  const wasWorking = desiredWorking;
  desiredWorking = Boolean(nextState.working);
  lastOutcome = nextState.outcome || lastOutcome;
  identityMode = nextState.mode || 'auto';
  const token = ++transitionToken;

  if (desiredWorking) {
    walking = false;
    if (form === 'yachiyo' && !wasWorking) {
      showBubble(pickDialogue('toKaguya', 'yachiyo'));
      playOnce('transform', () => {
        if (token !== transitionToken || !desiredWorking) return;
        form = 'kaguya';
        renderStableState();
      });
    } else {
      form = 'kaguya';
      renderStableState();
    }
  } else if (form === 'kaguya' || wasWorking) {
    const sequence = lastOutcome === 'failed' ? 'failed' : 'review';
    showBubble(lastOutcome === 'failed'
      ? dialogue?.pick('yachiyo.failed') || '这次只是没合拍，我们再校一次节奏。'
      : dialogue?.pick('yachiyo.success') || '完成得很漂亮，这份光芒值得被看见。');
    playOnce(sequence, () => {
      if (token !== transitionToken || desiredWorking) return;
      form = 'yachiyo';
      renderStableState();
    });
  } else {
    form = 'yachiyo';
    renderStableState();
  }
}

function showBubble(message) {
  clearTimeout(bubbleTimer);
  bubble.textContent = message;
  bubble.classList.add('visible');
  const duration = Math.min(5200, Math.max(2800, 1700 + message.length * 95));
  bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), duration);
}

function burstSparkles() {
  const marks = ['♡', '✦', '·', '✧'];
  for (let index = 0; index < 7; index += 1) {
    const mark = document.createElement('span');
    mark.className = 'sparkle';
    mark.textContent = marks[index % marks.length];
    mark.style.setProperty('--x', `${-78 + Math.random() * 156}px`);
    mark.style.setProperty('--y', `${-90 + Math.random() * 62}px`);
    mark.style.animationDelay = `${index * 45}ms`;
    particles.append(mark);
    mark.addEventListener('animationend', () => mark.remove(), { once: true });
  }
}

function spawnMenkoiBubbles(count = 2) {
  const container = document.getElementById('menkoiCompanion');
  if (!container || form !== 'yachiyo' || pet.classList.contains('no-companions')) return;
  const spawner = container.querySelector('.menkoi-bubble-spawner') || container;
  for (let i = 0; i < count; i += 1) {
    const bubble = document.createElement('div');
    bubble.className = 'menkoi-bubble';
    const size = 8 + Math.random() * 10;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${-size / 2}px`;
    bubble.style.top = `${-size / 2}px`;
    bubble.style.setProperty('--bx', `${-14 + Math.random() * 28}px`);
    bubble.style.animationDelay = `${i * 140}ms`;
    spawner.appendChild(bubble);
    bubble.addEventListener('animationend', () => bubble.remove(), { once: true });
  }
}

function triggerFushiReaction() {
  if (form !== 'yachiyo' || walking || pet.classList.contains('no-companions')) return;
  const fushi = document.getElementById('fushiCompanion');
  if (fushi) {
    const reactions = ['react', 'blink', 'tongue'];
    fushi.dataset.reaction = reactions[fushiReactionIndex % reactions.length];
    fushiReactionIndex += 1;
    clearTimeout(fushiReactionTimer);
    fushi.classList.remove('reacted');
    void fushi.offsetWidth;
    fushi.classList.add('reacted');
    fushiReactionTimer = setTimeout(() => fushi.classList.remove('reacted'), 1050);
  }
}

function triggerDogeReaction() {
  if (form !== 'kaguya' || walking || pet.classList.contains('no-companions')) return;
  const doge = document.getElementById('dogeCompanion');
  if (doge) {
    const reactions = ['happy', 'blink', 'play'];
    doge.dataset.reaction = reactions[dogeReactionIndex % reactions.length];
    dogeReactionIndex += 1;
    clearTimeout(dogeReactionTimer);
    doge.classList.remove('happy');
    void doge.offsetWidth;
    doge.classList.add('happy');
    dogeReactionTimer = setTimeout(() => doge.classList.remove('happy'), 700);
  }
}

function interact(command = 'hello') {
  if (sceneMode === 'starry-sea') {
    showBubble(pickDialogue('starrySea', 'yachiyo'));
    playStarrySeaSteps();
    return;
  }
  const token = ++transitionToken;
  if (command === 'hop' && form === 'kaguya') {
    showBubble(pickDialogue('hop', 'kaguya'));
    playOnce('jump', () => {
      if (token === transitionToken) renderStableState();
    });
    burstSparkles();
    triggerDogeReaction();
    return;
  }
  if (form === 'kaguya') {
    showBubble(pickDialogue('hello', 'kaguya'));
    playOnce('kaguyaHello', () => {
      if (token === transitionToken) renderStableState();
    });
    burstSparkles();
    triggerDogeReaction();
    return;
  }
  if (!desiredWorking && form === 'yachiyo') {
    playOnce('waiting', () => {
      if (token === transitionToken) renderStableState();
    });
  } else {
    avatar.classList.remove('hop');
    void avatar.offsetWidth;
    avatar.classList.add('hop');
  }
  const context = desiredWorking && form === 'kaguya'
    ? 'working'
    : form === 'yachiyo' && Math.random() < 0.35
      ? 'waiting'
      : 'hello';
  showBubble(pickDialogue(context, form));
  burstSparkles();
  spawnMenkoiBubbles(3);
  triggerFushiReaction();
}

pet.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  dragging = true;
  moved = false;
  lastPointer = { x: event.screenX, y: event.screenY };
  document.body.classList.add('dragging');
  pet.setPointerCapture(event.pointerId);
  window.petAPI.setDragging(true);
});

pet.addEventListener('pointermove', (event) => {
  if (!dragging || !lastPointer) return;
  const deltaX = event.screenX - lastPointer.x;
  const deltaY = event.screenY - lastPointer.y;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 1) {
    moved = true;
    walking = true;
    walkingDirection = visualWalkingDirection(deltaX < 0 ? -1 : 1);
    renderStableState();
    window.petAPI.moveBy(deltaX, deltaY);
    lastPointer = { x: event.screenX, y: event.screenY };
  }
});

function finishDrag(shouldInteract) {
  dragging = false;
  lastPointer = null;
  document.body.classList.remove('dragging');
  window.petAPI.setDragging(false);
  walking = false;
  renderStableState();
  if (shouldInteract && !moved) interact('hello');
}

pet.addEventListener('pointerup', (event) => {
  if (event.button === 0) finishDrag(true);
});
pet.addEventListener('pointercancel', () => finishDrag(false));
pet.addEventListener('dblclick', () => interact('hop'));
pet.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.petAPI.showContextMenu();
});

window.petAPI.onCommand((command) => interact(command));
window.petAPI.onSceneCommand((command) => {
  if (command?.type === 'switch') applySceneMode(command.mode);
  if (command?.type === 'replay' && command.mode === 'starry-sea') playStarrySeaSteps();
});
window.petAPI.onGaze((gaze) => {
  if (gaze.index !== stableGazeIndex) {
    if (gaze.index === pendingGazeIndex) {
      pendingGazeFrames += 1;
    } else {
      pendingGazeIndex = gaze.index;
      pendingGazeFrames = 1;
    }
    if (pendingGazeFrames >= 2) {
      stableGazeIndex = gaze.index;
      pendingGazeFrames = 0;
    }
  } else {
    pendingGazeFrames = 0;
  }
  lastGaze = { ...gaze, index: stableGazeIndex };
  const strength = form === 'kaguya' ? 6 : 3;
  const verticalStrength = form === 'kaguya' ? 4 : 2;
  const rotation = form === 'kaguya' ? 2 : 1.2;
  avatar.style.setProperty('--look-x', `${gaze.x * strength}px`);
  avatar.style.setProperty('--look-y', `${gaze.y * verticalStrength}px`);
  avatar.style.setProperty('--look-rotate', `${gaze.x * rotation}deg`);
  syncFushiFacing();
  if (form === 'yachiyo' && !spriteQueue.transient && !walking && !desiredWorking) renderGaze();
  if (form === 'kaguya' && !spriteQueue.transient && !walking) renderGaze();
});
window.petAPI.onPreferences((preferences) => {
  pet.dataset.size = preferences.size;
  applySceneMode(preferences.sceneMode);
  gazeTracking = preferences.gazeTracking !== false;
  pet.classList.toggle('no-companions', preferences.companions === false);
  syncFushiFacing();
  if (!gazeTracking) {
    lastGaze = { ...lastGaze, x: 0, y: 0 };
    syncFushiFacing();
  }
  if (!gazeTracking && !spriteQueue.transient && !walking) renderGaze();
});
window.petAPI.onWalking(({ active, direction }) => {
  // A manually locked Kaguya is intentionally marked as working by the main
  // process so her identity stays active, but she must still be allowed to
  // enter the walking loop when wandering or dragging is enabled.
  const nextWalking = Boolean(active) && (!desiredWorking || identityMode === 'kaguya');
  const nextDirection = visualWalkingDirection(direction);
  if (walking !== nextWalking || walkingDirection !== nextDirection) {
    walking = nextWalking;
    walkingDirection = nextDirection;
    renderStableState();
  }
});
window.petAPI.onWorkState(applyWorkState);

// Ambient idle companion behaviors
setInterval(() => {
  if (form === 'yachiyo' && !walking && !spriteQueue.transient && Math.random() < 0.6) {
    spawnMenkoiBubbles(1 + Math.floor(Math.random() * 2));
  } else if (form === 'yachiyo' && !walking && !spriteQueue.transient && Math.random() < 0.35) {
    triggerFushiReaction();
  }
}, 14000);

setFrame(ROWS.idle.row, 0);
syncFushiFacing();
setTimeout(() => showBubble(pickDialogue('startup', 'yachiyo')), 700);
