// src/config/constants.js
const CONSTANTS = {
  SCHEMA_VERSION: "1.1.3",
  ASSESSMENT_TYPE: "imsqti_xmlv1p2",
  QUESTION_TYPE: "multiple_choice_question",
  XML_TEMPLATES: {
    QUESTION_IMAGE:
      '<div><p><img src="$IMS-CC-FILEBASE$/{mediaDir}/{image}" alt="{image}"></p></div>',
    CHOICE_IMAGE:
      '<p><img src="$IMS-CC-FILEBASE$/{mediaDir}/{image}" alt="{image}"></p>',
  },
};

module.exports = { CONSTANTS };
