"""
busan_car 데이터베이스 모델 (참고용, 더 이상 사용하지 않음)
현재는 web DB의 r_* 마트 테이블을 사용합니다.
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, distinct
from sqlalchemy.sql import func
from app.database import Base


class BusanCarDrivingSession(Base):
    """driving_session 테이블 모델 (읽기 전용)"""
    __tablename__ = "driving_session"
    __table_args__ = {'schema': None}  # 기본 스키마 사용
    
    session_id = Column(String(255), primary_key=True, index=True)
    car_id = Column(String(255), index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class BusanCarDrivingSessionInfo(Base):
    """driving_session_info 테이블 모델 (읽기 전용)"""
    __tablename__ = "driving_session_info"
    __table_args__ = {'schema': None}
    
    info_id = Column(String(36), primary_key=True, index=True)
    session_id = Column(String(255), index=True)
    app_lat = Column(Float)
    app_lon = Column(Float)
    app_prev_lat = Column(Float)
    app_prev_lon = Column(Float)
    voltage = Column(Integer)
    d_door = Column(Integer)
    p_door = Column(Integer)
    rd_door = Column(Integer)
    rp_door = Column(Integer)
    t_door = Column(Integer)
    engine_status = Column(Integer)
    r_engine_status = Column(Integer)
    stt_alert = Column(Integer)
    el_status = Column(Integer)
    detect_shock = Column(Integer)
    remain_remote = Column(Integer)
    autodoor_use = Column(Integer)
    silence_mode = Column(Integer)
    low_voltage_alert = Column(Integer)
    low_voltage_engine = Column(Integer)
    temperature = Column(Integer)
    app_travel = Column(Integer)
    app_avg_speed = Column(Float)
    app_accel = Column(Float)
    app_gradient = Column(Float)
    app_rapid_acc = Column(Integer)
    app_rapid_deacc = Column(Integer)
    speed = Column(Float)
    createdDate = Column(DateTime)
    app_weather_status = Column(String(255))
    app_precipitation = Column(Float)
    dt = Column(DateTime)
    roadname = Column(String(50))
    treveltime = Column(Float)
    Hour = Column(Integer)


class BusanCarDrowsyDrive(Base):
    """drowsy_drive 테이블 모델 (읽기 전용)"""
    __tablename__ = "drowsy_drive"
    __table_args__ = {'schema': None}
    
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
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class BusanCarUserVehicle(Base):
    """uservehicle 테이블 모델 (읽기 전용)"""
    __tablename__ = "uservehicle"
    __table_args__ = {'schema': None}
    
    car_id = Column(String(255), primary_key=True, index=True)
    age = Column(Integer)
    user_sex = Column(String(10))
    user_location = Column(String(255))
    user_car_class = Column(String(255))
    user_car_brand = Column(String(255))
    user_car_year = Column(Integer)
    user_car_model = Column(String(255))
    user_car_weight = Column(Integer)
    user_car_displace = Column(Integer)
    user_car_efficiency = Column(String(255))
    updated_at = Column(DateTime)


class BusanCarPlateInfo(Base):
    """car_plate_info 테이블 모델 (읽기 전용)"""
    __tablename__ = "car_plate_info"
    __table_args__ = {'schema': None}
    
    crop_id = Column(String(64), primary_key=True, index=True)
    image_id = Column(String(64))
    latitude = Column(Float)
    longitude = Column(Float)
    crop_image_path = Column(String(500))
    car_plate_number = Column(String(20), index=True)
    dt = Column(DateTime)

