// src/lib/test-maker.js
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const pLimit = require("p-limit");
const { DriveUploader } = require("./drive-uploader");
const { XMLBuilder } = require("./xml-builder");
const { FileUtils } = require("./utils");
const { CONSTANTS } = require("../config/constants");

const UPLOAD_CONCURRENCY = 10; // 동시 업로드 수

class TestMaker {
  constructor(config = {}) {
    this.config = {
      questionSuffix: process.env.QUESTION_SUFFIX || "9",
      choicePattern: JSON.parse(process.env.CHOICE_PATTERN || "[0,1,2,3]"),
      tempDir: process.env.TEMP_DIR || "./temp",
      timeLimit: CONSTANTS.DEFAULT_SETTINGS.time_limit,
      shuffleChoices: CONSTANTS.DEFAULT_SETTINGS.shuffle_answers,
      correctAnswerIndex: CONSTANTS.DEFAULT_SETTINGS.correct_answer_index,
      driveFolderId: null, // 루트 폴더 ID
      ...config,
    };

    this.fileUtils = new FileUtils(this.config);
    this.driveUploader = new DriveUploader(
      "./credentials.json",
      "./token.json",
      this.config.driveFolderId,
    );
    this.xmlBuilder = new XMLBuilder({
      shuffleAnswers: this.config.shuffleChoices,
      correctAnswerIndex: this.config.correctAnswerIndex,
    });
  }

  async createPackage(inputDir, outputDir, name, questionCount) {
    try {
      // Drive 초기화
      console.log("Initializing Google Drive...");
      await this.driveUploader.initialize();

      // 이미지 수집
      console.log("Collecting images...");
      const allImages = await this.fileUtils.collectImages(inputDir, name);

      if (!allImages.length) {
        throw new Error("No valid questions found");
      }

      const selectedImages = allImages;
      questionCount = questionCount || selectedImages.length;

      if (questionCount && questionCount > allImages.length) {
        throw new Error(
          `Requested ${questionCount} questions but only ${allImages.length} questions available`,
        );
      }

      // Drive 폴더 생성
      console.log(`Creating Drive folder: ${name}`);
      const folderId = await this.driveUploader.createFolder(name);

      // 이미지 업로드
      console.log("Uploading images to Google Drive...");
      const driveFileIds = await this._uploadAllImages(
        inputDir,
        selectedImages,
        folderId,
      );

      // XML 생성
      console.log("Generating Moodle XML...");
      const xmlContent = this.xmlBuilder.generateXML(
        name,
        selectedImages,
        driveFileIds,
      );

      // XML 파일 저장
      const xmlPath = path.join(
        outputDir,
        `${name}(${questionCount},${selectedImages.length}).xml`,
      );
      await this.fileUtils.writeXMLFile(xmlPath, xmlContent);

      console.log(`Package created: ${xmlPath}`);
      return xmlPath;
    } catch (error) {
      throw new Error(`Failed to create package: ${error.message}`);
    }
  }

  async _uploadAllImages(inputDir, images, folderId) {
    const driveFileIds = new Map();
    const limit = pLimit(UPLOAD_CONCURRENCY);
    const uploadTasks = [];

    for (const image of images) {
      // 문제 이미지 업로드 태스크
      const questionTask = limit(async () => {
        const questionPath = path.join(inputDir, image.question);
        const questionUuid = `${uuidv4()}.png`;

        console.log(`Uploading question: ${image.question} as ${questionUuid}`);
        const questionFileId = await this.driveUploader.uploadImageWithName(
          questionPath,
          questionUuid,
          folderId,
        );
        driveFileIds.set(image.question, questionFileId);
      });
      uploadTasks.push(questionTask);

      // 선지 이미지 업로드 태스크
      for (const choice of image.choices) {
        const choiceTask = limit(async () => {
          const choicePath = path.join(inputDir, choice);
          const choiceUuid = `${uuidv4()}.png`;

          console.log(`Uploading choice: ${choice} as ${choiceUuid}`);
          const choiceFileId = await this.driveUploader.uploadImageWithName(
            choicePath,
            choiceUuid,
            folderId,
          );
          driveFileIds.set(choice, choiceFileId);
        });
        uploadTasks.push(choiceTask);
      }
    }

    // 모든 업로드 태스크 병렬 실행
    await Promise.all(uploadTasks);

    return driveFileIds;
  }
}

module.exports = { TestMaker };
