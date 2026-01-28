// src/lib/xml-builder.js
const xmlbuilder = require("xmlbuilder2");

class XMLBuilder {
  constructor(config) {
    this.config = {
      shuffleAnswers: true,
      defaultGrade: 1.0,
      penalty: 0.0,
      feedbackText: "답이 맞습니다.",
      ...config,
    };
  }

  generateXML(name, images, driveFileIds) {
    const root = xmlbuilder
      .create({ version: "1.0", encoding: "UTF-8" })
      .ele("quiz");

    // 카테고리 설정
    this._addCategory(root, "$course$/top");
    this._addCategory(root, `$course$/top/${name}`);

    // 문제 추가
    images.forEach((image, index) => {
      this._addQuestion(root, image, driveFileIds, index + 1);
    });

    return root.end({ prettyPrint: true });
  }

  _addCategory(root, categoryPath) {
    root
      .ele("question")
      .att("type", "category")
      .ele("category")
      .ele("text")
      .txt(categoryPath);
  }

  _addQuestion(root, image, driveFileIds, questionNumber) {
    const question = root.ele("question").att("type", "multichoice");

    // 문제 이름
    question.ele("name").ele("text").txt(`문제 ${questionNumber}`);

    // 문제 이미지
    const questionFileId = driveFileIds.get(image.question);
    const questionImgTag = this._createImageTag(questionFileId);

    question
      .ele("questiontext")
      .att("format", "html")
      .ele("text")
      .dat(questionImgTag);

    // 피드백
    question
      .ele("generalfeedback")
      .att("format", "html")
      .ele("text")
      .txt(this.config.feedbackText);

    // 문제 설정
    question.ele("defaultgrade").txt(this.config.defaultGrade.toString());
    question.ele("penalty").txt(this.config.penalty.toString());
    question.ele("hidden").txt("0");
    question.ele("single").txt("true");
    question
      .ele("shuffleanswers")
      .txt(this.config.shuffleAnswers ? "true" : "false");
    question.ele("answernumbering").txt("abc");

    // 빈 피드백들
    question.ele("correctfeedback").att("format", "html").ele("text").txt("");
    question
      .ele("partiallycorrectfeedback")
      .att("format", "html")
      .ele("text")
      .txt("");
    question.ele("incorrectfeedback").att("format", "html").ele("text").txt("");

    // 선지 추가 (첫 번째가 정답)
    image.choices.forEach((choice, idx) => {
      const isCorrect = idx === this.config.correctAnswerIndex;
      const choiceFileId = driveFileIds.get(choice);
      this._addAnswer(question, choiceFileId, isCorrect);
    });
  }

  _addAnswer(question, fileId, isCorrect) {
    const answer = question
      .ele("answer")
      .att("fraction", isCorrect ? "100" : "0")
      .att("format", "html");

    const imgTag = this._createImageTag(fileId);
    answer.ele("text").dat(imgTag);

    answer.ele("feedback").att("format", "html").ele("text").txt("");
  }

  _createImageTag(fileId) {
    const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    return `<img src="${url}" alt="" width="800" role="presentation" class="img-responsive atto_image_button_text-bottom">`;
  }
}

module.exports = { XMLBuilder };
