from sqlalchemy import Column, String, Integer, DateTime
from app.database import Base


class ArrearsInfoMart(Base):
    """r_arrears_info_mart 테이블 모델 (체납자 정보 - 총 체납 금액 계산용)"""
    __tablename__ = "r_arrears_info_mart"
    
    car_plate_number = Column(String(20), primary_key=True, index=True)
    arrears_user_id = Column(String(64))
    total_arrears_amount = Column(Integer)
    arrears_period = Column(String(50), index=True)
    notice_sent = Column(Integer)  # tinyint(1)
    updated_at = Column(DateTime)

