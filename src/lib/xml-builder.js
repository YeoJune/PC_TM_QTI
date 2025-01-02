// src/lib/xml-builder.js
const xmlbuilder = require("xmlbuilder2");
const { CONSTANTS } = require("../config/constants");

class XMLBuilder {
  constructor(config) {
    this.config = {
      ...CONSTANTS.DEFAULT_SETTINGS,
      ...config,
    };
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
      .att("xmlns", "http://www.imsglobal.org/xsd/ims_qtiasiv1p2");

    const assessment = root
      .ele("assessment")
      .att("ident", assessmentId)
      .att("title", name);

    // 메타데이터 추가
    const metadata = assessment.ele("qtimetadata");
    const metadatafield = metadata.ele("qtimetadatafield");
    metadatafield
      .ele("fieldlabel")
      .txt("qmd_timelimit")
      .up()
      .ele("fieldentry")
      .txt(this.config.timeLimit.toString());

    // 섹션 추가
    const section = assessment.ele("section").att("ident", "root_section");

    // 문제 추가
    images.forEach((image) => {
      this._addQuestionItem(section, image);
    });

    return root.end({ prettyPrint: true });
  }

  _addQuestionItem(section, image) {
    const itemId = `g${this._generateId()}`;
    const item = section
      .ele("item")
      .att("ident", itemId)
      .att("title", `Question ${image.number}`);

    // 메타데이터
    const metadata = item.ele("itemmetadata").ele("qtimetadata");

    metadata
      .ele("qtimetadatafield")
      .ele("fieldlabel")
      .txt("question_type")
      .up()
      .ele("fieldentry")
      .txt("multiple_choice_question")
      .up()
      .up();

    metadata
      .ele("qtimetadatafield")
      .ele("fieldlabel")
      .txt("points_possible")
      .up()
      .ele("fieldentry")
      .txt(this.config.points_possible.toString());

    // 프레젠테이션
    const presentation = item.ele("presentation");
    presentation
      .ele("material")
      .ele("mattext")
      .att("texttype", "text/html")
      .txt(this._createImageHtml(image.question));

    // 선지 추가
    const responseLid = presentation
      .ele("response_lid")
      .att("ident", "response1")
      .att("rcardinality", "Single");

    const renderChoice = responseLid
      .ele("render_choice")
      .att("shuffle", this.config.shuffle_answers.toString());

    // 선지 이미지 추가
    const choices = [];
    image.choices.forEach((choice, idx) => {
      const choiceId = this._addChoice(renderChoice, choice);
      choices.push(choiceId);
    });

    // 채점 정보 추가
    const correctChoiceId = choices[this.config.correct_answer_index];
    this._addScoringInfo(item, correctChoiceId);
  }

  _createManifestXml(name, assessmentId, images) {
    const manifestId = `g${this._generateId()}`;
    const root = xmlbuilder
      .create({ version: "1.0", encoding: "UTF-8" })
      .ele("manifest")
      .att("identifier", manifestId)
      .att("xmlns", "http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1");

    // 메타데이터
    root
      .ele("metadata")
      .ele("schema")
      .txt("IMS Content")
      .up()
      .ele("schemaversion")
      .txt(CONSTANTS.SCHEMA_VERSION)
      .up()
      .up();

    // Organizations
    root.ele("organizations");

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
      this._addImageResource(resources, image.question);
      image.choices.forEach((choice) => {
        this._addImageResource(resources, choice);
      });
    });

    return root.end({ prettyPrint: true });
  }

  _addImageResource(resources, imagePath) {
    const resourceId = `g${this._generateId()}`;
    const mediaPath = `${this.config.mediaDir}/${imagePath}`;

    resources
      .ele("resource")
      .att("identifier", resourceId)
      .att("type", "webcontent")
      .att("href", mediaPath)
      .ele("file")
      .att("href", mediaPath);
  }

  _createImageHtml(imagePath) {
    return `<div><p><img src="$IMS-CC-FILEBASE$/${this.config.mediaDir}/${imagePath}" alt="${imagePath}"></p></div>`;
  }

  _addChoice(renderChoice, choice, idx) {
    const choiceId = `g${this._generateId()}`;
    const response = renderChoice.ele("response_label").att("ident", choiceId);

    response
      .ele("material")
      .ele("mattext")
      .att("texttype", "text/html")
      .txt(this._createImageHtml(choice));

    return choiceId;
  }

  _addScoringInfo(item, correctChoiceId) {
    const resprocessing = item.ele("resprocessing");

    // Outcomes
    const outcomes = resprocessing.ele("outcomes");
    outcomes
      .ele("decvar")
      .att("maxvalue", "100")
      .att("minvalue", "0")
      .att("varname", "SCORE")
      .att("vartype", "Decimal");

    // Condition
    const respcondition = resprocessing
      .ele("respcondition")
      .att("continue", "No");

    const conditionvar = respcondition.ele("conditionvar");
    conditionvar
      .ele("varequal")
      .att("respident", "response1")
      .txt(correctChoiceId);

    respcondition
      .ele("setvar")
      .att("action", "Set")
      .att("varname", "SCORE")
      .txt("100");
  }

  _generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
}

module.exports = { XMLBuilder };
