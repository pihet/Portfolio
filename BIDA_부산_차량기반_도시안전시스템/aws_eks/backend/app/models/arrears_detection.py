from sqlalchemy import Column, String, Integer, Float, DateTime
from app.database import Base


class ArrearsDetectionMart(Base):
    """r_arrears_detection_mart 테이블 모델 (반정규화 - arrears_info 통합)"""
    __tablename__ = "r_arrears_detection_mart"
    
    detection_id = Column(String(64), primary_key=True, index=True)
    car_plate_number = Column(String(20), index=True)
    image_id = Column(String(64))
    detection_success = Column(Integer)  # tinyint(1)
    detected_lat = Column(Float)
    detected_lon = Column(Float)
    detected_time = Column(DateTime, index=True)
    # arrears_info 정보 반정규화
    total_arrears_amount = Column(Integer)
    arrears_period = Column(String(50))
    notice_sent = Column(Integer)  # tinyint(1)














