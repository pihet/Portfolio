from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, or_, extract, text
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from app.database import get_web_db
from app.api.deps import require_busan_admin
from app.models.user import User
from app.models.missing_person_detection import MissingPersonDetectionMart
from app.models.missing_person_info_mart import MissingPersonInfoMart
from app.models.arrears_detection import ArrearsDetectionMart
from app.models.arrears_info_mart import ArrearsInfoMart
from app.models.missing_person_detection_modification import MissingPersonDetectionModification
from app.models.arrears_detection_modification import ArrearsDetectionModification
from app.models.driving_session import DrivingSession
from app.models.driving_session_info import DrivingSessionInfo
from app.models.drowsy_drive import DrowsyDrive
from app.models.vehicle_master import VehicleMaster

router = APIRouter()


@router.get("/missing-person", response_model=List[dict])
async def get_missing_person_detections(
    missing_id: Optional[str] = Query(None, description="실종자 ID로 필터링"),
    current_user: User = Depends(require_busan_admin),
    web_db: Session = Depends(get_web_db)
):
    """실종자 탐지 조회 (r_missing_person_detection_mart 테이블)"""
    query = web_db.query(MissingPersonDetectionMart)
    
    if missing_id:
        query = query.filter(MissingPersonDetectionMart.missing_id == missing_id)
    
    detections = query.order_by(MissingPersonDetectionMart.detected_time.desc()).all()
    
    return [{
        "detectionId": d.detection_id,
        "imageId": d.image_id,
        "missingId": d.missing_id,
        "detectionSuccess": bool(d.detection_success),
        "detectedLat": d.detected_lat,
        "detectedLon": d.detected_lon,
        "detectedTime": d.detected_time.isoformat() if d.detected_time else None
    } for d in detections]


@router.get("/missing-person/stats", response_model=dict)
async def get_missing_person_stats(
    current_user: User = Depends(require_busan_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    실종자 통계 조회 (부산시청 관리자용)
    - 이번달 실종 신고 수 (r_missing_person_detection_mart에서 DISTINCT missing_id 기준)
    - 이번달 실종자 탐지 수 (r_missing_person_detection_mart에서 detection_success = 1)
    - 해결률 (해결완료 수 / 신고 수 * 100)
    """
    now = datetime.now()
    month_start = datetime(now.year, now.month, 1, 0, 0, 0)
    if now.month == 12:
        month_end = datetime(now.year + 1, 1, 1, 0, 0, 0)
    else:
        month_end = datetime(now.year, now.month + 1, 1, 0, 0, 0)
    
    # 이번달 실종 신고 수 (r_missing_person_info_mart의 registered_at 기준)
    # 테이블 존재 여부 확인 후 사용
    try:
        # 테이블 존재 여부 확인
        web_db.execute(text("SELECT 1 FROM r_missing_person_info_mart LIMIT 1"))
        monthly_reports = web_db.query(func.count(MissingPersonInfoMart.missing_id)).filter(
            MissingPersonInfoMart.registered_at >= month_start,
            MissingPersonInfoMart.registered_at < month_end
        ).scalar() or 0
    except:
        # r_missing_person_info_mart가 없으면 detected_time 기준으로 계산 (fallback)
        monthly_reports = web_db.query(func.count(func.distinct(MissingPersonDetectionMart.missing_id))).filter(
            MissingPersonDetectionMart.detected_time >= month_start,
            MissingPersonDetectionMart.detected_time < month_end
        ).scalar() or 0
    
    # 이번달 실종자 탐지 수 (r_missing_person_detection_mart에서 detection_success = 1인 것만)
    monthly_found = web_db.query(func.count(MissingPersonDetectionMart.detection_id)).filter(
        MissingPersonDetectionMart.detected_time >= month_start,
        MissingPersonDetectionMart.detected_time < month_end,
        MissingPersonDetectionMart.detection_success == 1
    ).scalar() or 0
    
    # 해결완료 수 (web DB에서 is_resolved = True인 것)
    resolved_count = web_db.query(func.count(MissingPersonDetectionModification.id)).filter(
        MissingPersonDetectionModification.is_resolved == True,
        MissingPersonDetectionModification.resolved_at >= month_start,
        MissingPersonDetectionModification.resolved_at < month_end
    ).scalar() or 0
    
    # 해결률 계산 (해결완료 수 / 신고 수 * 100)
    resolution_rate = 0
    if monthly_reports > 0:
        resolution_rate = round((resolved_count / monthly_reports) * 100, 1)
    
    # 월별 추이 (최근 7개월)
    monthly_trend = []
    month_list = []
    for i in range(6, -1, -1):  # 6개월 전부터 현재까지
        target_year = now.year
        target_month = now.month - i
        while target_month <= 0:
            target_month += 12
            target_year -= 1
        while target_month > 12:
            target_month -= 12
            target_year += 1
        month_list.append((target_year, target_month))
    
    for year, month in month_list:
        month_start = datetime(year, month, 1, 0, 0, 0)
        if month == 12:
            month_end = datetime(year + 1, 1, 1, 0, 0, 0)
        else:
            month_end = datetime(year, month + 1, 1, 0, 0, 0)
        
        # 해당 월의 실종 신고 수 (r_missing_person_info_mart의 registered_at 기준)
        try:
            web_db.execute(text("SELECT 1 FROM r_missing_person_info_mart LIMIT 1"))
            month_reports = web_db.query(func.count(MissingPersonInfoMart.missing_id)).filter(
                MissingPersonInfoMart.registered_at >= month_start,
                MissingPersonInfoMart.registered_at < month_end
            ).scalar() or 0
        except:
            # r_missing_person_info_mart가 없으면 detected_time 기준으로 계산 (fallback)
            month_reports = web_db.query(func.count(func.distinct(MissingPersonDetectionMart.missing_id))).filter(
                MissingPersonDetectionMart.detected_time >= month_start,
                MissingPersonDetectionMart.detected_time < month_end
            ).scalar() or 0
        
        # 해당 월의 실종자 탐지 수 (detection_success = 1인 것만)
        month_found = web_db.query(func.count(MissingPersonDetectionMart.detection_id)).filter(
            MissingPersonDetectionMart.detected_time >= month_start,
            MissingPersonDetectionMart.detected_time < month_end,
            MissingPersonDetectionMart.detection_success == 1
        ).scalar() or 0
        
        # 해당 월의 해결완료 수
        month_resolved = web_db.query(func.count(MissingPersonDetectionModification.id)).filter(
            MissingPersonDetectionModification.is_resolved == True,
            MissingPersonDetectionModification.resolved_at >= month_start,
            MissingPersonDetectionModification.resolved_at < month_end
        ).scalar() or 0
        
        # 해결률 계산
        month_resolution_rate = 0
        if month_reports > 0:
            month_resolution_rate = round((month_resolved / month_reports) * 100, 1)
        
        monthly_trend.append({
            "month": f"{year}-{month:02d}",
            "reports": month_reports,
            "found": month_found,
            "resolved": month_resolved,
            "resolutionRate": month_resolution_rate
        })
    
    return {
        "monthlyReports": monthly_reports,
        "monthlyFound": monthly_found,
        "resolutionRate": resolution_rate,
        "resolvedCount": resolved_count,
        "monthlyTrend": monthly_trend
    }


@router.get("/arrears", response_model=List[dict])
async def get_arrears_detections(
    car_plate_number: Optional[str] = Query(None, description="차량 번호로 필터링"),
    current_user: User = Depends(require_busan_admin),
    web_db: Session = Depends(get_web_db)
):
    """체납 차량 탐지 조회 (r_arrears_detection_mart 테이블)"""
    query = web_db.query(ArrearsDetectionMart)
    
    if car_plate_number:
        query = query.filter(ArrearsDetectionMart.car_plate_number == car_plate_number)
    
    detections = query.order_by(ArrearsDetectionMart.detected_time.desc()).all()
    
    return [{
        "detectionId": d.detection_id,
        "carPlateNumber": d.car_plate_number,
        "imageId": d.image_id,
        "detectionSuccess": bool(d.detection_success),
        "detectedLat": d.detected_lat,
        "detectedLon": d.detected_lon,
        "detectedTime": d.detected_time.isoformat() if d.detected_time else None
    } for d in detections]


@router.get("/missing-person/detections/today", response_model=List[dict])
async def get_today_missing_person_detections(
    current_user: User = Depends(require_busan_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    오늘 탐지된 실종자 목록 조회 (부산시청 관리자용)
    r_missing_person_detection_mart 사용 (반정규화되어 실종자 정보 포함)
    """
    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59)
    
    # 오늘 탐지된 실종자 조회 (r_missing_person_detection_mart)
    detections = web_db.query(MissingPersonDetectionMart).filter(
        MissingPersonDetectionMart.detected_time >= today_start,
        MissingPersonDetectionMart.detected_time <= today_end
    ).order_by(MissingPersonDetectionMart.detected_time.desc()).all()
    
    result = []
    for detection in detections:
        # 위치 정보 생성
        location = "위치 정보 없음"
        if detection.detected_lat and detection.detected_lon:
            location = f"위도: {detection.detected_lat:.6f}, 경도: {detection.detected_lon:.6f}"
        
        result.append({
            "detectionId": detection.detection_id,
            "missingId": detection.missing_id or "알 수 없음",
            "missingName": detection.missing_name or "알 수 없음",
            "missingAge": detection.missing_age,
            "detectedLat": detection.detected_lat,
            "detectedLon": detection.detected_lon,
            "detectedTime": detection.detected_time.isoformat() if detection.detected_time else None,
            "location": location,
            "detectionSuccess": bool(detection.detection_success) if detection.detection_success is not None else None
        })
    
    return result


@router.get("/arrears/detections/today", response_model=List[dict])
async def get_today_arrears_detections(
    current_user: User = Depends(require_busan_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    오늘 탐지된 체납 차량 목록 조회 (부산시청 관리자용)
    r_arrears_detection_mart 사용 (반정규화되어 체납 정보 포함)
    """
    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59)
    
    # 오늘 탐지된 체납 차량 조회 (r_arrears_detection_mart)
    detections = web_db.query(ArrearsDetectionMart).filter(
        ArrearsDetectionMart.detected_time >= today_start,
        ArrearsDetectionMart.detected_time <= today_end
    ).order_by(ArrearsDetectionMart.detected_time.desc()).all()
    
    result = []
    for detection in detections:
        # 위치 정보 생성
        location = "위치 정보 없음"
        if detection.detected_lat and detection.detected_lon:
            location = f"위도: {detection.detected_lat:.6f}, 경도: {detection.detected_lon:.6f}"
        
        result.append({
            "detectionId": detection.detection_id,
            "carPlateNumber": detection.car_plate_number or "알 수 없음",
            "detectedLat": detection.detected_lat,
            "detectedLon": detection.detected_lon,
            "detectedTime": detection.detected_time.isoformat() if detection.detected_time else None,
            "location": location,
            "detectionSuccess": bool(detection.detection_success) if detection.detection_success is not None else None,
            "totalArrearsAmount": detection.total_arrears_amount,
            "arrearsPeriod": detection.arrears_period,
            "noticeSent": bool(detection.notice_sent) if detection.notice_sent is not None else False
        })
    
    return result


@router.get("/arrears/stats", response_model=dict)
async def get_arrears_stats(
    current_user: User = Depends(require_busan_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    체납자 통계 조회 (부산시청 관리자용)
    - 오늘 탐지된 체납 차량 수
    - 월별 신규 체납자 추이 (최근 7개월)
    - 총 체납 금액 (r_arrears_detection_mart의 total_arrears_amount 합계)
    - 해결률 (해결완료 수 / 신규 체납자 수 * 100)
    """
    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59)
    
    # 오늘 탐지된 체납 차량 수
    today_detected = web_db.query(func.count(ArrearsDetectionMart.detection_id)).filter(
        ArrearsDetectionMart.detected_time >= today_start,
        ArrearsDetectionMart.detected_time <= today_end
    ).scalar() or 0
    
    # 총 체납 금액 (r_arrears_info_mart가 있으면 그걸 사용, 없으면 r_arrears_detection_mart에서 DISTINCT car_plate_number 기준)
    try:
        # 테이블 존재 여부 확인
        web_db.execute(text("SELECT 1 FROM r_arrears_info_mart LIMIT 1"))
        # r_arrears_info_mart 테이블이 있으면 모든 total_arrears_amount 합산
        total_amount = web_db.query(func.sum(ArrearsInfoMart.total_arrears_amount)).scalar() or 0
    except:
        # r_arrears_info_mart가 없으면 r_arrears_detection_mart에서 DISTINCT car_plate_number 기준으로 합산
        from sqlalchemy import select
        subquery = select(
            ArrearsDetectionMart.car_plate_number,
            func.max(ArrearsDetectionMart.total_arrears_amount).label('max_amount')
        ).group_by(ArrearsDetectionMart.car_plate_number).subquery()
        total_amount_result = web_db.query(func.sum(subquery.c.max_amount)).scalar()
        total_amount = int(total_amount_result) if total_amount_result else 0
    
    # 월별 추이 (최근 7개월) - 실종자 관리와 동일한 형식
    monthly_trend = []
    month_list = []
    for i in range(6, -1, -1):  # 6개월 전부터 현재까지
        target_year = now.year
        target_month = now.month - i
        
        # 월이 음수가 되면 이전 년도로 조정
        while target_month <= 0:
            target_month += 12
            target_year -= 1
        while target_month > 12:
            target_month -= 12
            target_year += 1
        
        month_list.append((target_year, target_month))
    
    for year, month in month_list:
        month_start = datetime(year, month, 1, 0, 0, 0)
        if month == 12:
            month_end = datetime(year + 1, 1, 1, 0, 0, 0)
        else:
            month_end = datetime(year, month + 1, 1, 0, 0, 0)
        
        # 해당 월의 신규 체납자 수 (arrears_period의 시작 월 기준)
        # arrears_period 형식: "2025.09~2025.12" 또는 "2025.09"
        month_str = f"{year}.{month:02d}"
        # r_arrears_info_mart가 있으면 그걸 사용, 없으면 r_arrears_detection_mart 사용
        try:
            # 테이블 존재 여부 확인
            web_db.execute(text("SELECT 1 FROM r_arrears_info_mart LIMIT 1"))
            result = web_db.execute(text("""
                SELECT COUNT(*) as cnt
                FROM r_arrears_info_mart 
                WHERE SUBSTRING_INDEX(arrears_period, '~', 1) = :month_str
            """), {"month_str": month_str})
            month_new_arrears = result.scalar() or 0
        except:
            # r_arrears_info_mart가 없으면 r_arrears_detection_mart 사용
            result = web_db.execute(text("""
                SELECT COUNT(DISTINCT car_plate_number) as cnt
                FROM r_arrears_detection_mart 
                WHERE SUBSTRING_INDEX(arrears_period, '~', 1) = :month_str
            """), {"month_str": month_str})
            month_new_arrears = result.scalar() or 0
        
        # 해당 월의 탐지 건수 (r_arrears_detection_mart의 detected_time 기준, 모든 탐지 건수)
        month_detected = web_db.query(func.count(ArrearsDetectionMart.detection_id)).filter(
            ArrearsDetectionMart.detected_time >= month_start,
            ArrearsDetectionMart.detected_time < month_end
        ).scalar() or 0
        
        # 해당 월의 해결완료 수 (arrears_detection_modifications의 is_resolved = True, resolved_at 기준)
        month_resolved = web_db.query(func.count(ArrearsDetectionModification.id)).filter(
            ArrearsDetectionModification.is_resolved == True,
            ArrearsDetectionModification.resolved_at >= month_start,
            ArrearsDetectionModification.resolved_at < month_end
        ).scalar() or 0
        
        # 해결률 계산 (해결완료 수 / 신규 체납자 수 * 100)
        month_resolution_rate = 0
        if month_new_arrears > 0:
            month_resolution_rate = round((month_resolved / month_new_arrears) * 100, 1)
        
        monthly_trend.append({
            "month": f"{year}-{month:02d}",
            "newArrears": month_new_arrears,
            "detected": month_detected,
            "resolved": month_resolved,
            "resolutionRate": month_resolution_rate
        })
    
    # 이번달 해결완료 수 (web DB에서 is_resolved = True인 것)
    month_start = datetime(now.year, now.month, 1, 0, 0, 0)
    if now.month == 12:
        month_end = datetime(now.year + 1, 1, 1, 0, 0, 0)
    else:
        month_end = datetime(now.year, now.month + 1, 1, 0, 0, 0)
    
    resolved_count = web_db.query(func.count(ArrearsDetectionModification.id)).filter(
        ArrearsDetectionModification.is_resolved == True,
        ArrearsDetectionModification.resolved_at >= month_start,
        ArrearsDetectionModification.resolved_at < month_end
    ).scalar() or 0
    
    # 이번달 신규 체납자 수 (arrears_period의 시작 월 기준)
    current_month_str = f"{now.year}.{now.month:02d}"
    try:
        # 테이블 존재 여부 확인
        web_db.execute(text("SELECT 1 FROM r_arrears_info_mart LIMIT 1"))
        # r_arrears_info_mart가 있으면 그걸 사용
        result = web_db.execute(text("""
            SELECT COUNT(*) as cnt
            FROM r_arrears_info_mart 
            WHERE SUBSTRING_INDEX(arrears_period, '~', 1) = :month_str
        """), {"month_str": current_month_str})
        monthly_new = result.scalar() or 0
    except:
        # r_arrears_info_mart가 없으면 r_arrears_detection_mart 사용
        result = web_db.execute(text("""
            SELECT COUNT(DISTINCT car_plate_number) as cnt
            FROM r_arrears_detection_mart 
            WHERE SUBSTRING_INDEX(arrears_period, '~', 1) = :month_str
        """), {"month_str": current_month_str})
        monthly_new = result.scalar() or 0
    
    # 해결률 계산 (해결완료 수 / 신규 체납자 수 * 100)
    resolution_rate = 0
    if monthly_new > 0:
        resolution_rate = round((resolved_count / monthly_new) * 100, 1)
    
    return {
        "todayDetected": today_detected,
        "totalAmount": int(total_amount),
        "monthlyTrend": monthly_trend,
        "monthlyNew": monthly_new,  # 이번달 신규 체납자 수
        "resolvedCount": resolved_count,
        "resolutionRate": resolution_rate
    }


@router.get("/drowsy-drive", response_model=List[dict])
async def get_drowsy_drive_detections(
    session_id: Optional[str] = Query(None, description="세션 ID로 필터링"),
    start_date: Optional[datetime] = Query(None, description="시작 날짜"),
    end_date: Optional[datetime] = Query(None, description="종료 날짜"),
    current_user: User = Depends(require_busan_admin),
    web_db: Session = Depends(get_web_db)
):
    """운전자 운전태도(졸음운전) 실시간 탐지 조회 (r_drowsy_drive 테이블)"""
    query = web_db.query(DrowsyDrive)
    
    if session_id:
        query = query.filter(DrowsyDrive.session_id == session_id)
    
    if start_date:
        query = query.filter(DrowsyDrive.detected_at >= start_date)
    
    if end_date:
        query = query.filter(DrowsyDrive.detected_at <= end_date)
    
    detections = query.order_by(DrowsyDrive.detected_at.desc()).all()
    
    return [{
        "drowsyId": d.drowsy_id,
        "sessionId": d.session_id,
        "detectedLat": d.detected_lat,
        "detectedLon": d.detected_lon,
        "detectedAt": d.detected_at.isoformat() if d.detected_at else None,
        "durationSec": d.duration_sec,
        "gazeClosure": d.gaze_closure,
        "headDrop": d.head_drop,
        "yawnFlag": d.yawn_flag,
        "abnormalFlag": d.abnormal_flag,
        "createdAt": d.created_at.isoformat() if d.created_at else None,
        "updatedAt": d.updated_at.isoformat() if d.updated_at else None
    } for d in detections]


# 안전운전관리 API 엔드포인트들
@router.get("/safe-driving/sample-car-ids", response_model=List[str])
async def get_sample_car_ids(
    limit: int = Query(10, description="샘플 개수"),
    web_db: Session = Depends(get_web_db)
):
    """실제 DB에 있는 car_id 샘플 조회 (디버깅용)"""
    car_ids = web_db.query(VehicleMaster.car_id).limit(limit).all()
    return [row.car_id for row in car_ids if row.car_id]


@router.get("/safe-driving/stats", response_model=dict)
async def get_safe_driving_stats(
    year: Optional[int] = Query(None, description="연도 (예: 2024), None이면 현재 연도"),
    month: Optional[int] = Query(None, description="월 (1-12), None이면 현재 월"),
    web_db: Session = Depends(get_web_db)
):
    """안전운전 주요 지표 조회 (주행 차량 수, 전체 안전운전율)"""
    now = datetime.now()
    target_month = month if month else now.month
    target_year = year if year else now.year
    
    # 현재 주행 중인 차량 수 (end_time이 NULL이거나 미래인 세션)
    active_sessions = web_db.query(DrivingSession).filter(
        or_(
DrivingSession.end_time.is_(None),
DrivingSession.end_time > now
        )
    ).count()
    
    # 해당 월의 전체 세션 수
    month_sessions = web_db.query(DrivingSession).filter(
        extract('year', DrivingSession.start_time) == target_year,
        extract('month', DrivingSession.start_time) == target_month
    ).count()
    
    # 해당 월의 안전운전 데이터 집계
    month_start = datetime(target_year, target_month, 1)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1)
    else:
        month_end = datetime(target_year, target_month + 1, 1)
    
    # 급가속, 급감속, 졸음운전 집계 (dt 기준)
    rapid_acc_count = web_db.query(func.count(DrivingSessionInfo.info_id)).join(
DrivingSession, DrivingSessionInfo.session_id == DrivingSession.session_id
    ).filter(
DrivingSession.start_time >= month_start,
DrivingSession.start_time < month_end,
DrivingSessionInfo.dt.isnot(None),
DrivingSessionInfo.app_rapid_acc > 0
    ).scalar() or 0
    
    rapid_deacc_count = web_db.query(func.count(DrivingSessionInfo.info_id)).join(
DrivingSession, DrivingSessionInfo.session_id == DrivingSession.session_id
    ).filter(
DrivingSession.start_time >= month_start,
DrivingSession.start_time < month_end,
DrivingSessionInfo.dt.isnot(None),
DrivingSessionInfo.app_rapid_deacc > 0
    ).scalar() or 0
    
    drowsy_count = web_db.query(func.count(DrowsyDrive.drowsy_id)).filter(
DrowsyDrive.detected_at >= month_start,
DrowsyDrive.detected_at < month_end,
DrowsyDrive.abnormal_flag > 0
    ).scalar() or 0
    
    # 전체 데이터 포인트 수 (실제 driving_session_info 레코드 수, dt 기준)
    total_data_points = web_db.query(func.count(DrivingSessionInfo.info_id)).join(
DrivingSession, DrivingSessionInfo.session_id == DrivingSession.session_id
    ).filter(
DrivingSession.start_time >= month_start,
DrivingSession.start_time < month_end,
DrivingSessionInfo.dt.isnot(None)
    ).scalar() or 1
    
    # 안전운전율 계산 (100 - (위험 행동 비율 * 100))
    # 위험 행동은 각각 독립적으로 발생할 수 있으므로 합산
    unsafe_ratio = (rapid_acc_count + rapid_deacc_count + drowsy_count) / total_data_points if total_data_points > 0 else 0
    safety_rate = max(0, min(100, (1 - unsafe_ratio) * 100))
    
    return {
        "activeVehicles": active_sessions,
        "totalSessions": month_sessions,
        "safetyRate": round(safety_rate, 2),
        "rapidAccelCount": rapid_acc_count,
        "rapidDecelCount": rapid_deacc_count,
        "drowsyCount": drowsy_count,
        "month": target_month,
        "year": target_year
    }


@router.get("/safe-driving/districts", response_model=List[dict])
async def get_district_safe_driving(
    month: Optional[int] = Query(None, description="월 (1-12), None이면 현재 월"),
    web_db: Session = Depends(get_web_db)
):
    """구별 안전운전 현황 조회"""
    now = datetime.now()
    target_month = month if month else now.month
    target_year = now.year
    
    month_start = datetime(target_year, target_month, 1)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1)
    else:
        month_end = datetime(target_year, target_month + 1, 1)
    
    # 구별 집계 (user_location에서 구 추출)
    # user_location 형식: "부산시 해운대구" 또는 "해운대구"
    # Python에서 구 추출 후 집계 (더 정확한 처리)
    
    # 먼저 모든 데이터를 가져와서 Python에서 처리 (dt 기준)
    district_data = web_db.query(
VehicleMaster.user_location,
DrivingSessionInfo.app_rapid_acc,
DrivingSessionInfo.app_rapid_deacc,
DrowsyDrive.abnormal_flag,
DrivingSession.session_id
    ).join(
DrivingSession, VehicleMaster.car_id == DrivingSession.car_id
    ).join(
DrivingSessionInfo, DrivingSession.session_id == DrivingSessionInfo.session_id
    ).outerjoin(
DrowsyDrive, DrivingSession.session_id == DrowsyDrive.session_id
    ).filter(
DrivingSession.start_time >= month_start,
DrivingSession.start_time < month_end,
DrivingSessionInfo.dt.isnot(None),
VehicleMaster.user_location.isnot(None),
VehicleMaster.user_location.like('%구%')
    ).all()
    
    # 구별로 집계
    district_dict = {}
    for row in district_data:
        # 구 추출 (user_location에서 "구"로 끝나는 부분 찾기)
        location = row.user_location or ""
        district = "기타"
        
        # "구"로 끝나는 부분 찾기
        if "구" in location:
            # 공백으로 분리 후 "구"가 포함된 부분 찾기
            parts = location.split()
            for part in parts:
                if "구" in part:
                    # "구" 앞부분 + "구" 추출
                    idx = part.find("구")
                    if idx >= 0:
                        district = part[:idx+1] if idx > 0 else part
                    break
            # 공백이 없으면 전체에서 "구" 찾기
            if district == "기타" and "구" in location:
                idx = location.find("구")
                if idx >= 0:
                    district = location[:idx+1] if idx > 0 else location
        
        if district not in district_dict:
            district_dict[district] = {
                "sessions": set(),
                "rapid_acc": 0,
                "rapid_deacc": 0,
                "drowsy": 0,
                "total_data_points": 0
            }
        
        district_dict[district]["sessions"].add(row.session_id)
        district_dict[district]["total_data_points"] += 1
        
        if row.app_rapid_acc and row.app_rapid_acc > 0:
            district_dict[district]["rapid_acc"] += 1
        if row.app_rapid_deacc and row.app_rapid_deacc > 0:
            district_dict[district]["rapid_deacc"] += 1
        if row.abnormal_flag and row.abnormal_flag > 0:
            district_dict[district]["drowsy"] += 1
    
    result = []
    for district, data in district_dict.items():
        session_count = len(data["sessions"])
        rapid_acc = data["rapid_acc"]
        rapid_deacc = data["rapid_deacc"]
        drowsy = data["drowsy"]
        total_data_points = data["total_data_points"]
        
        # 안전점수 계산 (100점 만점, 위험 행동이 적을수록 높은 점수)
        total_incidents = rapid_acc + rapid_deacc + drowsy
        if total_data_points > 0:
            safety_score = max(0, min(100, 100 - (total_incidents / total_data_points * 100)))
        else:
            safety_score = 100
        
        result.append({
            "district": district,
            "safetyScore": round(safety_score, 1),
            "rapidAccelCount": rapid_acc,
            "rapidDecelCount": rapid_deacc,
            "drowsyCount": drowsy,
            "sessionCount": session_count,
            "totalIncidents": total_incidents
        })
    
    # 안전점수 기준으로 정렬
    result.sort(key=lambda x: x['safetyScore'], reverse=True)
    
    # 순위 추가
    for i, item in enumerate(result, 1):
        item['rank'] = i
    
    return result


@router.get("/safe-driving/demographics", response_model=List[dict])
async def get_demographics_safe_driving(
    month: Optional[int] = Query(None, description="월 (1-12), None이면 현재 월"),
    web_db: Session = Depends(get_web_db)
):
    """성별, 연령별 운전습관 조회"""
    now = datetime.now()
    target_month = month if month else now.month
    target_year = now.year
    
    month_start = datetime(target_year, target_month, 1)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1)
    else:
        month_end = datetime(target_year, target_month + 1, 1)
    
    # 연령대 그룹화 함수
    age_group = case(
        (and_(VehicleMaster.age >= 20, VehicleMaster.age < 30), '20대'),
        (and_(VehicleMaster.age >= 30, VehicleMaster.age < 40), '30대'),
        (and_(VehicleMaster.age >= 40, VehicleMaster.age < 50), '40대'),
        (VehicleMaster.age >= 50, '50대 이상'),
        else_='기타'
    )
    
    demographics = web_db.query(
VehicleMaster.user_sex.label('gender'),
        age_group.label('age_group'),
        func.count(func.distinct(DrivingSession.session_id)).label('session_count'),
        func.count(DrivingSessionInfo.info_id).label('total_data_points'),
        func.sum(case((DrivingSessionInfo.app_rapid_acc > 0, 1), else_=0)).label('rapid_acc'),
        func.sum(case((DrivingSessionInfo.app_rapid_deacc > 0, 1), else_=0)).label('rapid_deacc'),
        func.sum(case((DrowsyDrive.abnormal_flag > 0, 1), else_=0)).label('drowsy')
    ).join(
DrivingSession, VehicleMaster.car_id == DrivingSession.car_id
    ).join(
DrivingSessionInfo, DrivingSession.session_id == DrivingSessionInfo.session_id
    ).outerjoin(
DrowsyDrive, DrivingSession.session_id == DrowsyDrive.session_id
    ).filter(
DrivingSession.start_time >= month_start,
DrivingSession.start_time < month_end,
DrivingSessionInfo.dt.isnot(None),
VehicleMaster.user_sex.isnot(None),
VehicleMaster.age.isnot(None)
    ).group_by('gender', 'age_group').all()
    
    result = []
    for row in demographics:
        gender = row.gender or "기타"
        age_group = row.age_group or "기타"
        session_count = row.session_count or 0
        total_data_points = row.total_data_points or 1
        rapid_acc = int(row.rapid_acc or 0)
        rapid_deacc = int(row.rapid_deacc or 0)
        drowsy = int(row.drowsy or 0)
        
        total_incidents = rapid_acc + rapid_deacc + drowsy
        
        if total_data_points > 0:
            safety_score = max(0, min(100, 100 - (total_incidents / total_data_points * 100)))
        else:
            safety_score = 100
        
        result.append({
            "category": f"{age_group} {gender}",
            "ageGroup": age_group,
            "gender": gender,
            "safetyScore": round(safety_score, 1),
            "sessionCount": session_count,
            "rapidAccelCount": rapid_acc,
            "rapidDecelCount": rapid_deacc,
            "drowsyCount": drowsy
        })
    
    return result


@router.get("/safe-driving/best-drivers", response_model=List[dict])
async def get_best_drivers(
    month: Optional[int] = Query(None, description="월 (1-12), None이면 현재 월"),
    limit: int = Query(5, description="상위 N명"),
    web_db: Session = Depends(get_web_db)
):
    """베스트 드라이버 조회 (급가속, 급감속, 운전자태도 기준)"""
    now = datetime.now()
    target_month = month if month else now.month
    target_year = now.year
    
    month_start = datetime(target_year, target_month, 1)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1)
    else:
        month_end = datetime(target_year, target_month + 1, 1)
    
    # 차량별 안전운전 점수 계산 (dt 기준)
    driver_scores = web_db.query(
VehicleMaster.car_id,
        func.count(func.distinct(DrivingSession.session_id)).label('session_count'),
        func.count(DrivingSessionInfo.info_id).label('total_data_points'),
        func.sum(case((DrivingSessionInfo.app_rapid_acc > 0, 1), else_=0)).label('rapid_acc'),
        func.sum(case((DrivingSessionInfo.app_rapid_deacc > 0, 1), else_=0)).label('rapid_deacc'),
        func.sum(case((DrowsyDrive.abnormal_flag > 0, 1), else_=0)).label('drowsy'),
        func.sum(case((DrivingSessionInfo.app_travel == 1, 1), else_=0)).label('total_travel'),
VehicleMaster.user_location
    ).join(
DrivingSession, VehicleMaster.car_id == DrivingSession.car_id
    ).join(
DrivingSessionInfo, DrivingSession.session_id == DrivingSessionInfo.session_id
    ).outerjoin(
DrowsyDrive, DrivingSession.session_id == DrowsyDrive.session_id
    ).filter(
DrivingSession.start_time >= month_start,
DrivingSession.start_time < month_end,
DrivingSessionInfo.dt.isnot(None)
    ).group_by(VehicleMaster.car_id, VehicleMaster.user_location).all()
    
    result = []
    for row in driver_scores:
        session_count = row.session_count or 0
        total_data_points = row.total_data_points or 1
        rapid_acc = int(row.rapid_acc or 0)
        rapid_deacc = int(row.rapid_deacc or 0)
        drowsy = int(row.drowsy or 0)
        total_travel = int(row.total_travel or 0)
        
        # 안전운전 점수 계산 (실제 데이터 포인트 기반)
        total_incidents = rapid_acc + rapid_deacc + drowsy
        if total_data_points > 0:
            base_score = max(0, min(100, 100 - (total_incidents / total_data_points * 100)))
        else:
            base_score = 100
        
        # 세션 수와 주행 거리 보너스 (안전운전을 많이 한 경우)
        session_bonus = min(3, session_count / 50)  # 최대 3점 (50회 이상)
        travel_bonus = min(2, total_travel / 500)  # 최대 2점 (500회 이상)
        
        final_score = min(100, base_score + session_bonus + travel_bonus)
        
        # 구 추출
        location = row.user_location or "부산시"
        district = "기타"
        if location and "구" in location:
            parts = location.split()
            for part in parts:
                if "구" in part:
                    idx = part.find("구")
                    if idx >= 0:
                        district = part[:idx+1] if idx > 0 else part
                    break
        
        result.append({
            "carId": row.car_id,
            "safetyScore": round(final_score, 1),
            "sessionCount": session_count,
            "rapidAccelCount": rapid_acc,
            "rapidDecelCount": rapid_deacc,
            "drowsyCount": drowsy,
            "totalTravel": total_travel,
            "district": district
        })
    
    # 점수 기준으로 정렬하고 상위 N명 반환
    result.sort(key=lambda x: x['safetyScore'], reverse=True)
    
    # 순위 추가
    for i, item in enumerate(result[:limit], 1):
        item['rank'] = i
    
    return result[:limit]


@router.get("/safe-driving/hourly", response_model=List[dict])
async def get_hourly_safe_driving(
    month: Optional[int] = Query(None, description="월 (1-12), None이면 현재 월"),
    web_db: Session = Depends(get_web_db)
):
    """시간대별 안전운전률 조회"""
    now = datetime.now()
    target_month = month if month else now.month
    target_year = now.year
    
    month_start = datetime(target_year, target_month, 1)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1)
    else:
        month_end = datetime(target_year, target_month + 1, 1)
    
    # 시간대 그룹화
    hour_group = case(
        (and_(DrivingSessionInfo.Hour >= 0, DrivingSessionInfo.Hour < 6), '00-06시'),
        (and_(DrivingSessionInfo.Hour >= 6, DrivingSessionInfo.Hour < 9), '06-09시'),
        (and_(DrivingSessionInfo.Hour >= 9, DrivingSessionInfo.Hour < 12), '09-12시'),
        (and_(DrivingSessionInfo.Hour >= 12, DrivingSessionInfo.Hour < 15), '12-15시'),
        (and_(DrivingSessionInfo.Hour >= 15, DrivingSessionInfo.Hour < 18), '15-18시'),
        (and_(DrivingSessionInfo.Hour >= 18, DrivingSessionInfo.Hour < 21), '18-21시'),
        (DrivingSessionInfo.Hour >= 21, '21-24시'),
        else_='기타'
    )
    
    hourly_stats = web_db.query(
        hour_group.label('hour_range'),
        func.count(func.distinct(DrivingSession.session_id)).label('driving_count'),
        func.count(DrivingSessionInfo.info_id).label('total_data_points'),
        func.sum(case((DrivingSessionInfo.app_rapid_acc > 0, 1), else_=0)).label('rapid_acc'),
        func.sum(case((DrivingSessionInfo.app_rapid_deacc > 0, 1), else_=0)).label('rapid_deacc'),
        func.sum(case((DrowsyDrive.abnormal_flag > 0, 1), else_=0)).label('drowsy')
    ).join(
DrivingSession, DrivingSessionInfo.session_id == DrivingSession.session_id
    ).outerjoin(
DrowsyDrive, DrivingSession.session_id == DrowsyDrive.session_id
    ).filter(
DrivingSession.start_time >= month_start,
DrivingSession.start_time < month_end,
DrivingSessionInfo.dt.isnot(None),
DrivingSessionInfo.Hour.isnot(None)
    ).group_by('hour_range').all()
    
    result = []
    for row in hourly_stats:
        hour_range = row.hour_range or "기타"
        driving_count = row.driving_count or 0
        total_data_points = row.total_data_points or 1
        rapid_acc = int(row.rapid_acc or 0)
        rapid_deacc = int(row.rapid_deacc or 0)
        drowsy = int(row.drowsy or 0)
        
        total_incidents = rapid_acc + rapid_deacc + drowsy
        if total_data_points > 0:
            safety_rate = max(0, min(100, 100 - (total_incidents / total_data_points * 100)))
        else:
            safety_rate = 100
        
        result.append({
            "hourRange": hour_range,
            "safetyRate": round(safety_rate, 1),
            "drivingCount": driving_count,
            "rapidAccelCount": rapid_acc,
            "rapidDecelCount": rapid_deacc,
            "drowsyCount": drowsy
        })
    
    # 시간대 순서대로 정렬
    hour_order = {
        '00-06시': 0, '06-09시': 1, '09-12시': 2, '12-15시': 3,
        '15-18시': 4, '18-21시': 5, '21-24시': 6, '기타': 7
    }
    result.sort(key=lambda x: hour_order.get(x['hourRange'], 99))
    
    return result


@router.get("/safe-driving/top-drowsy-session", response_model=dict)
async def get_top_drowsy_session(
    month: Optional[int] = Query(None, description="월 (1-12), None이면 현재 월"),
    web_db: Session = Depends(get_web_db)
):
    """gaze_closure 총 횟수가 가장 많은 session_id 조회"""
    now = datetime.now()
    target_month = month if month else now.month
    target_year = now.year
    
    month_start = datetime(target_year, target_month, 1)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1)
    else:
        month_end = datetime(target_year, target_month + 1, 1)
    
    # session_id별 gaze_closure 총합 계산
    top_session = db.query(
DrowsyDrive.session_id,
        func.sum(DrowsyDrive.gaze_closure).label('total_gaze_closure'),
        func.count(DrowsyDrive.drowsy_id).label('detection_count')
    ).filter(
DrowsyDrive.detected_at >= month_start,
DrowsyDrive.detected_at < month_end,
DrowsyDrive.gaze_closure.isnot(None)
    ).group_by(DrowsyDrive.session_id).order_by(
        func.sum(DrowsyDrive.gaze_closure).desc()
    ).first()
    
    if top_session:
        return {
            "sessionId": top_session.session_id,
            "totalGazeClosure": int(top_session.total_gaze_closure or 0),
            "detectionCount": top_session.detection_count or 0,
            "month": target_month,
            "year": target_year
        }
    else:
        return {
            "sessionId": None,
            "totalGazeClosure": 0,
            "detectionCount": 0,
            "month": target_month,
            "year": target_year
        }


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


@router.get("/safe-driving/best-drivers/monthly", response_model=List[dict])
async def get_best_drivers_monthly(
    year: int = Query(..., description="연도 (예: 2024)"),
    month: int = Query(..., description="월 (1-12)"),
    web_db: Session = Depends(get_web_db)
):
    """
    월별 베스트 드라이버 Top 10 조회 (안전운전 점수 기준)
    
    점수 계산 방식 (일반 사용자 안전운전 점수 계산 로직과 동일):
    - 안전운전 점수 = 100 - (급가속/급감속 감점) - (졸음운전 감점)
    - 급가속/급감속: dt 기준으로 10분 단위 그룹화 후 각 그룹의 합계를 더함
    - 졸음운전: 4초당 1점 감점 (최대 제한 없음)
    - 차량별 평균 안전운전 점수로 정렬
    """
    # 해당 월에 실제 발생한 급가속/급감속 데이터 조회 (dt 기준으로 년도/월 필터링)
    # JOIN을 사용하여 세션 정보와 함께 조회
    rapid_infos_query = db.query(
DrivingSessionInfo,
DrivingSession.car_id
    ).join(
DrivingSession,
DrivingSessionInfo.session_id == DrivingSession.session_id
    ).filter(
DrivingSessionInfo.dt.isnot(None),
        extract('year', DrivingSessionInfo.dt) == year,
        extract('month', DrivingSessionInfo.dt) == month,
DrivingSession.car_id.isnot(None)
    ).order_by(DrivingSessionInfo.dt).all()
    
    # 결과를 분리
    rapid_infos = []
    rapid_info_to_car = {}
    for info, car_id in rapid_infos_query:
        rapid_infos.append(info)
        rapid_info_to_car[info.session_id] = car_id
    
    # 해당 월에 실제 발생한 졸음운전 데이터 조회 (detected_at 기준으로 년도/월 필터링)
    # JOIN을 사용하여 세션 정보와 함께 조회
    drowsy_records_query = db.query(
DrowsyDrive,
DrivingSession.car_id
    ).join(
DrivingSession,
DrowsyDrive.session_id == DrivingSession.session_id
    ).filter(
DrowsyDrive.detected_at.isnot(None),
        extract('year', DrowsyDrive.detected_at) == year,
        extract('month', DrowsyDrive.detected_at) == month,
DrivingSession.car_id.isnot(None)
    ).all()
    
    # 결과를 분리
    drowsy_records = []
    drowsy_to_car = {}
    for drowsy, car_id in drowsy_records_query:
        drowsy_records.append(drowsy)
        drowsy_to_car[drowsy.session_id] = car_id
    
    # 세션별로 데이터 집계 (일반 사용자 로직과 동일)
    session_data = {}  # session_id -> {drowsy_records, rapid_infos, car_id}
    
    # 졸음운전 데이터를 세션별로 그룹화
    for drowsy in drowsy_records:
        session_id = drowsy.session_id
        if not session_id:
            continue
        car_id = drowsy_to_car.get(session_id)
        if not car_id:
            continue  # car_id가 없으면 건너뜀
        
        if session_id not in session_data:
            session_data[session_id] = {
                'drowsy_records': [],
                'rapid_infos': [],
                'car_id': car_id
            }
        session_data[session_id]['drowsy_records'].append(drowsy)
    
    # 급가속/급감속 데이터를 세션별로 그룹화
    for info in rapid_infos:
        session_id = info.session_id
        if not session_id:
            continue
        car_id = rapid_info_to_car.get(session_id)
        if not car_id:
            continue  # car_id가 없으면 건너뜀
        
        if session_id not in session_data:
            session_data[session_id] = {
                'drowsy_records': [],
                'rapid_infos': [],
                'car_id': car_id
            }
        session_data[session_id]['rapid_infos'].append(info)
    
    if not session_data:
        return []
    
    # 차량별 안전운전 점수 계산
    car_scores = {}  # car_id -> {total_score, session_count}
    
    # 세션별로 점수 계산 (일반 사용자 로직과 동일)
    for session_id, data in session_data.items():
        car_id = data.get('car_id')
        if not car_id:
            continue
        
        # 졸음운전 감점 계산 (정수 단위)
        drowsy_penalty = 0
        for drowsy in data['drowsy_records']:
            drowsy_penalty += calculate_drowsy_penalty(drowsy.duration_sec or 0)
        
        # 급가속/급감속 데이터 (dt 기준으로 10분 단위 그룹화)
        session_infos = data['rapid_infos']
        
        # 10분 단위로 그룹화하여 급가속/급감속 합계 계산
        rapid_penalty = 0
        if session_infos:  # 데이터가 있을 때만 계산
            current_10min_group = None
            current_group_acc_sum = 0  # 현재 그룹의 급가속 합계
            current_group_deacc_sum = 0  # 현재 그룹의 급감속 합계
            
            for info in session_infos:
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
        
        # 안전운전 점수 계산 (100점 만점에서 감점, 정수)
        total_penalty = int(drowsy_penalty) + int(rapid_penalty)
        safety_score = int(max(0, 100 - total_penalty))
        
        # 차량별로 점수 누적
        if car_id not in car_scores:
            car_scores[car_id] = {
                'total_score': 0,
                'session_count': 0
            }
        
        car_scores[car_id]['total_score'] += safety_score
        car_scores[car_id]['session_count'] += 1
    
    # 차량별 평균 안전운전 점수 계산
    car_avg_scores = {}
    for car_id, score_data in car_scores.items():
        if score_data['session_count'] > 0:
            avg_score = score_data['total_score'] / score_data['session_count']
            car_avg_scores[car_id] = {
                'avg_score': avg_score,
                'session_count': score_data['session_count']
            }
    
    # 차량 정보 조회
    car_ids = list(car_avg_scores.keys())
    if not car_ids:
        return []
    
    user_vehicles = web_db.query(VehicleMaster).filter(
VehicleMaster.car_id.in_(car_ids)
    ).all()
    
    car_info = {uv.car_id: uv for uv in user_vehicles}
    
    # 점수 기준으로 정렬 (높은 순)
    sorted_cars = sorted(
        car_avg_scores.items(),
        key=lambda x: x[1]['avg_score'],
        reverse=True
    )[:10]
    
    # 결과 생성
    best_drivers = []
    for idx, (car_id, score_data) in enumerate(sorted_cars, 1):
        uv = car_info.get(car_id)
        
        best_drivers.append({
            "rank": idx,
            "carId": car_id,
            "carBrand": uv.user_car_brand if uv else None,
            "carModel": uv.user_car_model if uv else None,
            "driverAge": uv.age if uv else None,
            "driverSex": uv.user_sex if uv else None,
            "driverLocation": uv.user_location if uv else None,
            "safetyScore": round(score_data['avg_score'], 2),
            "sessionCount": score_data['session_count']
        })
    
    return best_drivers
