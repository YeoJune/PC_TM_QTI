# Problem Test Maker

PDF 문제지로부터 문제와 선지 이미지를 자동 분리하고 QTI 호환 테스트 패키지를 생성하는 Electron 기반 데스크톱 앱입니다.

## 주요 기능

- 📄 **PDF 절삭**: PDF 문제지에서 문제와 선지를 자동으로 감지하고 분리
- 🖼️ **이미지 추출**: 이미지로 각 문제와 선지를 개별 저장
- 📦 **QTI 패키지 생성**: Canvas LMS 등에서 사용 가능한 QTI 호환 zip 패키지 생성
- ⚙️ **설정 관리**: 해상도, 여백, 제한시간, 선지 랜덤화 등 다양한 옵션 지원

## 설치 및 실행

### 사전 빌드된 버전 사용

1. `release/` 폴더에서 최신 버전 다운로드
2. 압축 해제 후 실행 파일 실행

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# Python 모듈 빌드
npm run build:python

# 개발 모드 실행
npm start

# 프로덕션 빌드
npm run build
```

## 사용 방법

1. **PDF 업로드**: 분석할 PDF 문제지 선택
2. **설정 조정**: 해상도, 여백 등 필요에 따라 조정
3. **문제 분리**: Python 엔진이 자동으로 문제와 선지 이미지 생성
4. **테스트 생성**: QTI 호환 패키지로 변환
5. **LMS 업로드**: Canvas 등의 LMS에 직접 업로드 가능

## 기술 스택

- **Frontend**: Electron, HTML/CSS/JavaScript
- **Backend**: Node.js (파일 처리, XML 생성)
- **PDF 처리**: Python (PyMuPDF, Pillow, NumPy)
- **패키징**: PyInstaller, electron-builder

## 프로젝트 구조

```
src/
├── main.js          # Electron 메인 프로세스
├── renderer.js      # UI 렌더러
├── python/          # PDF 처리 Python 모듈
├── lib/            # 핵심 로직 (TestMaker, XMLBuilder)
└── python_dist/    # 빌드된 Python 실행 파일
```
