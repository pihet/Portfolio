from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class LogStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    WARNING = "WARNING"


class UserLog(Base):
    """사용자 활동 로그 테이블"""
    __tablename__ = "user_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # NULL 가능 (로그인 실패 등)
    username = Column(String(255), nullable=True, index=True)  # 사용자명 (로그인 전에는 NULL)
    action = Column(String(255), nullable=False)  # 액션 (로그인, 로그아웃, 차량 등록 등)
    ip_address = Column(String(45), nullable=True)  # IP 주소 (IPv6 지원)
    status = Column(SQLEnum(LogStatus, native_enum=True, length=50, name='log_status'), default=LogStatus.SUCCESS, nullable=False)
    details = Column(String(500), nullable=True)  # 추가 상세 정보
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # 관계
    user = relationship("User", backref="logs")







