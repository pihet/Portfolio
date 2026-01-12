from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from app.database import Base


class SafetyScoreMonthly(Base):
    """r_safety_score_monthly 테이블 모델 (월별 안전운전 점수 집계)"""
    __tablename__ = "r_safety_score_monthly"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String(255), nullable=False, index=True)
    car_id = Column(String(255), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    safety_score = Column(Integer)
    total_penalty = Column(Integer, default=0)
    drowsy_penalty = Column(Integer, default=0)
    rapid_penalty = Column(Integer, default=0)
    gaze_closure_count = Column(Integer, default=0)
    head_drop_count = Column(Integer, default=0)
    yawn_flag_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

