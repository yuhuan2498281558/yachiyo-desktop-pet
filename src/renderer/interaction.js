(function attachPetInteraction(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.petInteraction = api;
})(typeof window === 'undefined' ? null : window, () => {
  const DRAG_START_DISTANCE = 6;
  const DRAG_MOVE_INTERVAL = 32;
  const CLICK_COMMIT_DELAY = 220;

  function exceedsDragThreshold(origin, point, threshold = DRAG_START_DISTANCE) {
    if (!origin || !point) return false;
    const deltaX = Number(point.x) - Number(origin.x);
    const deltaY = Number(point.y) - Number(origin.y);
    const minimum = Math.max(0, Number(threshold) || 0);
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return false;
    return deltaX * deltaX + deltaY * deltaY >= minimum * minimum;
  }

  function mergeMovement(pending, delta) {
    const pendingX = Number(pending?.x) || 0;
    const pendingY = Number(pending?.y) || 0;
    const deltaX = Number(delta?.x) || 0;
    const deltaY = Number(delta?.y) || 0;
    return {
      x: pendingX + deltaX,
      y: pendingY + deltaY
    };
  }

  return {
    CLICK_COMMIT_DELAY,
    DRAG_MOVE_INTERVAL,
    DRAG_START_DISTANCE,
    exceedsDragThreshold,
    mergeMovement
  };
});
