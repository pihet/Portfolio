from sqlalchemy import Column, String, Integer, DateTime
from app.database import Base


class ArrearsInfo(Base):
    """arrears_info 테이블 모델 (참고용, 실제로는 ArrearsInfoMart 사용)"""
    __tablename__ = "arrears_info"
    __table_args__ = {'schema': None}
    
    car_plate_number = Column(String(20), primary_key=True, index=True)
    arrears_user_id = Column(String(64))
    total_arrears_amount = Column(Integer)
    arrears_period = Column(String(50))
    notice_sent = Column(Integer)  # tinyint(1)
    updated_at = Column(DateTime)

