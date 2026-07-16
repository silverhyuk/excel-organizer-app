# 📊 딸깍 정리기 (Smart Excel Account Organizer)

> **계좌 거래 내역 엑셀 파일을 "딸깍" 한 번으로 카테고리화하고, 호텔/숙박 지출금을 집중 정리해 주는 프리미엄 데스크톱 애플리케이션**

Tauri v2와 React를 활용해 제작한 초경량 데스크톱 네이티브 앱입니다. 은행에서 다운로드받은 입출금 엑셀 파일을 드래그 앤 드롭하는 것만으로 복잡한 거래 내역이 시각적인 통계와 차트로 보기 좋게 자동 분류됩니다.

---

## ✨ 주요 기능 (Key Features)

*   **📂 스마트 엑셀 업로드 (Drag & Drop)**: 국민, 신한, 우리, 농협 등 국내 다양한 은행의 엑셀 파일을 그대로 드롭하여 파싱합니다.
*   **🤖 자동 컬럼 매핑**: 날짜, 적요, 출금액, 입금액, 잔액 등의 열을 똑똑하게 감지하여 은행별 양식 편차를 자동으로 상쇄합니다.
*   **🏨 호텔/숙박 지출금 집중 정리**: 사용자가 가장 알고 싶어 하는 호텔 및 숙박(호텔, 신라, 힐튼, 야놀자, 여기어때 등) 지출액 정보를 전면에 강조 및 시각화해 줍니다.
*   **🏷️ 카테고리 및 분류 규칙 설정**: 사용자가 직접 필터링할 키워드를 편집(추가/삭제)할 수 있어 사용할수록 분류 정확도가 높아집니다.
*   **🧩 동적 정산 양식**: 큰 카테고리와 작은 카테고리를 필요한 만큼 추가·삭제할 수 있으며, 내보내는 Excel의 행과 합계 범위도 설정에 맞춰 자동 확장됩니다.
*   **🔄 실시간 수동 재분류**: 매칭이 잘못되었거나 '기타 지출'로 빠진 내역을 드롭다운 선택만으로 손쉽게 수동으로 재분류할 수 있습니다.
*   **📤 정리 완료된 엑셀 내보내기**: 정리 및 보정된 내역을 깔끔한 형태의 표로 정렬하여 새로운 엑셀 파일(`.xlsx`)로 다운로드할 수 있습니다.
*   **🔒 100% 오프라인 동작 (강력한 보안)**: 업로드한 엑셀 파일은 외부 서버로 전송되지 않고 사용자의 PC 로컬 환경 안에서만 동작하므로, 민감한 개인 계좌 정보가 완벽하게 보호됩니다.

---

## 🎨 기술 스택 및 디자인 (Tech Stack & Aesthetics)

*   **Frontend**: React (Vite)
*   **Desktop Shell**: Tauri v2 (Rust Backend)
*   **Excel Engine**: SheetJS (`xlsx`)
*   **Styling**: Vanilla CSS (Glassmorphism & Cyberpunk Dark Theme)
*   **Icons**: Lucide React
*   **Typography**: Google Fonts Outfit & Noto Sans KR

---

## 🚀 시작 가이드 (Getting Started)

로컬 개발 환경(macOS)에서 프로젝트를 실행하고 테스트하는 방법입니다.

### 1. 사전 요구사항 (Prerequisites)
*   **Node.js**: v18 이상 설치 권장
*   **Rust**: Tauri 데스크톱 개발 환경 구동을 위한 Rust 컴파일러 설치
    ```bash
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    ```

### 2. 패키지 설치
```bash
# 의존성 패키지 설치
npm install
```

### 3. 개발 서버 실행
*   **웹 개발 서버 구동** (브라우저로 즉시 확인):
    ```bash
    npm run dev
    ```
*   **Tauri 데스크톱 앱 구동** (데스크톱 네이티브 윈도우 실행):
    ```bash
    npm run tauri dev
    ```

---

## 📦 Windows용 설치 파일 자동 빌드 및 다운로드 (CI/CD)

맥북(macOS)에서 개발하더라도 **GitHub Actions**를 통해 Windows용 실행 파일(`.exe` / `.msi`)을 자동으로 빌드할 수 있습니다.

1.  본 프로젝트의 코드를 개인 GitHub 저장소에 Push합니다.
2.  새로운 버전 태그를 생성하여 푸시합니다.
    ```bash
    git tag v0.1.0
    git push origin v0.1.0
    ```
3.  GitHub 저장소의 **Actions** 탭에서 `Build and Release Desktop App` 워크플로우가 실행됩니다.
4.  빌드가 완료되면 **Releases** 페이지에서 Windows용 설치 파일 및 macOS용 설치 파일(`.dmg`)을 즉시 다운로드하여 사용하실 수 있습니다.

---

## 📁 폴더 구조 (Folder Structure)

```text
excel-organizer-app/
├── .github/workflows/
│   └── tauri-build.yml     # GitHub Actions 자동 빌드 설정 파일
├── src-tauri/              # Rust 기반 Tauri 데스크톱 백엔드
│   ├── src/                # Rust 소스코드 (main.rs, lib.rs)
│   ├── Cargo.toml          # Rust 크레이트 종속성 설정
│   └── tauri.conf.json     # 윈도우 타이틀, 크기 및 단축기 설정
├── src/                    # React 프론트엔드
│   ├── components/         # UI 컴포넌트
│   ├── utils/              
│   │   ├── excelParser.js  # 은행별 엑셀 파서 및 익스포터
│   │   └── classifier.js   # 키워드 기반 지출 분류 엔진
│   ├── App.jsx             # 메인 앱 코디네이터 및 상태 관리
│   └── index.css           # 다크 테마 및 유리 질감(Glassmorphism) 스타일시트
├── index.html              # HTML 진입점 및 SEO 적용
└── package.json            # npm 라이브러리 종속성 설정
```
