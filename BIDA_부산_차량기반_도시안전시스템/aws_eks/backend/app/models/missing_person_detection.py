from sqlalchemy import Column, String, Integer, Float, DateTime
from app.database import Base


class MissingPersonDetectionMart(Base):
    """r_missing_person_detection_mart 테이블 모델 (반정규화 - missing_person_info 통합)"""
    __tablename__ = "r_missing_person_detection_mart"
    
    detection_id = Column(String(64), primary_key=True, index=True)
    missing_id = Column(String(64), index=True)
    image_id = Column(String(64))
    detection_success = Column(Integer)  # tinyint(1)
    detected_lat = Column(Float)
    detected_lon = Column(Float)
    detected_time = Column(DateTime, index=True)
    # missing_person_info 정보 반정규화
    missing_name = Column(String(100))
    missing_age = Column(Integer)








