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

  generateXML(name, assessmentId, images, questionCount) {
    return {
      quizXml: this._createQuizXml(name, assessmentId, images, questionCount),
      manifestXml: this._createManifestXml(name, assessmentId, images),
    };
  }

  _createQuizXml(name, assessmentId, images, questionCount) {
    const root = xmlbuilder
      .create({ version: "1.0", encoding: "UTF-8" })
      .ele("questestinterop")
      .att("xmlns", "http://www.imsglobal.org/xsd/ims_qtiasiv1p2");

    const assessment = root
      .ele("assessment")
      .att("ident", assessmentId)
      .att("title", name);

    // Add assessment metadata
    const assessmentMetadata = assessment.ele("qtimetadata");
    this._addMetadataField(
      assessmentMetadata,
      "cc_maxattempts",
      this.config.allowed_attempts.toString()
    );

    // Add root section
    const rootSection = assessment.ele("section").att("ident", "root_section");

    // Add group section
    const groupSection = rootSection
      .ele("section")
      .att("ident", `g${this._generateId()}`)
      .att("title", "그룹");

    // Add selection ordering for group with specified question count
    const selectionOrdering = groupSection.ele("selection_ordering");
    const selection = selectionOrdering.ele("selection");
    selection.ele("selection_number").txt(questionCount.toString());
    const selectionExtension = selection.ele("selection_extension");
    selectionExtension
      .ele("points_per_item")
      .txt(this.config.points_possible.toString());

    // Add questions to group
    images.forEach((image) => {
      this._addQuestionItem(groupSection, image);
    });

    return root.end({ prettyPrint: true });
  }

  _addMetadataField(metadata, label, entry) {
    metadata
      .ele("qtimetadatafield")
      .ele("fieldlabel")
      .txt(label)
      .up()
      .ele("fieldentry")
      .txt(entry);
  }

  _addQuestionItem(section, image) {
    const itemId = `g${this._generateId()}`;
    const item = section.ele("item").att("ident", itemId).att("title", "문제");

    // Add item metadata
    const metadata = item.ele("itemmetadata").ele("qtimetadata");

    this._addMetadataField(
      metadata,
      "question_type",
      "multiple_choice_question"
    );
    this._addMetadataField(
      metadata,
      "points_possible",
      this.config.points_possible.toString()
    );

    // Generate and add answer IDs
    const answerIds = Array(4)
      .fill()
      .map(() => Math.floor(Math.random() * 10000));
    this._addMetadataField(
      metadata,
      "original_answer_ids",
      answerIds.join(",")
    );

    // Add unique assessment question identifier
    this._addMetadataField(
      metadata,
      "assessment_question_identifierref",
      `g${this._generateId()}`
    );

    // Add presentation
    const presentation = item.ele("presentation");
    presentation
      .ele("material")
      .ele("mattext")
      .att("texttype", "text/html")
      .txt(this._createImageHtml(image.question));

    // Add response options
    const responseLid = presentation
      .ele("response_lid")
      .att("ident", "response1")
      .att("rcardinality", "Single");

    const renderChoice = responseLid.ele("render_choice");

    // Add choices
    image.choices.forEach((choice, idx) => {
      const choiceId = answerIds[idx].toString();
      this._addChoice(renderChoice, choice, choiceId);
    });

    // Add scoring info
    this._addScoringInfo(
      item,
      answerIds[this.config.correct_answer_index].toString()
    );
  }

  _addChoice(renderChoice, choice, choiceId) {
    const response = renderChoice.ele("response_label").att("ident", choiceId);

    response
      .ele("material")
      .ele("mattext")
      .att("texttype", "text/html")
      .txt(this._createImageHtml(choice));
  }

  _addScoringInfo(item, correctChoiceId) {
    const resprocessing = item.ele("resprocessing");

    const outcomes = resprocessing.ele("outcomes");
    outcomes
      .ele("decvar")
      .att("maxvalue", "100")
      .att("minvalue", "0")
      .att("varname", "SCORE")
      .att("vartype", "Decimal");

    const respcondition = resprocessing
      .ele("respcondition")
      .att("continue", "No");

    respcondition
      .ele("conditionvar")
      .ele("varequal")
      .att("respident", "response1")
      .txt(correctChoiceId);

    respcondition
      .ele("setvar")
      .att("action", "Set")
      .att("varname", "SCORE")
      .txt("100");
  }

  _createManifestXml(name, assessmentId, images) {
    const manifestId = `g${this._generateId()}`;
    const root = xmlbuilder
      .create({ version: "1.0", encoding: "UTF-8" })
      .ele("manifest")
      .att("identifier", manifestId)
      .att("xmlns", "http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1");

    root
      .ele("metadata")
      .ele("schema")
      .txt("IMS Content")
      .up()
      .ele("schemaversion")
      .txt(CONSTANTS.SCHEMA_VERSION)
      .up()
      .up();

    root.ele("organizations");

    const resources = root.ele("resources");

    resources
      .ele("resource")
      .att("identifier", assessmentId)
      .att("type", CONSTANTS.ASSESSMENT_TYPE)
      .ele("file")
      .att("href", `${assessmentId}/${assessmentId}.xml`);

    images.forEach((image) => {
      this._addImageResource(resources, image.question);
      image.choices.forEach((choice) => {
        this._addImageResource(resources, choice);
      });
    });

    return root.end({ prettyPrint: true });
  }

  _createImageHtml(imagePath) {
    return `<div><p><img src="$IMS-CC-FILEBASE$/${this.config.mediaDir}/${imagePath}" alt="${imagePath}"></p></div>`;
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

  _generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
}

module.exports = { XMLBuilder };
