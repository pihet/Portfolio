from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # 데이터베이스 설정
    DATABASE_URL: str  # web DB URL (기본)
    WEB_DATABASE_URL: Optional[str] = None  # web DB URL (우선 사용, 없으면 DATABASE_URL 사용)
    
    # JWT 설정
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24시간 (개발 환경에서 편의를 위해)
    
    # CORS 설정
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"  # 쉼표로 구분된 origin 목록
    
    # 기타 설정
    PROJECT_NAME: str = "FastAPI Backend"
    DEBUG: bool = False
    
    # OAuth 설정
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    
    # OAuth 리다이렉트 URL (Google Cloud Console에 등록된 것과 정확히 일치해야 함)
    # 주의: provider 파라미터는 포함하지 않음 (콜백 URL의 쿼리 파라미터로 별도 전달됨)
    OAUTH_REDIRECT_URI: str = "http://localhost:8000/api/oauth/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # .env 파일에 정의되지 않은 필드 무시


settings = Settings()

