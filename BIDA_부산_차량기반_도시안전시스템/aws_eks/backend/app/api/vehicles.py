from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import distinct, func
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db, get_web_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleType
from app.models.user_vehicle_mapping import UserVehicleMapping
from app.models.vehicle_master import VehicleMaster
from app.models.driving_session import DrivingSession

router = APIRouter()


class VehicleRegisterRequest(BaseModel):
    license_plate: str  # 번호판 (예: 12가3456)
    vehicle_type: str = "PRIVATE"  # PRIVATE, TAXI, RENTAL


class VehicleRegisterResponse(BaseModel):
    id: int
    license_plate: str
    vehicle_type: str
    car_id: Optional[str] = None  # 매핑된 car_id
    message: str


@router.post("/register", response_model=VehicleRegisterResponse)
async def register_vehicle(
    request: VehicleRegisterRequest,
    current_user: User = Depends(get_current_active_user),
    web_db: Session = Depends(get_web_db)
):
    """
    번호판으로 차량 등록
    vehicles 테이블에 차량 정보 저장하고, web DB의 r_vehicle_master에서 임의의 car_id와 매핑
    """
    license_plate = request.license_plate.strip()
    
    # 1. 이미 등록된 번호판인지 확인 (현재 사용자 중에서)
    existing_vehicle = web_db.query(Vehicle).filter(
        Vehicle.user_id == current_user.id,
        Vehicle.license_plate == license_plate
    ).first()
    
    if existing_vehicle:
        raise HTTPException(
            status_code=400,
            detail="이미 등록된 번호판입니다."
        )
    
    # 2. vehicle_type 검증
    try:
        vehicle_type = VehicleType(request.vehicle_type.upper())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"유효하지 않은 차량 유형입니다. PRIVATE, TAXI, RENTAL 중 하나를 선택하세요."
        )
    
    # 3. web DB의 r_vehicle_master에서 주행 데이터가 있는 임의의 car_id 선택
    import random
    
    car_id = None
    
    # 특정 이메일(0@naver.com)로 로그인한 사용자는 특정 car_id로 고정 매칭
    if current_user.email == "0@naver.com":
        car_id = "1224749808"
    else:
        # r_vehicle_master에서 주행 세션이 있는 car_id 목록 조회
        vehicles_with_sessions = web_db.query(
            VehicleMaster.car_id
        ).join(
            DrivingSession,
            VehicleMaster.car_id == DrivingSession.car_id
        ).distinct().all()
        
        if vehicles_with_sessions:
            # 주행 데이터가 있는 car_id 중에서 임의로 선택
            selected = random.choice(vehicles_with_sessions)
            car_id = selected.car_id
        else:
            # 주행 데이터가 없으면 r_vehicle_master에서 임의의 car_id 선택
            all_vehicles = web_db.query(VehicleMaster.car_id).all()
            if all_vehicles:
                selected = random.choice(all_vehicles)
                car_id = selected.car_id
    
    if not car_id:
        raise HTTPException(
            status_code=404,
            detail="등록 가능한 차량이 없습니다."
        )
    
    # 4. 선택한 car_id가 r_vehicle_master 테이블에 존재하는지 확인
    vehicle_check = web_db.query(VehicleMaster).filter(
        VehicleMaster.car_id == car_id
    ).first()
    
    if not vehicle_check:
        raise HTTPException(
            status_code=404,
            detail=f"차량 ID '{car_id}'를 찾을 수 없습니다."
        )
    
    # 5. vehicles 테이블에 저장 (car_id 포함)
    new_vehicle = Vehicle(
        user_id=current_user.id,
        license_plate=license_plate,
        car_id=car_id,
        vehicle_type=vehicle_type
    )
    web_db.add(new_vehicle)
    
    # 6. user_vehicle_mapping 테이블에도 저장
    existing_mapping = web_db.query(UserVehicleMapping).filter(
        UserVehicleMapping.car_plate_number == license_plate
    ).first()
    
    if not existing_mapping:
        new_mapping = UserVehicleMapping(
            car_plate_number=license_plate,
            user_id=current_user.id,
            car_id=car_id
        )
        web_db.add(new_mapping)
    
    web_db.commit()
    web_db.refresh(new_vehicle)
    
    return VehicleRegisterResponse(
        id=new_vehicle.id,
        license_plate=new_vehicle.license_plate,
        vehicle_type=new_vehicle.vehicle_type.value,
        car_id=new_vehicle.car_id,
        message=f"차량이 성공적으로 등록되었습니다. (매핑된 차량 ID: {car_id})"
    )


@router.get("", response_model=List[dict])
async def get_vehicles(
    current_user: User = Depends(get_current_active_user),
    web_db: Session = Depends(get_web_db)
):
    """사용자가 등록한 차량 목록 조회"""
    # vehicles 테이블에서 사용자의 차량 가져오기
    vehicles = web_db.query(Vehicle).filter(
        Vehicle.user_id == current_user.id
    ).all()
    
    if not vehicles:
        return []
    
    vehicles_info = []
    for vehicle in vehicles:
        vehicles_info.append({
            "id": vehicle.id,
            "licensePlate": vehicle.license_plate,
            "vehicleType": vehicle.vehicle_type.value,
            "carId": vehicle.car_id,  # car_id 추가
            "createdAt": vehicle.created_at.isoformat() if vehicle.created_at else None
        })
    
    return vehicles_info


@router.get("/available-car-ids", response_model=List[dict])
async def get_available_car_ids(
    current_user: User = Depends(get_current_active_user),
    web_db: Session = Depends(get_web_db)
):
    """등록 가능한 car_id 목록 조회 (사용자가 선택할 수 있도록)"""
    # 주행 데이터가 있는 car_id만 조회
    vehicles_with_sessions = web_db.query(
        VehicleMaster.car_id,
        VehicleMaster.user_car_brand,
        VehicleMaster.user_car_model,
        VehicleMaster.user_car_year,
        func.count(DrivingSession.session_id).label('session_count')
    ).join(
        DrivingSession,
        VehicleMaster.car_id == DrivingSession.car_id
    ).group_by(
        VehicleMaster.car_id,
        VehicleMaster.user_car_brand,
        VehicleMaster.user_car_model,
        VehicleMaster.user_car_year
    ).order_by(
        func.count(DrivingSession.session_id).desc()
    ).limit(100).all()
    
    return [{
        "carId": v.car_id,
        "brand": v.user_car_brand,
        "model": v.user_car_model,
        "year": v.user_car_year,
        "sessionCount": v.session_count
    } for v in vehicles_with_sessions]


@router.delete("/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_active_user),
    web_db: Session = Depends(get_web_db)
):
    """등록된 차량 삭제"""
    vehicle = web_db.query(Vehicle).filter(
        Vehicle.id == vehicle_id,
        Vehicle.user_id == current_user.id
    ).first()
    
    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="등록된 차량을 찾을 수 없습니다."
        )
    
    # user_vehicle_mapping 테이블에서도 삭제
    license_plate = vehicle.license_plate
    mapping = web_db.query(UserVehicleMapping).filter(
        UserVehicleMapping.car_plate_number == license_plate
    ).first()
    
    if mapping:
        web_db.delete(mapping)
    
    # vehicles 테이블에서 삭제
    web_db.delete(vehicle)
    web_db.commit()
    
    return {"message": "차량이 삭제되었습니다."}
