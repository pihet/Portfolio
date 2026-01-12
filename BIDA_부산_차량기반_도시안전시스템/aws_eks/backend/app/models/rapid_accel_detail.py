from sqlalchemy import Column, String, Integer, DateTime
from app.database import Base


class RapidAccelDetail(Base):
    """r_rapid_accel_detail 테이블 모델 (급가속/급감속 10분 단위 집계)"""
    __tablename__ = "r_rapid_accel_detail"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String(255), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    time_group = Column(String(10), nullable=False)
    dt_start = Column(DateTime, nullable=False)
    rapid_acc_sum = Column(Integer, default=0)
    rapid_deacc_sum = Column(Integer, default=0)
    rapid_count = Column(Integer, default=0)
    penalty = Column(Integer, default=0)

