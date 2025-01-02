# src/python/test_maker.py
import os
import json
import shutil
import zipfile
import logging
from uuid import uuid4
from typing import List, Dict, Optional
from dataclasses import dataclass
from dotenv import load_dotenv

@dataclass
class UserConfig:
    """사용자 설정 (프론트엔드에서 조정 가능)"""
    time_limit: int = 75
    points_per_question: float = 1.0
    shuffle_choices: bool = True
    default_correct_answer: int = 0

class EnvConfig:
    """환경 변수 설정"""
    def __init__(self):
        load_dotenv()
        self.media_dir: str = os.getenv('MEDIA_DIR', "업로드 된 미디어")
        self.question_suffix: str = os.getenv('QUESTION_SUFFIX', "9")
        self.choice_pattern: List[int] = json.loads(
            os.getenv('CHOICE_PATTERN', '[0,1,2,3]')
        )
        self.temp_dir: str = os.getenv('TEMP_DIR', './temp')

class StaticConfig:
    """변경 불가능한 설정"""
    SCHEMA_VERSION = "1.1.3"
    QUESTION_TYPE = "multiple_choice_question"
    ASSESSMENT_TYPE = "imsqti_xmlv1p2"
    ENCODING = "UTF-8"
    
    # XML 템플릿
    QUESTION_IMAGE_TEMPLATE = '''
      <material>
        <mattext texttype="text/html">&lt;div&gt;&lt;p&gt;&lt;img src="$IMS-CC-FILEBASE$/{media_dir}/{image}" alt="{image}"&gt;&lt;/p&gt;&lt;/div&gt;</mattext>
      </material>'''
      
    CHOICE_IMAGE_TEMPLATE = '''
      <response_label ident="{choice_id}">
        <material>
          <mattext texttype="text/html">&lt;p&gt;&lt;img src="$IMS-CC-FILEBASE$/{media_dir}/{image}" alt="{image}"&gt;&lt;/p&gt;</mattext>
        </material>
      </response_label>'''

class TestMakerError(Exception):
    """TestMaker 관련 예외"""
    pass

class TestMaker:
    def __init__(self, 
                 input_dir: str,
                 output_dir: str,
                 user_config: Optional[UserConfig] = None,
                 env_config: Optional[EnvConfig] = None):
        """TestMaker 초기화
        
        Args:
            input_dir: 입력 이미지 디렉토리
            output_dir: 출력 ZIP 디렉토리
            user_config: 사용자 설정
            env_config: 환경 설정
        """
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.user_config = user_config or UserConfig()
        self.env_config = env_config or EnvConfig()
        
        # 로거 설정
        self.logger = logging.getLogger('TestMaker')
        self.logger.setLevel(logging.INFO)
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def _generate_id(self) -> str:
        """고유 식별자 생성"""
        return 'g' + uuid4().hex.replace('-', '')

    def _collect_images(self, name: str) -> List[Dict]:
        """이미지 파일 수집

        Returns:
            [{
                'question': str,
                'choices': List[str],
                'number': int
            }]
        """
        images = []
        number = 1
        while True:
            # 문제 이미지 확인
            q_img = f"{name}{number:02d}{self.env_config.question_suffix}.png"
            q_path = os.path.join(self.input_dir, name, q_img)
            
            if not os.path.exists(q_path):
                break
            
            # 선지 이미지 확인
            choices = []
            for choice_num in self.env_config.choice_pattern:
                c_img = f"{name}{number:02d}{choice_num}.png"
                c_path = os.path.join(self.input_dir, name, c_img)
                
                if not os.path.exists(c_path):
                    self.logger.warning(f"Missing choice image: {c_img}")
                    continue
                    
                choices.append(c_img)
            
            if not choices:
                self.logger.error(f"No choice images found for question {number}")
                break
                
            images.append({
                'question': q_img,
                'choices': choices,
                'number': number
            })
            
            number += 1
            
        if not images:
            raise TestMakerError("No valid questions found")
            
        return images

    def _create_quiz_xml(self, name: str, images: List[Dict]) -> str:
        """QTI XML 생성"""
        items = []
        
        for image_set in images:
            # 선지 XML 생성
            choices = []
            correct_choice_id = None
            
            for idx, choice in enumerate(image_set['choices']):
                choice_id = self._generate_id()
                if idx == self.user_config.default_correct_answer:
                    correct_choice_id = choice_id
                    
                choices.append(StaticConfig.CHOICE_IMAGE_TEMPLATE.format(
                    choice_id=choice_id,
                    media_dir=self.env_config.media_dir,
                    image=choice
                ))
            
            # 문항 XML 생성
            item_id = self._generate_id()
            question_image = StaticConfig.QUESTION_IMAGE_TEMPLATE.format(
                media_dir=self.env_config.media_dir,
                image=image_set['question']
            )
            
            items.append(f'''
    <item ident="{item_id}" title="Question {image_set['number']}">
      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield>
            <fieldlabel>question_type</fieldlabel>
            <fieldentry>{StaticConfig.QUESTION_TYPE}</fieldentry>
          </qtimetadatafield>
          <qtimetadatafield>
            <fieldlabel>points_possible</fieldlabel>
            <fieldentry>{self.user_config.points_per_question}</fieldentry>
          </qtimetadatafield>
        </qtimetadata>
      </itemmetadata>
      <presentation>
        {question_image}
        <response_lid ident="response1" rcardinality="Single">
          <render_choice shuffle="{str(self.user_config.shuffle_choices).lower()}">
            {"".join(choices)}
          </render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes>
          <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
        </outcomes>
        <respcondition continue="No">
          <conditionvar>
            <varequal respident="response1">{correct_choice_id}</varequal>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>
        </respcondition>
      </resprocessing>
    </item>''')
            
        # 전체 assessment XML 생성
        assessment_id = self._generate_id()
        assessment_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="{assessment_id}" title="{name}">
    <qtimetadata>
      <qtimetadatafield>
        <fieldlabel>qmd_timelimit</fieldlabel>
        <fieldentry>{self.user_config.time_limit}</fieldentry>
      </qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
      {"".join(items)}
    </section>
  </assessment>
</questestinterop>'''
        
        return assessment_xml, assessment_id

    def _create_manifest_xml(self, name: str, assessment_id: str, images: List[Dict]) -> str:
        """Manifest XML 생성"""
        resources = []
        
        # 이미지 리소스 등록
        all_images = []
        for image_set in images:
            all_images.append(image_set['question'])
            all_images.extend(image_set['choices'])
            
        for image in all_images:
            resource_id = self._generate_id()
            resources.append(f'''
    <resource identifier="{resource_id}" type="webcontent" href="{self.env_config.media_dir}/{image}">
      <file href="{self.env_config.media_dir}/{image}"/>
    </resource>''')
            
        manifest = f'''<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="{self._generate_id()}" 
  xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
  <metadata>
    <schema>IMS Content</schema>
    <schemaversion>{StaticConfig.SCHEMA_VERSION}</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    <resource identifier="{assessment_id}" type="{StaticConfig.ASSESSMENT_TYPE}">
      <file href="{assessment_id}/{assessment_id}.xml"/>
    </resource>
    {"".join(resources)}
  </resources>
</manifest>'''
        
        return manifest

    def create_package(self, name: str) -> str:
        """퀴즈 패키지 생성
        
        Args:
            name: 퀴즈 이름
            
        Returns:
            생성된 ZIP 파일 경로
            
        Raises:
            TestMakerError: 패키지 생성 실패 시
        """
        temp_dir = os.path.join(self.env_config.temp_dir, name)
        try:
            # 임시 디렉토리 준비
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            os.makedirs(temp_dir)
            os.makedirs(os.path.join(temp_dir, self.env_config.media_dir))
            
            # 이미지 수집 및 복사
            images = self._collect_images(name)
            for image_set in images:
                # 문제 이미지 복사
                shutil.copy2(
                    os.path.join(self.input_dir, name, image_set['question']),
                    os.path.join(temp_dir, self.env_config.media_dir)
                )
                # 선지 이미지 복사
                for choice in image_set['choices']:
                    shutil.copy2(
                        os.path.join(self.input_dir, name, choice),
                        os.path.join(temp_dir, self.env_config.media_dir)
                    )
            
            # XML 파일 생성
            quiz_xml, assessment_id = self._create_quiz_xml(name, images)
            manifest_xml = self._create_manifest_xml(name, assessment_id, images)
            
            # XML 파일 저장
            os.makedirs(os.path.join(temp_dir, assessment_id))
            with open(os.path.join(temp_dir, assessment_id, f'{assessment_id}.xml'), 'w', encoding='utf-8') as f:
                f.write(quiz_xml)
            with open(os.path.join(temp_dir, 'imsmanifest.xml'), 'w', encoding='utf-8') as f:
                f.write(manifest_xml)
            
            # ZIP 파일 생성
            zip_path = os.path.join(self.output_dir, f'{name}({len(images)}).zip')
            with zipfile.ZipFile(zip_path, 'w') as zf:
                for folder_name, _, filenames in os.walk(temp_dir):
                    for filename in filenames:
                        file_path = os.path.join(folder_name, filename)
                        arcname = os.path.relpath(file_path, temp_dir)
                        zf.write(file_path, arcname)
                        
            return zip_path
            
        except Exception as e:
            raise TestMakerError(f"Failed to create package: {str(e)}")
            
        finally:
            # 임시 디렉토리 정리
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

def create_test_package(input_dir: str,
                       output_dir: str,
                       name: str,
                       config: dict = None) -> str:
    """Node.js에서 호출할 메인 함수
    
    Args:
        input_dir: 입력 이미지 디렉토리
        output_dir: 출력 ZIP 디렉토리
        name: 퀴즈 이름
        config: 설정 딕셔너리 (선택사항)
        
    Returns:
        생성된 ZIP 파일 경로
    """
    try:
        user_config = None
        if config:
            user_config = UserConfig(
                time_limit=config.get('timeLimit', 75),
                points_per_question=config.get('pointsPerQuestion', 1.0),
                shuffle_choices=config.get('shuffleChoices', True),
                default_correct_answer=config.get('defaultCorrectAnswer', 0)
            )
            
        maker = TestMaker(input_dir, output_dir, user_config)
        return maker.create_package(name)
        
    except Exception as e:
        raise TestMakerError(f"Package creation failed: {str(e)}")

if __name__ == "__main__":
    import sys
    import json
    
    if len(sys.argv) < 4:
        print("Usage: test_maker.exe [input_dir] [output_dir] [name] [settings]")
        sys.exit(1)
    
    try:
        # 인자 처리
        input_dir = sys.argv[1]
        output_dir = sys.argv[2]
        name = sys.argv[3]
        settings = json.loads(sys.argv[4]) if len(sys.argv) > 4 else None
        
        # 실행
        result = create_test_package(input_dir, output_dir, name, settings)
        print(f"Package created: {result}")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)