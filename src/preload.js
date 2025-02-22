// src/preload.js
const { contextBridge, ipcRenderer } = require("electron");

const createApiMethod = (type, methods) => {
  return Object.entries(methods).reduce((api, [key, channel]) => {
    api[key] = (...args) => ipcRenderer.invoke(channel, ...args);
    return api;
  }, {});
};

const electronAPI = {
  // 기본 IPC 통신
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) =>
    ipcRenderer.on(channel, (event, ...args) => callback(...args)),

  // 저장소 API
  store: createApiMethod("store", {
    get: "store:get",
    set: "store:set",
  }),

  // 파일 시스템 API
  fs: createApiMethod("fs", {
    readFile: "fs:readFile",
    writeFile: "fs:writeFile",
    exists: "fs:exists",
    mkdir: "fs:mkdir",
    readdir: "fs:readdir",
  }),

  // 경로 API
  path: createApiMethod("path", {
    join: "path:join",
    resolve: "path:resolve",
    basename: "path:basename",
  }),

  // 셸 API
  shell: createApiMethod("shell", {
    openPath: "shell:openPath",
    trashItem: "shell:trashItem",
  }),

  // 대화상자 API
  dialog: createApiMethod("dialog", {
    showMessageBox: "dialog:showMessageBox",
    showOpenDialog: "dialog:showOpenDialog",
    showSaveDialog: "dialog:showSaveDialog",
  }),

  // 작업 디렉토리 API
  getWorkingDir: (type) => ipcRenderer.invoke("get-working-dir", type),
  checkDirectoryAccess: (type) =>
    ipcRenderer.invoke("check-directory-access", type),
};

// API 노출
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
