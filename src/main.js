// src/main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const Store = require("electron-store");

// 설정 저장소 초기화
Store.initRenderer();

process.env.ELECTRON_IS_DEV = !app.isPackaged ? "1" : "0";

// BIN_PATH 설정 변경
const setBinPath = () => {
  const binPath = app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.join(__dirname, "..", "python_dist"); // 경로 변경

  process.env.BIN_PATH = binPath;
  process.env.PATH = `${binPath};${process.env.PATH}`;
};

function createWindow() {
  setBinPath(); // PATH 설정 추가

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
