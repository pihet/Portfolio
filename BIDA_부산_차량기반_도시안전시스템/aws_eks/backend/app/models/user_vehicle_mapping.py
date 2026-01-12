"""
사용자-차량 매핑 테이블 (web DB)
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class UserVehicleMapping(Base):
    """사용자와 차량의 매핑 테이블"""
    __tablename__ = "user_vehicle_mapping"
    
    car_plate_number = Column(String(20), primary_key=True)  # PK - 번호판 (고유)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # FK → users.id
    car_id = Column(String(255), nullable=False, index=True)  # busan_car의 uservehicle.car_id
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계
    user = relationship("User", backref="vehicle_mappings")

