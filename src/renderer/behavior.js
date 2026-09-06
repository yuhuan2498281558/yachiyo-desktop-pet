(function attach(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.petBehavior = api;
})(typeof window === 'undefined' ? null : window, () => {
  function canAutoWalk(state) {
    const form = state.identityMode === 'kaguya' || (state.identityMode === 'auto' && state.working)
      ? 'kaguya' : 'yachiyo';
    return state.wandering === true && state.visible === true && !state.clickThrough
      && !state.dragging && !state.transient && state.sceneMode === 'none'
      && (state.identityMode === 'kaguya' || !state.working)
      && !(form === 'yachiyo' && state.yachiyoRenderer === 'live2d');
  }

  // Coordinates async inputs while the user's pointer owns the character.
  class BehaviorCoordinator {
    constructor() {
      this.dragging = false;
      this.pending = new Map();
      this.workKey = null;
    }
    beginDrag() { this.dragging = true; }
    defer(kind, value) {
      if (!this.dragging) return false;
      this.pending.set(kind, value);
      return true;
    }
    endDrag() {
      this.dragging = false;
      const pending = this.pending;
      this.pending = new Map();
      return pending;
    }
    acceptWork(state) {
      const key = JSON.stringify([Boolean(state.working), state.mode || 'auto']);
      if (key === this.workKey) return false;
      this.workKey = key;
      return true;
    }
    acceptsWalking(state, active) {
      return !active || (!this.dragging && canAutoWalk(state));
    }
  }
  return { canAutoWalk, BehaviorCoordinator };
});
