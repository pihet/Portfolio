# FastAPI Backend

FastAPI 기반 백엔드 애플리케이션입니다. MariaDB(MySQL)와 연동하여 사용자, 차량, 주행 기록 등을 관리합니다.

## 프로젝트 구조

```
backend/
├── app/                                    # FastAPI 애플리케이션
│   ├── __init__.py                         # Python 패키지 초기화
│   ├── main.py                             # FastAPI 앱 진입점, 라우터 등록, CORS 설정
│   ├── database.py                         # MariaDB 연결 설정, 세션 관리
│   │
│   ├── api/                                # API 엔드포인트 라우터
│   │   ├── admin.py                        # 시스템 관리자 API
│   │   ├── auth.py                         # 인증 API (로그인, 회원가입)
│   │   ├── city.py                         # 시청 관리자 API
│   │   ├── deps.py                         # 의존성 함수 (인증, 권한 체크)
│   │   ├── test.py                         # test 테이블 조회 API
│   │   ├── trips.py                        # 주행 기록 API
│   │   ├── users.py                        # 사용자 API
│   │   └── vehicles.py                     # 차량 API
│   │
│   ├── models/                             # SQLAlchemy 데이터베이스 모델
│   │   ├── user.py                         # 사용자 모델
│   │   ├── vehicle.py                      # 차량 모델
│   │   ├── trip.py                         # 주행 기록 모델
│   │   ├── violation.py                    # 위반 사항 모델
│   │   └── missing_person.py              # 실종자 모델
│   │
│   ├── schemas/                            # Pydantic 스키마 (요청/응답 검증)
│   │   ├── auth.py                         # 인증 스키마
│   │   ├── user.py                         # 사용자 스키마
│   │   ├── vehicle.py                      # 차량 스키마
│   │   ├── trip.py                         # 주행 기록 스키마
│   │   └── violation.py                    # 위반 사항 스키마
│   │
│   ├── core/                               # 핵심 설정
│   │   ├── config.py                       # 환경 변수 설정
│   │   └── security.py                     # JWT 토큰, 비밀번호 해싱
│   │
│   └── utils/                              # 유틸리티 함수
│       └── helpers.py
│
├── Dockerfile                              # Docker 이미지 빌드
├── init_db.py                              # 데이터베이스 테이블 초기화
├── test_db_connection.py                  # 데이터베이스 연결 테스트
├── requirements.txt                        # Python 패키지 의존성
└── README.md
```

## 기술 스택

- **Framework**: FastAPI
- **Database**: MariaDB/MySQL (PyMySQL)
- **ORM**: SQLAlchemy
- **Validation**: Pydantic
- **Authentication**: JWT
- **Server**: Uvicorn

## 설치 및 실행

### 1. 가상환경 생성 및 활성화

```bash
python -m venv fastapi
fastapi\Scripts\activate  # Windows
# source fastapi/bin/activate  # Linux/Mac
```

### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

### 3. 환경 변수 설정

**로컬 MariaDB 연결 설정은 [LOCAL_DB_SETUP.md](./LOCAL_DB_SETUP.md)를 참고하세요.**

`.env` 파일을 생성하고 환경 변수를 설정하세요:

```env
# 로컬 MariaDB 연결 (기본 포트: 3306)
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/busan_car?charset=utf8mb4
WEB_DATABASE_URL=mysql+pymysql://root:password@localhost:3306/web?charset=utf8mb4

# JWT 설정
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# 애플리케이션 설정
PROJECT_NAME=FastAPI Backend
DEBUG=False
```

### 4. 데이터베이스 연결 테스트

```bash
python test_db_connection.py
```

### 5. 데이터베이스 테이블 초기화

```bash
python init_db.py
```

### 6. 애플리케이션 실행

```bash
uvicorn app.main:app --reload
```

서버는 `http://localhost:8000`에서 실행됩니다.

API 문서: `http://localhost:8000/docs`

## API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인

### 사용자
- `GET /api/users/me` - 현재 사용자 정보 조회
- `PUT /api/users/me` - 현재 사용자 정보 수정

### 차량
- `POST /api/vehicles` - 차량 등록
- `GET /api/vehicles` - 차량 목록 조회
- `GET /api/vehicles/{vehicle_id}` - 차량 상세 조회
- `PUT /api/vehicles/{vehicle_id}` - 차량 정보 수정
- `DELETE /api/vehicles/{vehicle_id}` - 차량 삭제

### 주행 기록
- `GET /api/trips` - 주행 기록 조회
- `GET /api/trips/{trip_id}` - 주행 기록 상세 조회

### 시청 관리자
- `GET /api/city/violations` - 위반 사항 조회
- `PUT /api/city/violations/{violation_id}` - 위반 사항 상태 업데이트

### 시스템 관리자
- `GET /api/admin/users` - 모든 사용자 조회
- `DELETE /api/admin/users/{user_id}` - 사용자 삭제
- `PUT /api/admin/users/{user_id}/role` - 사용자 권한 변경

## 사용자 역할

- **general**: 일반 사용자
- **city**: 부산시 관리자
- **admin**: 시스템 관리자

## Docker 실행

```bash
docker build -t fastapi-backend .
docker run -p 8000:8000 --env-file .env fastapi-backend
```

## 보안

- JWT 토큰 기반 인증
- bcrypt를 사용한 비밀번호 해싱
- CORS 설정
- 환경 변수를 통한 민감 정보 관리
