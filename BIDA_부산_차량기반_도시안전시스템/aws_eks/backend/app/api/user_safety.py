"""
일반 사용자 안전운전 점수 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, extract
from typing import List, Optional
from datetime import datetime
from app.database import get_web_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.driving_session import DrivingSession
from app.models.driving_session_info import DrivingSessionInfo
from app.models.drowsy_drive import DrowsyDrive
from app.models.rapid_accel_detail import RapidAccelDetail
from app.models.safety_score_monthly import SafetyScoreMonthly

router = APIRouter()


def calculate_drowsy_penalty(duration_sec: int) -> int:
    """
    졸음운전 감점 계산
    - 4초당 1점씩 감점
    - 예: 4초 = 1점, 8초 = 2점, 12초 = 3점, 16초 = 4점
    """
    if duration_sec < 4:
        return 0
    # 4초 단위로 나눈 몫이 감점 (소수점 버림)
    return duration_sec // 4


def calculate_rapid_penalty(total_count: int) -> int:
    """
    급가속/급감속 감점 계산
    - 총계가 1 이상이면 감점 1점 누적
    - 총합 7번이면 감점 7점
    """
    if total_count < 1:
        return 0
    return total_count  # 1 이상부터 1점씩 누적


@router.get("/safety-score/monthly", response_model=List[dict])
async def get_monthly_safety_scores(
    year: int = Query(..., description="연도"),
    month: int = Query(..., description="월 (1-12)"),
    current_user: User = Depends(get_current_active_user),
    web_db: Session = Depends(get_web_db)
):
    """
    월별 안전운전 점수 조회 (session_id별)
    기존 busan_car DB 로직과 동일하게 실제 계산 수행
    """
    if current_user.role.value != "GENERAL":
        raise HTTPException(status_code=403, detail="일반 사용자만 접근 가능합니다")
    
    # 사용자의 차량 조회 (vehicles 테이블에서)
    user_vehicles = web_db.query(Vehicle).filter(
        Vehicle.user_id == current_user.id
    ).all()
    
    if not user_vehicles:
        return []
    
    # vehicles 테이블에서 car_id 추출
    car_ids = [v.car_id for v in user_vehicles if v.car_id]
    
    if not car_ids:
        return []
    
    # car_id와 license_plate 매핑 딕셔너리 생성
    car_id_to_plate = {v.car_id: v.license_plate for v in user_vehicles if v.car_id}
    
    # 해당 월에 해당하는 세션 조회
    month_start = datetime(year, month, 1)
    if month == 12:
        month_end = datetime(year + 1, 1, 1)
    else:
        month_end = datetime(year, month + 1, 1)
    
    sessions = web_db.query(DrivingSession).filter(
        DrivingSession.car_id.in_(car_ids),
        DrivingSession.start_time >= month_start,
        DrivingSession.start_time < month_end
    ).all()
    
    results = []
    for session in sessions:
        session_id = session.session_id
        car_id = session.car_id
        license_plate = car_id_to_plate.get(car_id, "Unknown")
        
        # 졸음운전 데이터 조회
        drowsy_records = web_db.query(DrowsyDrive).filter(
            DrowsyDrive.session_id == session_id,
            DrowsyDrive.detected_at.isnot(None)
        ).all()
        
        # 졸음운전 감점 계산
        drowsy_penalty = 0
        gaze_closure_count = 0
        head_drop_count = 0
        yawn_flag_count = 0
        
        for drowsy in drowsy_records:
            penalty = calculate_drowsy_penalty(drowsy.duration_sec or 0)
            drowsy_penalty += penalty
            gaze_closure_count += int(drowsy.gaze_closure or 0)
            head_drop_count += int(drowsy.head_drop or 0)
            yawn_flag_count += int(drowsy.yawn_flag or 0)
        
        # 급가속/급감속 데이터 조회 (driving_session_info에서 직접 조회하여 10분 단위로 그룹화)
        rapid_infos = web_db.query(DrivingSessionInfo).filter(
            DrivingSessionInfo.session_id == session_id,
            DrivingSessionInfo.dt.isnot(None)
        ).order_by(DrivingSessionInfo.dt).all()
        
        # 10분 단위로 그룹화하여 급가속/급감속 합계 계산
        rapid_penalty = 0
        if rapid_infos:
            current_10min_group = None
            current_group_acc_sum = 0
            current_group_deacc_sum = 0
            
            for info in rapid_infos:
                if info.dt:
                    # 10분 단위로 그룹화 (분을 10으로 나눈 몫)
                    minute_group = info.dt.minute // 10
                    group_key = (
                        info.dt.year,
                        info.dt.month,
                        info.dt.day,
                        info.dt.hour,
                        minute_group
                    )
                    
                    if current_10min_group != group_key:
                        # 새로운 10분 그룹 시작
                        if current_10min_group is not None:
                            # 이전 그룹의 총합(급가속 + 급감속)을 총 감점에 추가
                            group_total = current_group_acc_sum + current_group_deacc_sum
                            rapid_penalty += group_total
                        current_10min_group = group_key
                        current_group_acc_sum = 0
                        current_group_deacc_sum = 0
                    
                    # 급가속/급감속 합계 계산 (각 10분 그룹 내에서 실제 값의 합계)
                    current_group_acc_sum += int(info.app_rapid_acc or 0)
                    current_group_deacc_sum += int(info.app_rapid_deacc or 0)
            
            # 마지막 그룹의 총합을 총 감점에 추가
            if current_10min_group is not None:
                group_total = current_group_acc_sum + current_group_deacc_sum
                rapid_penalty += group_total
        
        # 총 감점
        total_penalty = int(drowsy_penalty) + int(rapid_penalty)
        
        # 안전 점수
        score = 100 - total_penalty
        safety_score = int(max(0, round(score, 0)))
        
        results.append({
            "sessionId": session_id,
            "carId": car_id,
            "licensePlate": license_plate,
            "startTime": session.start_time.isoformat() if session.start_time else None,
            "endTime": session.end_time.isoformat() if session.end_time else None,
            "safetyScore": safety_score,
            "totalPenalty": total_penalty,
            "drowsyPenalty": int(drowsy_penalty),
            "rapidPenalty": int(rapid_penalty),
            "gazeClosureCount": gaze_closure_count,
            "headDropCount": head_drop_count,
            "yawnFlagCount": yawn_flag_count
        })
    
    return results


@router.get("/safety-score/session/{session_id}", response_model=dict)
async def get_session_safety_detail(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    web_db: Session = Depends(get_web_db)
):
    """
    세션별 안전운전 점수 상세 조회
    """
    if current_user.role.value != "GENERAL":
        raise HTTPException(status_code=403, detail="일반 사용자만 접근 가능합니다")
    
    # 세션 조회
    session = web_db.query(DrivingSession).filter(
        DrivingSession.session_id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    
    car_id = session.car_id
    
    # 사용자의 차량인지 확인
    user_vehicle = web_db.query(Vehicle).filter(
        Vehicle.user_id == current_user.id,
        Vehicle.car_id == car_id
    ).first()
    
    if not user_vehicle:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    license_plate = user_vehicle.license_plate
    
    # 졸음운전 데이터 조회
    drowsy_records = web_db.query(DrowsyDrive).filter(
        DrowsyDrive.session_id == session_id,
        DrowsyDrive.detected_at.isnot(None)
    ).all()
    
    # 졸음운전 감점 계산 및 상세 정보 생성
    drowsy_penalty = 0
    gaze_closure_count = 0
    head_drop_count = 0
    yawn_flag_count = 0
    drowsy_details = []
    
    for drowsy in drowsy_records:
        penalty = calculate_drowsy_penalty(drowsy.duration_sec or 0)
        drowsy_penalty += penalty
        gaze_closure_count += int(drowsy.gaze_closure or 0)
        head_drop_count += int(drowsy.head_drop or 0)
        yawn_flag_count += int(drowsy.yawn_flag or 0)
        
        drowsy_details.append({
            "drowsyId": drowsy.drowsy_id,
            "detectedAt": drowsy.detected_at.isoformat() if drowsy.detected_at else None,
            "durationSec": drowsy.duration_sec,
            "penalty": penalty,
            "gazeClosure": drowsy.gaze_closure,
            "headDrop": drowsy.head_drop,
            "yawnFlag": drowsy.yawn_flag
        })
    
    # 급가속/급감속 상세 데이터 조회 (r_driving_session_info에서 직접 조회하여 10분 단위로 그룹화)
    # 기존 busan_car DB 로직과 동일하게 구현
    rapid_infos = web_db.query(DrivingSessionInfo).filter(
        DrivingSessionInfo.session_id == session_id,
        DrivingSessionInfo.dt.isnot(None)
    ).order_by(DrivingSessionInfo.dt).all()
    
    # 10분 단위로 그룹화하여 급가속/급감속 합계 계산
    rapid_details = []
    rapid_penalty = 0
    
    if rapid_infos:
        current_10min_group = None
        current_group_acc_sum = 0  # 현재 그룹의 급가속 합계
        current_group_deacc_sum = 0  # 현재 그룹의 급감속 합계
        current_group_dt_start = None  # 그룹의 시작 시간
        
        for info in rapid_infos:
            if info.dt:
                # 10분 단위로 그룹화 (분을 10으로 나눈 몫)
                minute_group = info.dt.minute // 10
                group_key = (
                    info.dt.year,
                    info.dt.month,
                    info.dt.day,
                    info.dt.hour,
                    minute_group
                )
                
                if current_10min_group != group_key:
                    # 새로운 10분 그룹 시작
                    if current_10min_group is not None:
                        # 이전 그룹의 총합(급가속 + 급감속)을 총 감점에 추가
                        group_total = current_group_acc_sum + current_group_deacc_sum
                        rapid_penalty += group_total
                        
                        # 이전 그룹의 상세 정보 추가
                        # time_group 형식: "HHMM-HHMM" (예: "0900-0910")
                        start_hour = current_group_dt_start.hour
                        start_min = (current_group_dt_start.minute // 10) * 10
                        end_min = start_min + 10
                        time_group_str = f"{start_hour:02d}{start_min:02d}-{start_hour:02d}{end_min:02d}" if end_min < 60 else f"{start_hour:02d}{start_min:02d}-{(start_hour+1):02d}00"
                        rapid_details.append({
                            "timeGroup": time_group_str,
                            "rapidCount": current_group_acc_sum + current_group_deacc_sum,
                            "penalty": group_total
                        })
                    
                    current_10min_group = group_key
                    current_group_acc_sum = 0
                    current_group_deacc_sum = 0
                    current_group_dt_start = info.dt
                
                # 급가속/급감속 합계 계산 (각 10분 그룹 내에서 실제 값의 합계)
                current_group_acc_sum += int(info.app_rapid_acc or 0)
                current_group_deacc_sum += int(info.app_rapid_deacc or 0)
        
        # 마지막 그룹의 총합을 총 감점에 추가
        if current_10min_group is not None:
            group_total = current_group_acc_sum + current_group_deacc_sum
            rapid_penalty += group_total
            
            # 마지막 그룹의 상세 정보 추가
            # time_group 형식: "HHMM-HHMM" (예: "0900-0910")
            start_hour = current_group_dt_start.hour
            start_min = (current_group_dt_start.minute // 10) * 10
            end_min = start_min + 10
            time_group_str = f"{start_hour:02d}{start_min:02d}-{start_hour:02d}{end_min:02d}" if end_min < 60 else f"{start_hour:02d}{start_min:02d}-{(start_hour+1):02d}00"
            rapid_details.append({
                "timeGroup": time_group_str,
                "rapidCount": current_group_acc_sum + current_group_deacc_sum,
                "penalty": group_total
            })
    
    # 총 감점
    total_penalty = int(drowsy_penalty) + int(rapid_penalty)
    
    # 안전 점수
    score = 100 - total_penalty
    safety_score = int(max(0, round(score, 0)))
    
    return {
        "sessionId": session_id,
        "carId": session.car_id,
        "licensePlate": license_plate,
        "startTime": session.start_time.isoformat() if session.start_time else None,
        "endTime": session.end_time.isoformat() if session.end_time else None,
        "safetyScore": safety_score,
        "totalPenalty": int(total_penalty),
        "drowsyPenalty": int(drowsy_penalty),
        "rapidPenalty": int(rapid_penalty),
        "gazeClosureCount": int(gaze_closure_count),
        "headDropCount": int(head_drop_count),
        "yawnFlagCount": int(yawn_flag_count),
        "drowsyDetails": drowsy_details,
        "rapidDetails": rapid_details
    }

