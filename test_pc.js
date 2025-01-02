const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

async function testProblemCutter() {
  const exePath = path.join(__dirname, "cpp_dist", "problem_cutter.exe");
  const testPdfPath = path.join(__dirname, "pdfs", "Y1Beta.pdf");
  const outputDir = path.join(__dirname, "imgs");

  // 경로 존재 여부 확인 및 로깅
  console.log("Checking paths...");
  console.log(
    `Executable path: ${exePath} (exists: ${fs.existsSync(exePath)})`
  );
  console.log(
    `PDF path: ${testPdfPath} (exists: ${fs.existsSync(testPdfPath)})`
  );
  console.log(
    `Output directory: ${outputDir} (exists: ${fs.existsSync(outputDir)})`
  );

  // 실행 파일 디렉토리의 DLL 목록 확인
  const dllDir = path.dirname(exePath);
  console.log("\nChecking DLLs in executable directory:");
  if (fs.existsSync(dllDir)) {
    const files = fs.readdirSync(dllDir);
    console.log(files.filter((f) => f.endsWith(".dll")));
  } else {
    console.log("DLL directory does not exist");
  }

  // 나머지 코드는 동일...
  try {
    const process = spawn(exePath, [
      testPdfPath,
      outputDir,
      "test",
      "1",
      "2",
      "8",
    ]);

    process.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });

    process.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    process.on("close", (code) => {
      console.log(`Process exited with code ${code}`);
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

testProblemCutter();
