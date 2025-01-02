// src/lib/utils.js
const fs = require("fs").promises;
const path = require("path");
const { rimraf } = require("rimraf"); // rimraf 가져오는 방식 변경

class FileUtils {
  constructor(config) {
    this.config = config;
  }

  async collectImages(inputDir, name) {
    const images = [];
    let number = 1;

    while (true) {
      const questionImage = `${name}${String(number).padStart(2, "0")}${
        this.config.questionSuffix
      }.png`;
      const questionPath = path.join(inputDir, questionImage);

      if (!(await this.fileExists(questionPath))) {
        break;
      }

      const choices = [];
      for (const choiceNum of this.config.choicePattern) {
        const choiceImage = `${name}${String(number).padStart(
          2,
          "0"
        )}${choiceNum}.png`;
        const choicePath = path.join(inputDir, choiceImage);

        if (await this.fileExists(choicePath)) {
          choices.push(choiceImage);
        }
      }

      if (choices.length) {
        images.push({
          question: questionImage,
          choices,
          number,
        });
      }

      number++;
    }

    return images;
  }

  async copyImagesToTemp(images, inputDir, tempDir, name) {
    const mediaDir = path.join(tempDir, this.config.mediaDir);
    await fs.mkdir(mediaDir, { recursive: true });

    for (const image of images) {
      // 문제 이미지 복사
      await this.copyFile(
        path.join(inputDir, image.question), // name 제거
        path.join(mediaDir, image.question)
      );

      // 선지 이미지 복사
      for (const choice of image.choices) {
        await this.copyFile(
          path.join(inputDir, choice), // name 제거
          path.join(mediaDir, choice)
        );
      }
    }
  }

  async writeXMLFile(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
  }

  async cleanupTempDir(tempDir) {
    if (await this.fileExists(tempDir)) {
      await rimraf(tempDir); // Promise를 직접 사용
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(src, dest) {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}

module.exports = { FileUtils };
