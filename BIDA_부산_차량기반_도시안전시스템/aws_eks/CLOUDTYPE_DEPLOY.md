# Cloudtype 배포 설정

이 저장소는 프론트엔드와 FastAPI 백엔드를 **별도 서비스**로 배포해야 합니다.
두 서비스의 배포환경도 동일하게 설정합니다.

## 서비스 1: FastAPI 백엔드

- 서브 디렉토리: `BIDA_부산_차량기반_도시안전시스템/aws_eks/backend`
- 빌드 방식: Dockerfile
- 포트: `8000`
- Dockerfile 경로: `Dockerfile`

Cloudtype 환경변수에 아래 값을 추가합니다.

| 이름 | 값 |
| --- | --- |
| `DATABASE_URL` | MySQL 접속 문자열 (`mysql+pymysql://...`) |
| `WEB_DATABASE_URL` | 웹 DB 접속 문자열 (`mysql+pymysql://.../web?...`) |
| `SECRET_KEY` | 충분히 긴 임의의 비밀값 |
| `CORS_ORIGINS` | 프론트엔드 공개 URL (예: `https://frontend...cloudtype.app`) |
| `FRONTEND_URL` | 프론트엔드 공개 URL |
| `OAUTH_REDIRECT_URI` | `https://<백엔드-공개-URL>/api/oauth/callback` |

`DATABASE_URL`과 `SECRET_KEY`는 미설정 시 FastAPI가 시작하지 않으므로 Cloudtype 시크릿으로 등록합니다.

## 서비스 2: React 프론트엔드

- 서브 디렉토리: `BIDA_부산_차량기반_도시안전시스템/aws_eks/frontend`
- 빌드 방식: Dockerfile
- 포트: `80`
- Dockerfile 경로: `Dockerfile`

동일 배포환경에 있고 백엔드 서비스 이름이 `backend-service`라면 추가 설정 없이 `/api` 요청이 내부의 `backend-service:8000`으로 전달됩니다.

서비스 이름이 다르다면 `frontend/nginx.conf`의 `backend-service`를 Cloudtype의 백엔드 내부 호스트명으로 변경합니다. 서로 다른 배포환경에 배치했다면 프론트엔드의 빌드 인자 `VITE_API_BASE_URL`에 백엔드의 **공개 HTTPS URL**을 입력하고, 위의 `CORS_ORIGINS`에도 프론트엔드 URL을 넣습니다.

## 배포 후 확인

1. 백엔드 공개 URL의 `/health`가 `{"status":"healthy"}`를 반환하는지 확인합니다.
2. 프론트엔드 URL을 연 뒤 브라우저 개발자도구 Network에서 `/api/...` 요청이 502/503이 아닌지 확인합니다.
3. 503이면 Cloudtype 포트가 백엔드 `8000`, 프론트엔드 `80`으로 각각 설정됐는지와 백엔드 환경변수를 확인합니다.
