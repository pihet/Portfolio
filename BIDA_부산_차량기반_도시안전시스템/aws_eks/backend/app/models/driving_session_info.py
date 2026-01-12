from sqlalchemy import Column, String, Integer, DateTime
from app.database import Base


class DrivingSessionInfo(Base):
    """r_driving_session_info 테이블 모델 (실제 사용되는 컬럼만)"""
    __tablename__ = "r_driving_session_info"
    
    info_id = Column(String(36), primary_key=True, index=True)
    session_id = Column(String(255), index=True)
    dt = Column(DateTime, index=True)
    app_rapid_acc = Column(Integer)
    app_rapid_deacc = Column(Integer)
    app_travel = Column(Integer)
    Hour = Column(Integer)














