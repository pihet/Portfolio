# 부산시 스마트 도시 차량 서비스 - Frontend

부산시 스마트 도시 계획을 위한 차량 서비스 웹 애플리케이션의 프론트엔드입니다.

## 📋 프로젝트 개요

차량을 활용한 3가지 주요 서비스:
- **실시간 운전자 졸음 행동 탐지** - 차량 내부 카메라를 통한 졸음운전 탐지
- **체납자 차량 번호판 탐지** - 차량 외부 카메라를 통한 번호판 인식 및 국세청 알림
- **실종자 탐지** - 차량 외부 카메라를 통한 실종자 발견 및 경찰청 알림

## 🎯 주요 기능

- **일반 사용자**: 회원가입/로그인, 차량 등록/관리, 안전습관 점수 조회
- **부산시 관리자**: 안전운전/불법주정차/실종자 관리 (PowerBI 대시보드)
- **시스템 관리자**: 사용자 관리 및 활동 로그 모니터링

## 🛠 기술 스택

- **React** 19.2.0 + **TypeScript** 5.9.3
- **Vite** 7.2.4 - 빌드 도구
- **Material-UI** 5.14.20 - UI 컴포넌트
- **Zustand** 4.4.7 - 상태 관리
- **React Router DOM** 6.20.0 - 라우팅
- **PowerBI Client** 2.23.1 - 데이터 시각화

## 🚀 시작하기

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build## 🔐 인증

Mock 인증 시스템:
- **일반 사용자**: 아무 아이디/비밀번호로 로그인 가능
- **부산시 관리자**: 인증 코드 `BUSAN2024` 필요
- **시스템 관리자**: 인증 코드 `SYSTEM2024` 필요

## 📊 PowerBI 통합

### 구현 방식
- **iframe 임베드 방식** 사용 (백엔드 불필요)
- Power BI에서 "웹에 게시"로 생성한 공개 임베드 URL 사용
- `PowerBIEmbedView` 컴포넌트를 통해 iframe으로 표시

### 사용 방법
1. Power BI에서 리포트를 "웹에 게시"로 설정
2. 생성된 공개 임베드 URL 형식: `https://app.powerbi.com/view?r=...`
3. 각 대시보드 페이지에서 URL을 상수로 정의하여 사용
script
const POWER_BI_REPORT_URL = "https://app.powerbi.com/view?r=...";

<PowerBIEmbedView 
  reportUrl={POWER_BI_REPORT_URL} 
  height="600px" 
/>### 적용된 대시보드
- 안전운전 현황 대시보드 (`CityDashboardSafeDriving`)
- 불법주정차 현황 대시보드 (`CityDashboardIllegalParking`)
- 실종자 현황 대시보드 (`CityDashboardMissingPerson`)

### 참고사항
- 공개 임베드 URL은 누구나 접근 가능하므로 민감한 데이터 주의
- 향후 백엔드 연동 시 공식 임베드 방식(Embed Token)으로 전환 가능

## 🔄 상태 관리

- **authStore**: 사용자 인증 상태 (Zustand + LocalStorage persist)
- **vehicleStore**: 차량 정보 및 주행 기록

## 🎨 주요 특징

- Material Design 기반 반응형 UI
- 역할별 맞춤형 대시보드
- PowerBI를 통한 데이터 시각화
- TypeScript로 타입 안정성 확보

---


## 🚀 시작하기

### 로컬 개발

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview## 🐳 Docker 빌드 및 배포

### Docker 이미지 빌드

이 프로젝트는 Docker를 사용하여 컨테이너 이미지로 빌드할 수 있습니다.

#### 1. 이미지 빌드
ash
# Power BI URL을 환경 변수로 전달하여 빌드
docker build \
  --build-arg VITE_POWER_BI_SAFE_DRIVING_URL="https://app.powerbi.com/view?r=..." \
  --build-arg VITE_POWER_BI_MISSING_PERSON_URL="" \
  --build-arg VITE_POWER_BI_ILLEGAL_PARKING_URL="" \
  -t frontend-app:latest \
  .#### 2. 로컬에서 컨테이너 실행

# 컨테이너 실행
docker run -d -p 3000:80 --name frontend-test frontend-app:latest

# 브라우저에서 확인
# http://localhost:3000#### 3. Docker Hub에 푸시

# Docker Hub 로그인
docker login

# 이미지 태그 지정
docker tag frontend-app:latest <사용자명>/frontend-app:latest

# Docker Hub에 푸시
docker push <사용자명>/frontend-app:latest#### 4. Docker Hub에서 이미지 사용

# 다른 환경에서 이미지 가져오기
docker pull <사용자명>/frontend-app:latest

# 컨테이너 실행
docker run -d -p 3000:80 <사용자명>/frontend-app:latest### Docker 이미지 정보

- **이미지 크기**: 약 53.6MB
- **베이스 이미지**: 
  - 빌드 단계: `node:20-alpine`
  - 실행 단계: `nginx:alpine`
- **포트**: 80 (내부), 호스트 포트는 자유롭게 매핑 가능
- **Docker Hub**: [9sujeong10/frontend-app](https://hub.docker.com/r/9sujeong10/frontend-app)

### Docker 파일 구조

**마지막 업데이트**: 2025-11-29
