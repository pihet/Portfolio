from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from sqlalchemy.pool import NullPool

# web 데이터베이스 연결 (읽기/쓰기 모두 사용)
web_db_url = settings.WEB_DATABASE_URL or settings.DATABASE_URL.replace('/busan_car', '/web')

connect_args_web = {
    "charset": "utf8mb4",
    "connect_timeout": 30,  # RDS는 네트워크 지연이 있을 수 있으므로 타임아웃 증가
    "init_command": "SET sql_mode='STRICT_TRANS_TABLES', time_zone='+09:00'",  # 한국 시간(KST) 설정
    "read_timeout": 30,
    "write_timeout": 30,
    "read_default_file": None,
}

web_engine = create_engine(
    web_db_url,
    poolclass=NullPool,
    pool_pre_ping=True,
    echo=settings.DEBUG,
    connect_args=connect_args_web
)
WebSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=web_engine)

# Base는 web DB용으로 사용
Base = declarative_base()


def get_web_db():
    """web 데이터베이스 세션 의존성"""
    db = WebSessionLocal()
    try:
        yield db
    finally:
        db.close()


# 하위 호환성을 위한 별칭
def get_db():
    """기본 데이터베이스 세션 (web DB 사용)"""
    return get_web_db()


def init_db():
    """데이터베이스 테이블 생성 (기존 테이블 사용하므로 주석 처리)"""
    # 실제 DB 테이블을 사용하므로 테이블 생성은 하지 않음
    # 모든 모델을 import하여 Base.metadata에 등록
    from app.models import (
        user, car_plate_info, driving_session,
        driving_session_info, missing_person_detection,
        drowsy_drive, arrears_detection
    )
    # 테이블은 이미 존재하므로 생성하지 않음
    # Base.metadata.create_all(bind=engine)

