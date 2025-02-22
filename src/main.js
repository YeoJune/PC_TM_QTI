// src/main.js
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const Store = require("electron-store");
const { spawn } = require("child_process");
const { TestMaker } = require("./lib/test-maker");
const pLimit = require("p-limit");

// 상수 정의
const CONCURRENT_LIMIT = 4;
const limit = pLimit(CONCURRENT_LIMIT);

// 설정 저장소 초기화
const store = new Store();
Store.initRenderer();

// 작업 디렉토리 설정
const workingDirs = {
  pdf: "",
  img: "",
  tests: "",
};

// 개발 모드 확인
const isDev = !app.isPackaged;
process.env.ELECTRON_IS_DEV = isDev ? "1" : "0";

// 작업 디렉토리 초기화
async function initWorkingDirs() {
  const appPath = app.getAppPath();
  // asar 패키지일 경우 상위 디렉토리 사용
  const basePath = app.isPackaged ? path.dirname(appPath) : appPath;

  workingDirs.pdf = path.join(basePath, "pdfs");
  workingDirs.img = path.join(basePath, "imgs");
  workingDirs.tests = path.join(basePath, "tests");

  // 디렉토리 생성
  for (const dir of Object.values(workingDirs)) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`Directory created: ${dir}`);
    } catch (error) {
      if (error.code !== "EEXIST") {
        console.error(`Failed to create directory: ${dir}`, error);
        throw error;
      }
    }
  }
}

// Python 실행 파일 경로 설정
function setBinPath() {
  const binPath = isDev
    ? path.join(__dirname, "..", "python_dist")
    : path.join(process.resourcesPath, "bin");

  process.env.BIN_PATH = binPath;
  process.env.PATH = `${binPath}${path.delimiter}${process.env.PATH}`;
}

// 메인 윈도우 생성
async function createWindow() {
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

  if (isDev) {
    // mainWindow.webContents.openDevTools();
  }
}

// 앱 초기화
app.whenReady().then(async () => {
  try {
    setBinPath();
    await initWorkingDirs();
    await createWindow();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    app.quit();
  }
});

// 윈도우 관리
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

// IPC 핸들러 설정
const ipcHandlers = {
  // 실행 파일 관련
  "run-executable": async (event, { exeName, args }) => {
    return limit(async () => {
      const exePath = isDev
        ? path.join(__dirname, "python_dist", exeName, `${exeName}.exe`)
        : path.join(process.resourcesPath, "bin", exeName, `${exeName}.exe`);

      return new Promise((resolve, reject) => {
        const childProcess = spawn(exePath, args);
        let output = "";
        let error = "";

        childProcess.stdout.on("data", (data) => (output += data.toString()));
        childProcess.stderr.on("data", (data) => (error += data.toString()));
        childProcess.on("close", (code) => {
          code === 0
            ? resolve(output)
            : reject(new Error(error || `Process exited with code ${code}`));
        });
      });
    });
  },

  // TestMaker 관련
  "process-testmaker": async (event, { imgDir, zipDir, folder, config }) => {
    return limit(async () => {
      try {
        const testMaker = new TestMaker({
          ...config,
          tempDir: "./temp",
        });

        await testMaker.createPackage(
          path.join(imgDir, folder),
          zipDir,
          folder,
          config.questionCount
        );
        return true;
      } catch (error) {
        throw new Error(`TestMaker 처리 실패: ${error.message}`);
      }
    });
  },

  // 저장소 관련
  "store:get": (event, key, defaultValue) => store.get(key, defaultValue),
  "store:set": (event, key, value) => store.set(key, value),

  // 경로 관련
  "path:join": (event, ...args) => path.join(...args),
  "path:resolve": (event, ...args) => path.resolve(...args),
  "path:basename": (event, filepath, ext) => path.basename(filepath, ext),
  "get-working-dir": (event, type) => workingDirs[type] || null,

  // 파일 시스템 관련
  "fs:readFile": (event, filePath, options) => fs.readFile(filePath, options),
  "fs:writeFile": (event, filePath, data) => fs.writeFile(filePath, data),
  "fs:exists": async (event, filePath) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  "fs:mkdir": (event, dirPath) => fs.mkdir(dirPath, { recursive: true }),
  "fs:readdir": (event, dirPath) => fs.readdir(dirPath),

  // 작업 디렉토리 접근 권한 확인
  "check-directory-access": async (event, type) => {
    const dir = workingDirs[type];
    if (!dir) return false;

    try {
      await fs.access(dir, fs.constants.W_OK | fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  },

  // 셸 관련
  "shell:openPath": (event, path) => shell.openPath(path),
  "shell:trashItem": (event, path) => shell.trashItem(path),

  // 대화상자 관련
  "dialog:showMessageBox": (event, options) => dialog.showMessageBox(options),
  "dialog:showOpenDialog": (event, options) => dialog.showOpenDialog(options),
  "dialog:showSaveDialog": (event, options) => dialog.showSaveDialog(options),
};

// IPC 핸들러 등록
Object.entries(ipcHandlers).forEach(([channel, handler]) => {
  ipcMain.handle(channel, handler);
});
