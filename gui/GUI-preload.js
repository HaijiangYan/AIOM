const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API for the renderer to communicate with the main process
contextBridge.exposeInMainWorld('electronAPI', {
  sendParameters: (env) => ipcRenderer.send('parameters', env),
  onResponse: (callback) => ipcRenderer.on('submit-success', (event, data) => callback(data)), 
  sendDocker: (command) => ipcRenderer.send('docker', command),
  onDocker: (callback) => ipcRenderer.on('docker-success', (event, data) => callback(data)), 
  outputDocker: (callback) => ipcRenderer.on('docker-output', (event, data) => callback(data)), 
  download: (command) => ipcRenderer.send('download', command),
});
