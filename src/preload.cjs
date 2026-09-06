const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  moveBy: (x, y) => ipcRenderer.send('pet:move-by', { x, y }),
  setDragging: (dragging) => ipcRenderer.send('pet:dragging', Boolean(dragging)),
  setBusy: (busy) => ipcRenderer.send('pet:busy', Boolean(busy)),
  reportRendererStatus: (status) => ipcRenderer.send('pet:renderer-status', status),
  showContextMenu: () => ipcRenderer.send('pet:context-menu'),
  onCommand: (callback) => ipcRenderer.on('pet:command', (_event, command) => callback(command)),
  onGaze: (callback) => ipcRenderer.on('pet:gaze', (_event, gaze) => callback(gaze)),
  onPreferences: (callback) => ipcRenderer.on('pet:preferences', (_event, preferences) => callback(preferences)),
  onSceneCommand: (callback) => ipcRenderer.on('pet:scene-command', (_event, command) => callback(command)),
  onWalking: (callback) => ipcRenderer.on('pet:walking', (_event, walking) => callback(walking)),
  onWorkState: (callback) => ipcRenderer.on('pet:work-state', (_event, state) => callback(state))
});
