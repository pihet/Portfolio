"""
차량 모델 (web DB)
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class VehicleType(str, enum.Enum):
    PRIVATE = "PRIVATE"
    TAXI = "TAXI"
    RENTAL = "RENTAL"


class Vehicle(Base):
    """차량 테이블 모델"""
    __tablename__ = "vehicles"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    license_plate = Column(String(20), unique=True, nullable=False, index=True)
    car_id = Column(String(255), nullable=True, index=True)  # busan_car DB의 uservehicle.car_id
    vehicle_type = Column(Enum(VehicleType), nullable=False)
    created_at = Column(DateTime, server_default=func.current_timestamp())
    updated_at = Column(DateTime, onupdate=func.current_timestamp())
    
    # 관계
    user = relationship("User", backref="vehicles")

