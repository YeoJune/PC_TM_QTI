// src/main.js
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const Store = require("electron-store");
const { spawn } = require("child_process");
const { TestMaker } = require("./lib/test-maker");
const pLimit = require("p-limit");
const CONCURRENT_LIMIT = 4; // 병렬 처리 개수 상수 설정
const limit = pLimit(CONCURRENT_LIMIT);

// 설정 저장소 초기화
const store = new Store();
Store.initRenderer();

// 개발 모드 확인
process.env.ELECTRON_IS_DEV = !app.isPackaged ? "1" : "0";

// Python 실행 파일 경로 설정
const setBinPath = () => {
  const binPath = app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.join(__dirname, "..", "python_dist");

  process.env.BIN_PATH = binPath;
  process.env.PATH = `${binPath}${path.delimiter}${process.env.PATH}`;
};

// 메인 윈도우 생성
async function createWindow() {
  setBinPath();

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  await mainWindow.loadFile(path.join(__dirname, "index.html"));

  // 개발 도구 (개발 모드에서만 활성화)
  if (process.env.ELECTRON_IS_DEV === "1") {
    //mainWindow.webContents.openDevTools();
  }
}

// 앱 초기화
app.whenReady().then(createWindow);

// 윈도우 처리
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Python 실행 파일 실행 핸들러
ipcMain.handle("run-executable", async (event, { exeName, args }) => {
  return limit(async () => {
    const exePath =
      process.env.ELECTRON_IS_DEV === "1"
        ? path.join(__dirname, "python_dist", exeName, `${exeName}.exe`)
        : path.join(process.resourcesPath, "bin", exeName, `${exeName}.exe`);

    return new Promise((resolve, reject) => {
      const childProcess = spawn(exePath, args);
      let output = "";
      let error = "";

      childProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      childProcess.stderr.on("data", (data) => {
        error += data.toString();
      });

      childProcess.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Process exited with code ${code}`));
        }
      });
    });
  });
});

ipcMain.handle(
  "process-testmaker",
  async (event, { imgDir, zipDir, folder, config }) => {
    return limit(async () => {
      try {
        const testMaker = new TestMaker(config);
        await testMaker.createPackage(
          path.join(imgDir, folder), // input directory
          zipDir, // output directory
          folder // name
        );
        return true;
      } catch (error) {
        throw new Error(`TestMaker 처리 실패: ${error.message}`);
      }
    });
  }
);

// Store IPC 핸들러
ipcMain.handle("store:get", (event, key, defaultValue) => {
  return store.get(key, defaultValue);
});

ipcMain.handle("store:set", (event, key, value) => {
  store.set(key, value);
});

// Path IPC 핸들러
ipcMain.handle("path:join", (event, ...args) => {
  return path.join(...args);
});

ipcMain.handle("path:resolve", (event, ...args) => {
  return path.resolve(...args);
});

ipcMain.handle("path:basename", (event, filepath, ext) => {
  return path.basename(filepath, ext);
});

// Shell IPC 핸들러
ipcMain.handle("shell:openPath", async (event, path) => {
  return shell.openPath(path);
});

ipcMain.handle("shell:trashItem", async (event, path) => {
  return shell.trashItem(path);
});

// 파일 시스템 IPC 핸들러
ipcMain.handle("fs:readFile", async (event, filePath, options) => {
  return fs.readFile(filePath, options);
});

ipcMain.handle("fs:writeFile", async (event, filePath, data) => {
  return fs.writeFile(filePath, data);
});

ipcMain.handle("fs:exists", async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("fs:mkdir", async (event, dirPath) => {
  return fs.mkdir(dirPath, { recursive: true });
});

ipcMain.handle("fs:readdir", async (event, dirPath) => {
  return fs.readdir(dirPath);
});

// 대화상자 IPC 핸들러
ipcMain.handle("dialog:showMessageBox", async (event, options) => {
  return dialog.showMessageBox(options);
});

ipcMain.handle("dialog:showOpenDialog", async (event, options) => {
  return dialog.showOpenDialog(options);
});

ipcMain.handle("dialog:showSaveDialog", async (event, options) => {
  return dialog.showSaveDialog(options);
});

ipcMain.handle("get-app-path", () => {
  return app.getAppPath();
});

ipcMain.handle("get-absolute-path", (event, relativePath) => {
  return path.resolve(app.getAppPath(), relativePath.replace(/^\.\//, ""));
});
