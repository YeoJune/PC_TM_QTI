// src/lib/test-maker.js
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const archiver = require("archiver");
const { XMLBuilder } = require("./xml-builder");
const { FileUtils } = require("./utils");
const { CONSTANTS } = require("../config/constants");

class TestMaker {
  constructor(config = {}) {
    this.config = {
      mediaDir: process.env.MEDIA_DIR || "업로드 된 미디어",
      questionSuffix: process.env.QUESTION_SUFFIX || "9",
      choicePattern: JSON.parse(process.env.CHOICE_PATTERN || "[0,1,2,3]"),
      tempDir: process.env.TEMP_DIR || "./temp",
      timeLimit: CONSTANTS.DEFAULT_SETTINGS.time_limit,
      pointsPerQuestion: CONSTANTS.DEFAULT_SETTINGS.points_possible,
      shuffleChoices: CONSTANTS.DEFAULT_SETTINGS.shuffle_answers,
      correctAnswerIndex: CONSTANTS.DEFAULT_SETTINGS.correct_answer_index,
      questionsPerGroup: 2, // 기본값으로 2문제
      ...config,
    };
    this.xmlBuilder = new XMLBuilder(this.config);
    this.fileUtils = new FileUtils(this.config);
  }

  async createPackage(inputDir, outputDir, name, questionCount) {
    const tempDir = path.join(this.config.tempDir, name);
    try {
      // 전체 이미지 수집
      const allImages = await this._collectAndCopyImages(
        inputDir,
        name,
        tempDir
      );

      if (!allImages.length) {
        throw new Error("No valid questions found");
      }

      const selectedImages = allImages;

      questionCount = questionCount || selectedImages.length;

      // questionCount가 전체 문제 수보다 크면 에러 (그룹당 선택 수 검증)
      if (questionCount && questionCount > allImages.length) {
        throw new Error(
          `Requested ${questionCount} questions per group but only ${allImages.length} questions available`
        );
      }

      const assessmentId = this._generateId();
      await this._generateXMLFiles(
        name,
        assessmentId,
        selectedImages,
        questionCount
      );

      const zipPath = path.join(
        outputDir,
        `${name}(${questionCount},${selectedImages.length}).zip`
      );
      await this._createZipPackage(tempDir, zipPath);

      return zipPath;
    } catch (error) {
      throw new Error(`Failed to create package: ${error.message}`);
    } finally {
      await this.fileUtils.cleanupTempDir(tempDir);
    }
  }

  async _collectAndCopyImages(inputDir, name, tempDir) {
    const images = await this.fileUtils.collectImages(inputDir, name);
    await this.fileUtils.copyImagesToTemp(images, inputDir, tempDir);
    return images;
  }

  async _generateXMLFiles(name, assessmentId, images, questionCount) {
    const tempDir = path.join(this.config.tempDir, name);

    const { quizXml, manifestXml } = this.xmlBuilder.generateXML(
      name,
      assessmentId,
      images,
      questionCount
    );

    await Promise.all([
      this.fileUtils.writeXMLFile(
        path.join(tempDir, assessmentId, `${assessmentId}.xml`),
        quizXml
      ),
      this.fileUtils.writeXMLFile(
        path.join(tempDir, "imsmanifest.xml"),
        manifestXml
      ),
    ]);
  }

  async _createZipPackage(tempDir, zipPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve(zipPath));
      archive.on("error", (err) => reject(err));

      archive.pipe(output);
      archive.directory(tempDir, false);
      archive.finalize();
    });
  }

  _generateId() {
    return "g" + uuidv4().replace(/-/g, "");
  }
}

module.exports = { TestMaker };
