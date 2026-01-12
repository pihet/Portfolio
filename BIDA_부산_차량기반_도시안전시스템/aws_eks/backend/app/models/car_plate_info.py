from sqlalchemy import Column, String, Float, DateTime
from app.database import Base


class CarPlateInfo(Base):
    """car_plate_info 테이블 모델"""
    __tablename__ = "car_plate_info"
    
    crop_id = Column(String(64), primary_key=True, index=True)
    image_id = Column(String(64))
    latitude = Column(Float)
    longitude = Column(Float)
    crop_image_path = Column(String(500))
    car_plate_number = Column(String(20), index=True)
    dt = Column(DateTime)














