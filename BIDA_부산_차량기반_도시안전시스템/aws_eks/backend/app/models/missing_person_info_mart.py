from sqlalchemy import Column, String, Integer, DateTime
from app.database import Base


class MissingPersonInfoMart(Base):
    """r_missing_person_info_mart 테이블 모델 (실종자 신고 정보)"""
    __tablename__ = "r_missing_person_info_mart"
    
    missing_id = Column(String(64), primary_key=True, index=True)
    missing_name = Column(String(100))
    missing_age = Column(Integer)
    missing_identity = Column(String(255))
    registered_at = Column(DateTime, index=True)  # 신고일 (월별 통계 기준)
    updated_at = Column(DateTime)
    missing_location = Column(String(50))

