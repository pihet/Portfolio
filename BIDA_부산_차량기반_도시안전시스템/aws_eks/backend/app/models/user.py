from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    GENERAL = "GENERAL"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.GENERAL, nullable=False)
    organization = Column(String(50))  # busan, nts, police, system
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # OAuth 관련 필드
    oauth_provider = Column(String(20), nullable=True)  # 'google', 'naver', 'kakao'
    oauth_id = Column(String(255), nullable=True)  # OAuth 제공자에서 받은 고유 ID
    oauth_email = Column(String(255), nullable=True)  # OAuth 이메일 (중복 확인용)
    
    # 관계는 Vehicle 모델에서 backref로 정의됨 (vehicles)

#ㄹ