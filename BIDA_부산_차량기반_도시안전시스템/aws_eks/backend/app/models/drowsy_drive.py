from sqlalchemy import Column, String, Integer, Float, DateTime
from app.database import Base


class DrowsyDrive(Base):
    """r_drowsy_drive 테이블 모델"""
    __tablename__ = "r_drowsy_drive"
    
    drowsy_id = Column(String(64), primary_key=True, index=True)
    session_id = Column(String(64), index=True)
    detected_lat = Column(Float)
    detected_lon = Column(Float)
    detected_at = Column(DateTime)
    duration_sec = Column(Integer)
    gaze_closure = Column(Integer)
    head_drop = Column(Integer)
    yawn_flag = Column(Integer)
    abnormal_flag = Column(Integer)














