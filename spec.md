# Problem Test Maker - Technical Documentation

## Core Components

### 1. Python Programs

#### ProblemCutter

- **빌드 방식**: PyInstaller onedir 빌드
- **주요 기능**: PDF 파일로부터 문제와 선지 이미지를 자동으로 분리
- **실행 인자**:
  ```bash
  problem_cutter.exe [pdf_path] [output_dir] [name] [settings]
  # settings: {"resolution": number, "margin": number}
  ```

### 2. Electron Application

#### Project Structure

```
/project
├── /src
│   ├── /python_dist          # Python 빌드 출력물
│   │   └── problem_cutter/   # ProblemCutter onedir
│   ├── /lib
│   │   ├── test-maker.js     # 테스트 생성 핵심 로직
│   │   ├── xml-builder.js    # XML 생성 로직
│   │   └── utils.js          # 유틸리티 함수
│   ├── /config
│   │   └── constants.js      # 상수 및 설정
│   ├── main.js              # Electron 메인 프로세스
│   ├── preload.js           # 보안을 위한 preload 스크립트
│   ├── renderer.js          # 렌더러 프로세스
│   └── index.html           # 메인 UI
├── package.json
├── build.bat                # Python 빌드 스크립트
└── problem_cutter.spec      # PyInstaller 스펙
```

#### Configuration

```json
{
  "settings": {
    "pc": {
      "resolution": 2,
      "margin": 8
    },
    "tm": {
      "timeLimit": 75,
      "shuffleChoices": true
    }
  }
}
```

#### Required Dependencies

```json
{
  "dependencies": {
    "archiver": "^5.3.1",
    "electron-store": "^8.1.0",
    "uuid": "^9.0.0",
    "xmlbuilder2": "^3.1.1"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "rimraf": "^5.0.5"
  }
}
```

## Core Features

### 1. PDF Processing (Python)

- Problem Cutter로 문제와 선지 이미지 분리
- Resolution: 1-4배율 지원
- Margin: 0-20px 지원
- 자동 참조점 검출

### 2. Test Generation (Node.js)

1. **이미지 수집 및 구조화**

   ```javascript
   {
     question: "test019.png",
     choices: ["test010.png", "test011.png"],
     number: 1
   }
   ```

2. **QTI XML 생성**

   - Schema Version: 1.1.3
   - Assessment Type: imsqti_xmlv1p2
   - Question Type: multiple_choice_question

3. **패키지 구조**

```
{name}.zip
├── imsmanifest.xml
├── {assessment-id}/
│   └── {assessment-id}.xml
└── 업로드 된 미디어/
    ├── question1.png
    ├── choice1-1.png
    └── ...
```

## File Processing Flow

```
PDF → ProblemCutter(Python) → 이미지 세트 → TestMaker(Node.js) → QTI 패키지
```

## Implementation Notes

### Security

- Node API 직접 사용 제한
- contextIsolation 활성화
- preload 스크립트를 통한 API 제공

### File Operations

- 비동기 파일 작업 처리
- 안전한 경로 관리
- 자동 디렉토리 생성
- 임시 파일 정리

### UI/UX

- 실시간 작업 상태 표시
- 진행 상황 로깅
- 간단한 설정 관리
- 직관적인 파일 목록 관리

### Error Handling

- Python 프로세스 에러 처리
- 파일 작업 에러 처리
- 사용자 친화적 에러 메시지
- 전역 에러 캐치
