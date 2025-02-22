// src/renderer.js

// 상태 관리
const state = {
  runningTasks: new Map(), // 실행 중인 작업 상태 추적
};

// DOM 요소 관리
const elements = {
  getPathInput: (type) => document.getElementById(`${type}Path`),
  getList: (type) => document.getElementById(`${type}List`),
  getLogArea: () => document.getElementById("logArea"),
  getModal: () => ({
    container: document.getElementById("modal"),
    title: document.getElementById("modal-title"),
    message: document.getElementById("modal-message"),
    confirmBtn: document.getElementById("modal-confirm"),
    cancelBtn: document.getElementById("modal-cancel"),
  }),
};

// 파일 처리 유틸리티
const fileUtils = {
  // 파일 필터링
  filterFiles: (files, type) => {
    const filters = {
      pdf: (file) => file.endsWith(".pdf"),
      img: (file) => !file.includes("."),
      tests: (file) => file.endsWith(".zip"),
    };
    return files.filter(filters[type] || (() => false));
  },

  // 파일 목록 업데이트
  updateListElement: (listElement, files) => {
    listElement.innerHTML = "";
    files.forEach((file) => {
      const option = document.createElement("option");
      option.text = file;
      option.value = file;

      if (state.runningTasks.has(file)) {
        option.classList.add("option-running");
        option.text = `${file} (처리 중...)`;
      }

      listElement.add(option);
    });
  },
};

// 로그 관리
const logger = {
  add: (message) => {
    const logArea = elements.getLogArea();
    const timestamp = new Date().toLocaleTimeString();
    logArea.value += `[${timestamp}] ${message}\n`;
    logArea.scrollTop = logArea.scrollHeight;
  },

  clear: () => {
    elements.getLogArea().value = "";
  },
};

// 모달 관리
const modal = {
  show: ({
    title,
    message,
    showCancel = false,
    onConfirm = null,
    onCancel = null,
  }) => {
    const modalElements = elements.getModal();

    modalElements.title.textContent = title;
    modalElements.message.textContent = message;
    modalElements.cancelBtn.style.display = showCancel ? "block" : "none";

    const handleConfirm = () => {
      if (onConfirm) onConfirm();
      modal.close();
    };

    const handleCancel = () => {
      if (onCancel) onCancel();
      modal.close();
    };

    modalElements.confirmBtn.onclick = handleConfirm;
    modalElements.cancelBtn.onclick = handleCancel;

    requestAnimationFrame(() => {
      modalElements.container.classList.add("show");
    });
  },

  close: () => {
    elements.getModal().container.classList.remove("show");
  },
};

// 파일 목록 관리
async function updateList(type) {
  const pathInput = elements.getPathInput(type);
  const listElement = elements.getList(type);

  try {
    const dirPath = await window.electronAPI.getWorkingDir(type);
    if (!dirPath) {
      throw new Error(`Invalid directory type: ${type}`);
    }

    pathInput.value = dirPath;

    const files = await window.electronAPI.fs.readdir(dirPath);
    const filteredFiles = fileUtils.filterFiles(files, type);
    fileUtils.updateListElement(listElement, filteredFiles);

    logger.add(`[${type.toUpperCase()}] 목록을 업데이트했습니다.`);
  } catch (error) {
    logger.add(`[오류] 목록 업데이트 실패: ${error.message}`);
  }
}

// 선택 관리 함수들
function toggleSelectAll(type) {
  const list = elements.getList(type);
  const checkbox = event.target;

  for (const option of list.options) {
    option.selected = checkbox.checked;
  }
}

function toggleSelection(event) {
  const select = event.currentTarget;
  const type = select.id.replace("List", "");
  const checkbox = document.querySelector(
    `input[onchange="toggleSelectAll('${type}')"]`
  );
  const allSelected = [...select.options].every((opt) => opt.selected);
  checkbox.checked = allSelected;
}

// 폴더 관리
async function openFolder(type) {
  try {
    const dirPath = await window.electronAPI.getWorkingDir(type);
    if (!dirPath) {
      throw new Error(`Invalid directory type: ${type}`);
    }

    await window.electronAPI.shell.openPath(dirPath);
    logger.add(`[${type}] 폴더를 열었습니다: ${dirPath}`);
  } catch (error) {
    logger.add(`[오류] 폴더 열기 실패: ${error.message}`);
  }
}

// 파일 삭제
async function deleteSelected(type) {
  const list = elements.getList(type);
  const selectedOptions = [...list.selectedOptions];

  if (selectedOptions.length === 0) return;

  modal.show({
    title: "확인",
    message: "선택된 항목을 삭제하시겠습니까?",
    showCancel: true,
    async onConfirm() {
      for (const option of selectedOptions) {
        try {
          const dirPath = await window.electronAPI.getWorkingDir(type);
          const filePath = await window.electronAPI.path.join(
            dirPath,
            option.value
          );
          await window.electronAPI.shell.trashItem(filePath);
          logger.add(`${option.value} 삭제됨`);
        } catch (error) {
          logger.add(`[오류] 삭제 실패 (${option.value}): ${error.message}`);
        }
      }
      await updateList(type);
    },
  });
}

// PDF 처리
async function processPDF() {
  const list = elements.getList("pdf");
  const selectedFiles = [...list.selectedOptions].map((o) => o.value);

  if (selectedFiles.length === 0) {
    logger.add("[오류] 선택된 PDF가 없습니다.");
    return;
  }

  const config = {
    resolution: parseInt(document.getElementById("resolution").value),
    margin: parseInt(document.getElementById("margin").value),
  };

  logger.add("[PDF 처리] 시작: " + selectedFiles.join(", "));

  const tasks = selectedFiles.map(async (file) => {
    try {
      const name = await window.electronAPI.path.basename(file, ".pdf");
      const pdfDir = await window.electronAPI.getWorkingDir("pdf");
      const imgDir = await window.electronAPI.getWorkingDir("img");

      const pdfPath = await window.electronAPI.path.join(pdfDir, file);
      const outputDir = await window.electronAPI.path.join(imgDir, name);

      await window.electronAPI.fs.mkdir(outputDir);
      state.runningTasks.set(file, "processing");
      await updateList("pdf");

      await window.electronAPI.invoke("run-executable", {
        exeName: "problem_cutter",
        args: [pdfPath, outputDir, name, JSON.stringify(config)],
      });

      state.runningTasks.delete(file);
      await updateList("pdf");
      await updateList("img");
      logger.add(`[완료] ${file}`);
    } catch (error) {
      logger.add(`[오류] ${file}: ${error.message}`);
      state.runningTasks.delete(file);
      await updateList("pdf");
    }
  });

  await Promise.allSettled(tasks);

  modal.show({
    title: "완료",
    message: "모든 PDF 처리가 완료되었습니다.",
  });
}

// 이미지 처리
async function processImages() {
  const list = elements.getList("img");
  const selectedFiles = [...list.selectedOptions].map((o) => o.value);

  if (selectedFiles.length === 0) {
    logger.add("[오류] 선택된 이미지 폴더가 없습니다.");
    return;
  }

  const questionCount = parseInt(
    document.getElementById("questionCount").value
  );
  const config = {
    timeLimit: parseInt(document.getElementById("timeLimit").value),
    shuffleChoices: document.getElementById("shuffleChoices").checked,
    questionCount: questionCount || undefined,
  };

  const imgDir = await window.electronAPI.getWorkingDir("img");
  const testsDir = await window.electronAPI.getWorkingDir("tests");

  logger.add("[이미지 처리] 시작: " + selectedFiles.join(", "));

  const tasks = selectedFiles.map(async (folder) => {
    try {
      state.runningTasks.set(folder, "processing");
      await updateList("img");

      await window.electronAPI.invoke("process-testmaker", {
        imgDir,
        zipDir: testsDir,
        folder,
        config,
      });

      state.runningTasks.delete(folder);
      await updateList("img");
      await updateList("tests");
      logger.add(`[완료] ${folder}`);
    } catch (error) {
      logger.add(`[오류] ${folder}: ${error.message}`);
      state.runningTasks.delete(folder);
      await updateList("img");
    }
  });

  await Promise.allSettled(tasks);

  modal.show({
    title: "완료",
    message: "모든 이미지 처리가 완료되었습니다.",
  });
}

// 초기화
document.addEventListener("DOMContentLoaded", async () => {
  // 초기 파일 목록 로드
  await updateList("pdf");
  await updateList("img");
  await updateList("tests");

  // 전역 에러 핸들러
  window.addEventListener("error", (event) => {
    logger.add("[오류] " + event.error.message);
  });

  // 미처리 Promise 에러 핸들러
  window.addEventListener("unhandledrejection", (event) => {
    logger.add("[오류] 비동기 작업 실패: " + event.reason);
  });
});

// HTML에서 호출할 수 있도록 전역으로 노출
Object.assign(window, {
  updateList,
  openFolder,
  deleteSelected,
  processPDF,
  processImages,
  clearLog: logger.clear,
  toggleSelectAll, // 전체 선택 토글 함수 추가
  toggleSelection, // 개별 선택 토글 함수 추가
});
