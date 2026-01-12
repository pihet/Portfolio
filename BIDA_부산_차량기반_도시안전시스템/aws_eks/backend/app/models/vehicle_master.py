from sqlalchemy import Column, String, Integer
from app.database import Base


class VehicleMaster(Base):
    """r_vehicle_master 테이블 모델 (실제 사용되는 컬럼만)"""
    __tablename__ = "r_vehicle_master"
    
    car_id = Column(String(255), primary_key=True, index=True)
    age = Column(Integer, index=True)
    user_sex = Column(String(10), index=True)
    user_location = Column(String(255), index=True)
    user_car_brand = Column(String(255))
    user_car_year = Column(Integer)
    user_car_model = Column(String(255))

