from sqlalchemy import Column, String, DateTime
from app.database import Base


class DrivingSession(Base):
    """r_driving_session 테이블 모델"""
    __tablename__ = "r_driving_session"
    
    session_id = Column(String(255), primary_key=True, index=True)
    car_id = Column(String(255), index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)














