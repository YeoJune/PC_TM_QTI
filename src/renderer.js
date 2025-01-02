// src/renderer.js
// 현재 실행 중인 작업 상태 관리
let runningTasks = new Set();

// 실행 파일 실행 함수
async function runExecutable(exeName, args) {
  try {
    return await window.electronAPI.invoke("run-executable", { exeName, args });
  } catch (error) {
    addLog("[오류] " + error.message);
    throw error;
  }
}

// 기본 설정 로드
async function loadSettings() {
  const settings = await window.electronAPI.store.get("settings", {
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
async function saveSettings() {
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
  await window.electronAPI.store.set("settings", settings);
}

// 파일 목록 업데이트
async function updateList(type) {
  const pathInput = document.getElementById(`${type}Path`);
  const listElement = document.getElementById(`${type}List`);
  const dirPath = pathInput.value;

  try {
    const exists = await window.electronAPI.fs.exists(dirPath);
    if (!exists) {
      await window.electronAPI.fs.mkdir(dirPath);
    }

    const files = await window.electronAPI.fs.readdir(dirPath);
    const filteredFiles = files.filter((file) => {
      if (type === "pdf") return file.endsWith(".pdf");
      if (type === "img") return !file.includes(".");
      if (type === "zip") return file.endsWith(".zip");
      return false;
    });

    listElement.innerHTML = "";
    filteredFiles.forEach((file) => {
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
async function openFolder(type) {
  const dirPath = document.getElementById(`${type}Path`).value;
  try {
    const resolvedPath = await window.electronAPI.path.resolve(dirPath);
    await window.electronAPI.shell.openPath(resolvedPath);
  } catch (error) {
    addLog(`[오류] 폴더 열기 실패: ${error.message}`);
  }
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
async function deleteSelected(type) {
  const list = document.getElementById(`${type}List`);
  const dirPath = document.getElementById(`${type}Path`).value;
  const selectedOptions = [...list.selectedOptions];

  if (selectedOptions.length === 0) return;

  const result = await window.electronAPI.dialog.showMessageBox({
    type: "question",
    buttons: ["예", "아니오"],
    defaultId: 1,
    title: "확인",
    message: "선택된 항목을 휴지통으로 이동하시겠습니까?",
  });

  if (result.response === 1) return;

  for (const option of selectedOptions) {
    try {
      const filePath = await window.electronAPI.path.join(
        dirPath,
        option.value
      );
      await window.electronAPI.shell.trashItem(filePath);
    } catch (error) {
      addLog(`[오류] 삭제 실패 (${option.value}): ${error.message}`);
    }
  }

  addLog(
    `${selectedOptions
      .map((o) => o.value)
      .join(", ")}가 휴지통으로 이동되었습니다.`
  );
  await updateList(type);
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
    const name = await window.electronAPI.path.basename(file, ".pdf");
    const pdfPath = await window.electronAPI.path.join(pdfDir, file);
    const outputDir = await window.electronAPI.path.join(imgDir, name);

    try {
      await window.electronAPI.fs.mkdir(outputDir);
      runningTasks.add(file);
      await updateList("pdf");

      await runExecutable("problem_cutter", [
        pdfPath,
        outputDir,
        name,
        JSON.stringify(config),
      ]);

      runningTasks.delete(file);
      await updateList("pdf");
      await updateList("img");
    } catch (error) {
      addLog("[오류] " + error.message);
      runningTasks.delete(file);
      await updateList("pdf");
    }
  }

  addLog("[ProblemCutter] 작업을 완료했습니다.");
  await window.electronAPI.dialog.showMessageBox({
    type: "info",
    message: "작업을 완료했습니다.",
  });
}

// 이미지 처리
async function processImages() {
  const list = document.getElementById("imgList");
  const selectedFiles = [...list.selectedOptions].map((o) => o.value);

  if (selectedFiles.length === 0) {
    addLog("[오류] 선택된 폴더가 없습니다.");
    return;
  }

  const config = {
    timeLimit: parseInt(document.getElementById("timeLimit").value),
    shuffleChoices: document.getElementById("shuffleChoices").checked,
  };

  const imgDir = document.getElementById("imgPath").value;
  const zipDir = document.getElementById("zipPath").value;

  try {
    await window.electronAPI.fs.mkdir(zipDir);
  } catch (error) {
    addLog("[오류] ZIP 디렉토리 생성 실패: " + error.message);
    return;
  }

  addLog("[TestMaker] 작업을 시작합니다. with " + selectedFiles.join(", "));

  for (const folder of selectedFiles) {
    try {
      runningTasks.add(folder);
      await updateList("img");

      await runExecutable("test_maker", [
        imgDir,
        zipDir,
        folder,
        JSON.stringify(config),
      ]);

      runningTasks.delete(folder);
      await updateList("img");
      await updateList("zip");
    } catch (error) {
      addLog("[오류] " + error.message);
      runningTasks.delete(folder);
      await updateList("img");
    }
  }

  addLog("[TestMaker] 작업을 완료했습니다.");
  await window.electronAPI.dialog.showMessageBox({
    type: "info",
    message: "작업을 완료했습니다.",
  });
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
document.addEventListener("DOMContentLoaded", async () => {
  // 설정 로드
  await loadSettings();

  // 설정 변경 감지
  document.querySelectorAll(".settings-section input").forEach((input) => {
    input.addEventListener("change", saveSettings);
  });

  // 초기 파일 목록 로드
  for (const type of ["pdf", "img", "zip"]) {
    await updateList(type);
  }

  // 전역 에러 핸들러
  window.addEventListener("error", (event) => {
    addLog("[오류] " + event.error.message);
  });

  // 미처리 Promise 에러 핸들러
  window.addEventListener("unhandledrejection", (event) => {
    addLog("[오류] 비동기 작업 실패: " + event.reason);
  });
});
