// src/renderer.js
const { shell, app } = require("electron");
const Store = require("electron-store");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// 설정 저장소 초기화
const store = new Store();

// 현재 실행 중인 작업 상태 관리
let runningTasks = new Set();

// 실행 파일 실행 함수
function runExecutable(exeName, args) {
  return new Promise((resolve, reject) => {
    const exePath = process.env.ELECTRON_IS_DEV
      ? path.join("python_dist", `${exeName}`) // 경로 변경
      : path.join(process.resourcesPath, "bin", `${exeName}`);

    const childProcess = spawn(exePath, args);
    let output = "";
    let error = "";

    childProcess.stdout.on("data", (data) => {
      output += data.toString();
      addLog(data.toString().trim());
    });

    childProcess.stderr.on("data", (data) => {
      error += data.toString();
      addLog("[오류] " + data.toString().trim());
    });

    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(error || `Process exited with code ${code}`));
      }
    });
  });
}

// 기본 설정 로드
function loadSettings() {
  const settings = store.get("settings", {
    pc: { resolution: 2, margin: 8 },
    tm: { timeLimit: 75, shuffleChoices: true },
  });

  document.getElementById("resolution").value = settings.pc.resolution;
  document.getElementById("margin").value = settings.pc.margin;
  document.getElementById("timeLimit").value = settings.tm.timeLimit;
  document.getElementById("shuffleChoices").checked =
    settings.tm.shuffleChoices;
}

// 설정 저장
function saveSettings() {
  const settings = {
    pc: {
      resolution: parseInt(document.getElementById("resolution").value),
      margin: parseInt(document.getElementById("margin").value),
    },
    tm: {
      timeLimit: parseInt(document.getElementById("timeLimit").value),
      shuffleChoices: document.getElementById("shuffleChoices").checked,
    },
  };
  store.set("settings", settings);
}

// 파일 목록 업데이트
function updateList(type) {
  const pathInput = document.getElementById(`${type}Path`);
  const listElement = document.getElementById(`${type}List`);
  const dirPath = pathInput.value;

  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const files = fs.readdirSync(dirPath).filter((file) => {
      if (type === "pdf") return file.endsWith(".pdf");
      if (type === "img") return !file.includes(".");
      if (type === "zip") return file.endsWith(".zip");
      return false;
    });

    listElement.innerHTML = "";
    files.forEach((file) => {
      const option = document.createElement("option");
      option.text = file;
      option.value = file;
      if (runningTasks.has(file)) {
        option.style.backgroundColor = "yellow";
      }
      listElement.add(option);
    });

    addLog(`[${type.toUpperCase()}] 목록을 업데이트했습니다.`);
  } catch (error) {
    addLog(`[오류] 목록 업데이트 실패: ${error.message}`);
  }
}

// 폴더 열기
function openFolder(type) {
  const dirPath = path.resolve(document.getElementById(`${type}Path`).value);
  shell.openPath(dirPath);
}

// 전체 선택/해제
function toggleSelectAll(type) {
  const list = document.getElementById(`${type}List`);
  const allSelected = list.length === list.selectedOptions.length;

  for (let i = 0; i < list.length; i++) {
    list.options[i].selected = !allSelected;
  }
}

// 선택된 항목 삭제
function deleteSelected(type) {
  const list = document.getElementById(`${type}List`);
  const dirPath = document.getElementById(`${type}Path`).value;
  const selectedOptions = [...list.selectedOptions];

  if (selectedOptions.length === 0) return;

  if (!confirm("선택된 항목을 휴지통으로 이동하시겠습니까?")) return;

  selectedOptions.forEach((option) => {
    const filePath = path.join(dirPath, option.value);
    try {
      shell.trashItem(filePath);
    } catch (error) {
      addLog(`[오류] 삭제 실패 (${option.value}): ${error.message}`);
      return;
    }
  });

  addLog(
    `${selectedOptions
      .map((o) => o.value)
      .join(", ")}가 휴지통으로 이동되었습니다.`
  );
  updateList(type);
}

// PDF 처리
async function processPDF() {
  const list = document.getElementById("pdfList");
  const selectedFiles = [...list.selectedOptions].map((o) => o.value);

  if (selectedFiles.length === 0) {
    addLog("[오류] 선택된 PDF가 없습니다.");
    return;
  }

  const config = {
    resolution: parseInt(document.getElementById("resolution").value),
    margin: parseInt(document.getElementById("margin").value),
  };

  const pdfDir = document.getElementById("pdfPath").value;
  const imgDir = document.getElementById("imgPath").value;

  addLog("[ProblemCutter] 작업을 시작합니다. with " + selectedFiles.join(", "));

  for (const file of selectedFiles) {
    const name = path.basename(file, ".pdf");
    const pdfPath = path.join(pdfDir, file);
    const outputDir = path.join(imgDir, name);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      runningTasks.add(file);
      updateList("pdf");

      // Python 버전 인터페이스로 변경
      await runExecutable("problem_cutter.exe", [
        pdfPath,
        outputDir,
        name,
        JSON.stringify(config), // 설정을 JSON 문자열로 전달
      ]);

      runningTasks.delete(file);
      updateList("pdf");
      updateList("img");
    } catch (error) {
      addLog("[오류] " + error.message);
      runningTasks.delete(file);
      updateList("pdf");
    }
  }

  addLog("[ProblemCutter] 작업을 완료했습니다.");
  alert("작업을 완료했습니다.");
}

async function processImages() {
  const list = document.getElementById("imgList");
  const selectedFiles = [...list.selectedOptions].map((o) => o.value);

  if (selectedFiles.length === 0) {
    addLog("[오류] 선택된 폴더가 없습니다.");
    return;
  }

  // Match UserConfig structure
  const config = {
    timeLimit: parseInt(document.getElementById("timeLimit").value),
    shuffleChoices: document.getElementById("shuffleChoices").checked,
  };

  const imgDir = document.getElementById("imgPath").value;
  const zipDir = document.getElementById("zipPath").value;

  if (!fs.existsSync(zipDir)) {
    fs.mkdirSync(zipDir, { recursive: true });
  }

  addLog("[TestMaker] 작업을 시작합니다. with " + selectedFiles.join(", "));
  for (const folder of selectedFiles) {
    try {
      runningTasks.add(folder);
      updateList("img");

      await runExecutable("test_maker", [
        path.join(imgDir),
        zipDir,
        folder,
        JSON.stringify(config), // Convert config to JSON string
      ]);

      runningTasks.delete(folder);
      updateList("img");
      updateList("zip");
    } catch (error) {
      addLog("[오류] " + error.message);
      runningTasks.delete(folder);
      updateList("img");
    }
  }

  addLog("[TestMaker] 작업을 완료했습니다.");
  alert("작업을 완료했습니다.");
}

// 로그 관리
function addLog(message) {
  const logArea = document.getElementById("logArea");
  const timestamp = new Date().toLocaleTimeString();
  logArea.value += `[${timestamp}] ${message}\n`;
  logArea.scrollTop = logArea.scrollHeight;
}

function clearLog() {
  document.getElementById("logArea").value = "";
}

// 이벤트 리스너 등록
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  // 설정 변경 감지
  document.querySelectorAll(".settings-section input").forEach((input) => {
    input.addEventListener("change", saveSettings);
  });

  // 초기 파일 목록 로드
  ["pdf", "img", "zip"].forEach((type) => updateList(type));
});
