import { contextBridge, ipcRenderer } from 'electron';

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),

    // App info
    getVersion: () => ipcRenderer.invoke('app:getVersion'),

    // File operations
    // File operations
    openFileDialog: () => ipcRenderer.invoke('file:openDialog'),
    readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),

    // Backend config
    getApiPort: () => ipcRenderer.invoke('app:getApiPort'),

    // Platform detection
    platform: process.platform,
});
