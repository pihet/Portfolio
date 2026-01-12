# API Base URL 설정 가이드

## 자동 감지 (기본)

프론트엔드는 자동으로 현재 접속한 호스트 주소를 기반으로 API URL을 결정합니다.

- `http://localhost:5173`으로 접속 → `http://localhost:8000` 사용
- `http://[YOUR_IP]:5173`으로 접속 → `http://[YOUR_IP]:8000` 사용

## 수동 설정 (환경 변수)

특정 IP 주소로 고정하고 싶다면 `.env` 파일을 생성하세요:

### 1. `.env` 파일 생성

프론트엔드 루트 디렉토리(`frontend/`)에 `.env` 파일을 생성합니다.

### 2. API Base URL 설정

```env
VITE_API_BASE_URL=http://[YOUR_IP]:8000
```

### 3. 개발 서버 재시작

환경 변수를 변경한 후에는 개발 서버를 재시작해야 합니다:

```bash
npm run dev
```

## 확인 방법

브라우저 콘솔에서 다음 메시지를 확인할 수 있습니다:

```
API Request URL: http://[YOUR_IP]:8000/api/...
```

이 메시지로 현재 사용 중인 API URL을 확인할 수 있습니다.




