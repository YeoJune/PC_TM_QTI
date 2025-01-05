// src/config/constants.js
const CONSTANTS = {
  SCHEMA_VERSION: "1.1.3",
  ASSESSMENT_TYPE: "imsqti_xmlv1p2",
  QUESTION_TYPE: "multiple_choice_question",
  DEFAULT_SETTINGS: {
    points_possible: 1.0,
    time_limit: 75,
    allowed_attempts: 3,
    shuffle_answers: true,
    correct_answer_index: 0, // 모든 문제의 정답을 1번으로 설정
  },
  XML_TEMPLATES: {
    QUESTION_IMAGE:
      '<div><img src="$IMS-CC-FILEBASE$/{mediaDir}/{image}" alt="{image}"></div>',
    CHOICE_IMAGE:
      '<img src="$IMS-CC-FILEBASE$/{mediaDir}/{image}" alt="{image}">',
  },
};

module.exports = { CONSTANTS };
