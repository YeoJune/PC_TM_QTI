// 현재 실행 중인 작업 상태 관리
let runningTasks = new Map(); // Set 대신 Map 사용하여 진행 상태 추적

// 파일 목록 업데이트
async function updateList(type) {
  const pathInput = document.getElementById(`${type}Path`);
  const listElement = document.getElementById(`${type}List`);
  const dirPath = pathInput.value;

  try {
    // 디렉토리 존재 확인 및 생성
    const exists = await window.electronAPI.fs.exists(dirPath);
    if (!exists) {
      await window.electronAPI.fs.mkdir(dirPath);
    }

    // 파일 목록 가져오기
    const files = await window.electronAPI.fs.readdir(dirPath);
    const filteredFiles = files.filter((file) => {
      if (type === "pdf") return file.endsWith(".pdf");
      if (type === "img") return !file.includes(".");
      if (type === "tests") return file.endsWith(".zip");
      return false;
    });

    // 목록 업데이트
    listElement.innerHTML = "";
    filteredFiles.forEach((file) => {
      const option = document.createElement("option");
      option.text = file;
      option.value = file;

      // 진행 중인 작업 상태 표시
      if (runningTasks.has(file)) {
        const progress = runningTasks.get(file);
        option.classList.add("option-running");
        option.text = `${file} (처리 중...)`;
      }

      listElement.add(option);
    });

    addLog(`[${type.toUpperCase()}] 목록을 업데이트했습니다.`);
  } catch (error) {
    addLog(`[오류] 목록 업데이트 실패: ${error.message}`);
  }
}

// 전체 선택 토글
function toggleSelectAll(type) {
  const list = document.getElementById(`${type}List`);
  const checkbox = event.target;

  for (const option of list.options) {
    option.selected = checkbox.checked;
  }
}

// 항목 선택 토글
function toggleSelection(event) {
  // 선택이 변경될 때마다 전체 선택 체크박스 상태만 업데이트
  const select = event.currentTarget; // select 엘리먼트
  const type = select.id.replace("List", "");
  const checkbox = document.querySelector(
    `input[onchange="toggleSelectAll('${type}')"]`
  );
  const allSelected = [...select.options].every((opt) => opt.selected);
  checkbox.checked = allSelected;
}

// 폴더 열기
async function openFolder(type) {
  const dirPath = document.getElementById(`${type}Path`).value;

  try {
    const absolutePath = await window.electronAPI.getAbsolutePath(dirPath);
    await window.electronAPI.shell.openPath(absolutePath);
  } catch (error) {
    addLog(`[오류] 폴더 열기 실패: ${error.message}`);
  }
}

// 선택된 항목 삭제

async function deleteSelected(type) {
  const list = document.getElementById(`${type}List`);
  const dirPath = document.getElementById(`${type}Path`).value;
  const selectedOptions = [...list.selectedOptions];

  if (selectedOptions.length === 0) return;

  showModal({
    title: "확인",
    message: "선택된 항목을 삭제하시겠습니까?",
    showCancel: true,
    async onConfirm() {
      for (const option of selectedOptions) {
        try {
          const absolutePath = await window.electronAPI.getAbsolutePath(
            dirPath
          );
          const filePath = await window.electronAPI.path.join(
            absolutePath,
            option.value
          );
          await window.electronAPI.shell.trashItem(filePath);
          addLog(`${option.value} 삭제됨`);
        } catch (error) {
          addLog(`[오류] 삭제 실패 (${option.value}): ${error.message}`);
        }
      }
      await updateList(type);
    },
  });
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

  addLog("[PDF 처리] 시작: " + selectedFiles.join(", "));

  const tasks = selectedFiles.map(async (file) => {
    try {
      const name = await window.electronAPI.path.basename(file, ".pdf");
      const pdfPath = await window.electronAPI.path.join(pdfDir, file);
      const outputDir = await window.electronAPI.path.join(imgDir, name);

      await window.electronAPI.fs.mkdir(outputDir);
      runningTasks.set(file, "processing");
      await updateList("pdf");

      await window.electronAPI.invoke("run-executable", {
        exeName: "problem_cutter",
        args: [pdfPath, outputDir, name, JSON.stringify(config)],
      });

      runningTasks.delete(file);
      await updateList("pdf");
      await updateList("img");
      addLog(`[완료] ${file}`);
    } catch (error) {
      addLog(`[오류] ${file}: ${error.message}`);
      runningTasks.delete(file);
      await updateList("pdf");
    }
  });

  await Promise.allSettled(tasks);

  showModal({
    title: "완료",
    message: "모든 PDF 처리가 완료되었습니다.",
  });
}

// 이미지 처리
async function processImages() {
  const list = document.getElementById("imgList");
  const selectedFiles = [...list.selectedOptions].map((o) => o.value);

  if (selectedFiles.length === 0) {
    addLog("[오류] 선택된 이미지 폴더가 없습니다.");
    return;
  }

  const questionCount = parseInt(
    document.getElementById("questionCount").value
  );
  const config = {
    timeLimit: parseInt(document.getElementById("timeLimit").value),
    shuffleChoices: document.getElementById("shuffleChoices").checked,
    questionCount: questionCount || undefined, // 0이면 undefined로 설정하여 전체 문제 선택
  };

  const imgDir = document.getElementById("imgPath").value;
  const zipDir = await window.electronAPI.path.join(imgDir, "../tests");

  await window.electronAPI.fs.mkdir(zipDir);

  addLog("[이미지 처리] 시작: " + selectedFiles.join(", "));

  const tasks = selectedFiles.map(async (folder) => {
    try {
      runningTasks.set(folder, "processing");
      await updateList("img");

      await window.electronAPI.invoke("process-testmaker", {
        imgDir,
        zipDir,
        folder,
        config,
      });

      runningTasks.delete(folder);
      await updateList("img");
      await updateList("tests");
      addLog(`[완료] ${folder}`);
    } catch (error) {
      addLog(`[오류] ${folder}: ${error.message}`);
      runningTasks.delete(folder);
      await updateList("img");
    }
  });

  await Promise.allSettled(tasks);

  showModal({
    title: "완료",
    message: "모든 이미지 처리가 완료되었습니다.",
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

// 모달 표시 함수
function showModal({
  title,
  message,
  showCancel = false,
  onConfirm = null,
  onCancel = null,
}) {
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalMessage = document.getElementById("modal-message");
  const cancelButton = document.getElementById("modal-cancel");
  const confirmButton = document.getElementById("modal-confirm");

  modalTitle.textContent = title;
  modalMessage.textContent = message;
  cancelButton.style.display = showCancel ? "block" : "none";

  // 이벤트 핸들러 설정
  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closeModal();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeModal();
  };

  confirmButton.onclick = handleConfirm;
  cancelButton.onclick = handleCancel;

  // 모달 표시
  requestAnimationFrame(() => {
    modal.classList.add("show");
  });
}

// 모달 닫기 함수
function closeModal() {
  const modal = document.getElementById("modal");
  modal.classList.remove("show");
}

// 초기화
document.addEventListener("DOMContentLoaded", async () => {
  // 초기 파일 목록 로드
  await updateList("pdf");
  await updateList("img");
  await updateList("tests");

  // 전역 에러 핸들러
  window.addEventListener("error", (event) => {
    addLog("[오류] " + event.error.message);
  });

  // 미처리 Promise 에러 핸들러
  window.addEventListener("unhandledrejection", (event) => {
    addLog("[오류] 비동기 작업 실패: " + event.reason);
  });
});
