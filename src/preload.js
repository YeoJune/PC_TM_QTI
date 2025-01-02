// src/preload.js
const { contextBridge, ipcRenderer } = require("electron");

// 전역 API 노출
contextBridge.exposeInMainWorld("electronAPI", {
  // IPC 통신
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) =>
    ipcRenderer.on(channel, (event, ...args) => callback(...args)),

  // Store API
  store: {
    get: (key, defaultValue) =>
      ipcRenderer.invoke("store:get", key, defaultValue),
    set: (key, value) => ipcRenderer.invoke("store:set", key, value),
  },

  // 파일 시스템 API
  fs: {
    readFile: (filePath, options) =>
      ipcRenderer.invoke("fs:readFile", filePath, options),
    writeFile: (filePath, data) =>
      ipcRenderer.invoke("fs:writeFile", filePath, data),
    exists: (filePath) => ipcRenderer.invoke("fs:exists", filePath),
    mkdir: (dirPath) => ipcRenderer.invoke("fs:mkdir", dirPath),
    readdir: (dirPath) => ipcRenderer.invoke("fs:readdir", dirPath),
  },

  // 경로 API
  path: {
    join: (...args) => ipcRenderer.invoke("path:join", ...args),
    resolve: (...args) => ipcRenderer.invoke("path:resolve", ...args),
    basename: (path, ext) => ipcRenderer.invoke("path:basename", path, ext),
  },

  // 쉘 API
  shell: {
    openPath: (path) => ipcRenderer.invoke("shell:openPath", path),
    trashItem: (path) => ipcRenderer.invoke("shell:trashItem", path),
  },

  // 대화상자 API
  dialog: {
    showMessageBox: (options) =>
      ipcRenderer.invoke("dialog:showMessageBox", options),
    showOpenDialog: (options) =>
      ipcRenderer.invoke("dialog:showOpenDialog", options),
    showSaveDialog: (options) =>
      ipcRenderer.invoke("dialog:showSaveDialog", options),
  },
});
