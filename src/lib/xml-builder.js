// src/lib/xml-builder.js
const xmlbuilder = require("xmlbuilder2");
const { CONSTANTS } = require("../config/constants");

class XMLBuilder {
  constructor(config) {
    this.config = config;
  }

  generateXML(name, assessmentId, images) {
    return {
      quizXml: this._createQuizXml(name, assessmentId, images),
      manifestXml: this._createManifestXml(name, assessmentId, images),
    };
  }

  _createQuizXml(name, assessmentId, images) {
    const root = xmlbuilder
      .create({ version: "1.0", encoding: "UTF-8" })
      .ele("questestinterop")
      .ele("assessment")
      .att("ident", assessmentId)
      .att("title", name);

    // 메타데이터 추가
    this._addMetadata(root);

    // 섹션 및 문제 추가
    const section = root.ele("section").att("ident", "root_section");
    images.forEach((image, index) => {
      this._addQuestionItem(section, image, index + 1);
    });

    return root.end({ prettyPrint: true });
  }

  _addMetadata(root) {
    root
      .ele("qtimetadata")
      .ele("qtimetadatafield")
      .ele("fieldlabel")
      .txt("qmd_timelimit")
      .up()
      .ele("fieldentry")
      .txt(this.config.timeLimit.toString());
  }

  _addQuestionItem(section, image, number) {
    const item = section
      .ele("item")
      .att("ident", `q${number}`)
      .att("title", `Question ${number}`);

    // 문제 이미지 추가
    item
      .ele("material")
      .ele("mattext")
      .att("texttype", "text/html")
      .txt(this._createImageHtml(image.question));

    // 선지 추가
    const responseList = item
      .ele("response_lid")
      .att("ident", "response1")
      .att("rcardinality", "Single");

    const choices = responseList
      .ele("render_choice")
      .att("shuffle", this.config.shuffleChoices.toString());

    image.choices.forEach((choice, idx) => {
      this._addChoice(choices, choice, idx);
    });

    // 채점 정보 추가
    this._addScoringInfo(item);
  }

  _createManifestXml(name, assessmentId, images) {
    const root = xmlbuilder
      .create({ version: "1.0", encoding: "UTF-8" })
      .ele("manifest")
      .att("identifier", `MANIFEST-${assessmentId}`)
      .att("xmlns", "http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1");

    // 메타데이터
    root
      .ele("metadata")
      .ele("schema")
      .txt("IMS Content")
      .up()
      .ele("schemaversion")
      .txt(CONSTANTS.SCHEMA_VERSION);

    // 리소스
    const resources = root.ele("resources");

    // Assessment 리소스
    resources
      .ele("resource")
      .att("identifier", assessmentId)
      .att("type", CONSTANTS.ASSESSMENT_TYPE)
      .ele("file")
      .att("href", `${assessmentId}/${assessmentId}.xml`);

    // 이미지 리소스
    images.forEach((image) => {
      this._addImageResources(resources, image);
    });

    return root.end({ prettyPrint: true });
  }

  _addImageResources(resources, image) {
    // 문제 이미지
    this._addImageResource(resources, image.question);
    // 선지 이미지들
    image.choices.forEach((choice) => {
      this._addImageResource(resources, choice);
    });
  }

  _addImageResource(resources, imagePath) {
    const resourceId = `RES-${this._generateId()}`;
    const mediaPath = `${this.config.mediaDir}/${imagePath}`;

    resources
      .ele("resource")
      .att("identifier", resourceId)
      .att("type", "webcontent")
      .att("href", mediaPath)
      .ele("file")
      .att("href", mediaPath);
  }

  _generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
}

module.exports = { XMLBuilder };
