"""
국세청 관리자 API
체납자 차량 탐지 알림 및 관리
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, text
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.database import get_web_db
from app.api.deps import require_nts_admin
from app.models.user import User
from app.models.arrears_detection import ArrearsDetectionMart
from app.models.arrears_info_mart import ArrearsInfoMart
from app.models.arrears_detection_modification import ArrearsDetectionModification

router = APIRouter()


class UpdateDetectionRequest(BaseModel):
    detection_success: bool


@router.get("/arrears/detections", response_model=dict)
async def get_arrears_detections(
    car_plate_number: Optional[str] = Query(None, description="차량 번호로 필터링"),
    detection_success: Optional[bool] = Query(None, description="탐지 성공 여부로 필터링"),
    start_date: Optional[datetime] = Query(None, description="시작 날짜"),
    end_date: Optional[datetime] = Query(None, description="종료 날짜"),
    page: int = Query(1, ge=1, description="페이지 번호 (1부터 시작)"),
    limit: int = Query(100, ge=1, le=1000, description="페이지당 항목 수 (최대 1000)"),
    current_user: User = Depends(require_nts_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    체납자 차량 탐지 알림 조회 (위치, 시간)
    국세청 관리자 전용
    페이지네이션 지원
    r_arrears_detection_mart 사용 (반정규화 - JOIN 불필요)
    """
    query = web_db.query(ArrearsDetectionMart)
    
    # 필터링 (원본 데이터 기준)
    if car_plate_number:
        query = query.filter(ArrearsDetectionMart.car_plate_number.like(f"%{car_plate_number}%"))
    
    if start_date:
        query = query.filter(ArrearsDetectionMart.detected_time >= start_date)
    
    if end_date:
        query = query.filter(ArrearsDetectionMart.detected_time <= end_date)
    
    # detection_success 필터는 수정 기록을 고려해야 함
    # SQL 레벨에서 LEFT JOIN으로 처리 (성능 최적화)
    if detection_success is not None:
        # 수정 기록과 LEFT JOIN하여 COALESCE로 수정 기록이 있으면 new_result, 없으면 원본 값 사용
        # SQL: COALESCE(mod.new_result, adm.detection_success) = :detection_success
        from sqlalchemy import case, literal
        
        # 수정 기록이 있으면 new_result, 없으면 원본 detection_success 사용
        # 하지만 SQLAlchemy ORM으로는 복잡하므로, 일단 필터링 없이 가져온 후 Python에서 필터링
        # (실제 운영 환경에서는 뷰나 함수로 최적화 필요)
        pass
    
    # 일단 모든 데이터 조회 (detection_success 필터는 나중에 적용)
    all_detections = query.order_by(ArrearsDetectionMart.detected_time.desc()).all()
    
    # 수정 기록 조회 (전체 detection_id에 대해)
    modification_records = {}
    if all_detections:
        all_detection_ids = [d.detection_id for d in all_detections]
        modification_query = web_db.query(ArrearsDetectionModification).filter(
            ArrearsDetectionModification.detection_id.in_(all_detection_ids)
        ).all()
        modification_records = {r.detection_id: r.new_result for r in modification_query}
    
    # 수정 기록을 적용하여 detection_success 필터링
    filtered_detections = []
    for d in all_detections:
        # 수정 기록이 있으면 new_result 사용, 없으면 원본 값 사용
        actual_detection_success = None
        if d.detection_id in modification_records:
            actual_detection_success = bool(modification_records[d.detection_id])
        elif d.detection_success is not None:
            actual_detection_success = bool(d.detection_success)
        
        # detection_success 필터 적용
        if detection_success is not None:
            if actual_detection_success != detection_success:
                continue  # 필터 조건에 맞지 않으면 제외
        
        filtered_detections.append(d)
    
    # 총 개수 (필터링 후)
    total_count = len(filtered_detections)
    
    # 페이지네이션 적용
    total_pages = (total_count + limit - 1) // limit if total_count > 0 else 0
    offset = (page - 1) * limit
    detections = filtered_detections[offset:offset + limit]
    
    # 해결완료 여부 조회
    detection_ids = [d.detection_id for d in detections]
    resolved_detections = {}
    if detection_ids:
        resolved_records = web_db.query(ArrearsDetectionModification).filter(
            ArrearsDetectionModification.detection_id.in_(detection_ids),
            ArrearsDetectionModification.is_resolved == True
        ).all()
        resolved_detections = {r.detection_id: True for r in resolved_records}
    
    return {
        "items": [{
            "detectionId": d.detection_id,
            "carPlateNumber": d.car_plate_number or "알 수 없음",
            "imageId": d.image_id,
            # 수정 기록이 있으면 new_result 사용, 없으면 원본 detection_success 사용
            "detectionSuccess": bool(modification_records[d.detection_id]) if d.detection_id in modification_records else (bool(d.detection_success) if d.detection_success is not None else None),
            "detectedLat": d.detected_lat,
            "detectedLon": d.detected_lon,
            "detectedTime": d.detected_time.isoformat() if d.detected_time else None,
            "location": f"위도: {d.detected_lat}, 경도: {d.detected_lon}" if d.detected_lat and d.detected_lon else "위치 정보 없음",
            "isResolved": resolved_detections.get(d.detection_id, False),
            "totalArrearsAmount": d.total_arrears_amount,
            "arrearsPeriod": d.arrears_period,
            "noticeSent": bool(d.notice_sent) if d.notice_sent is not None else False
        } for d in detections],
        "total": total_count,
        "page": page,
        "limit": limit,
        "totalPages": total_pages
    }


@router.put("/arrears/detections/{detection_id}", response_model=dict)
async def update_detection_result(
    detection_id: str,
    request: UpdateDetectionRequest,
    current_user: User = Depends(require_nts_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    탐지 결과 수정 기능
    국세청 관리자 전용
    web DB에 수정 기록 저장 (r_arrears_detection_mart는 읽기 전용이므로 수정 기록만 저장)
    """
    # 탐지 기록 조회 (r_arrears_detection_mart - 읽기 전용)
    detection = web_db.query(ArrearsDetectionMart).filter(
        ArrearsDetectionMart.detection_id == detection_id
    ).first()
    
    if not detection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="탐지 기록을 찾을 수 없습니다"
        )
    
    # 이전 탐지 결과 저장 (수정 기록용)
    # 기존 수정 기록이 있으면 그 new_result를 previous_result로 사용
    # 없으면 원본 detection_success를 previous_result로 사용
    previous_result = None
    
    # 기존 수정 기록 확인
    car_plate_number = detection.car_plate_number or "알 수 없음"
    existing_modification = web_db.query(ArrearsDetectionModification).filter(
        ArrearsDetectionModification.detection_id == detection_id,
        ArrearsDetectionModification.car_plate_number == car_plate_number
    ).order_by(ArrearsDetectionModification.id.desc()).first()  # 최신 수정 기록 가져오기
    
    if existing_modification:
        # 기존 수정 기록이 있으면 그 new_result를 previous_result로 사용
        previous_result = existing_modification.new_result
    else:
        # 첫 번째 수정이면 원본 detection_success를 previous_result로 사용
        previous_result = bool(detection.detection_success) if detection.detection_success is not None else None
    
    if existing_modification:
        # 기존 수정 기록 업데이트
        existing_modification.previous_result = previous_result
        existing_modification.new_result = request.detection_success
        existing_modification.modified_by_user_id = current_user.id
        web_db.commit()
        web_db.refresh(existing_modification)
    else:
        modification = ArrearsDetectionModification(
            detection_id=detection_id,
            car_plate_number=car_plate_number,
            previous_result=previous_result,
            new_result=request.detection_success,
            modified_by_user_id=current_user.id
        )
        web_db.add(modification)
        web_db.commit()
        web_db.refresh(modification)
    
    return {
        "detectionId": detection.detection_id,
        "carPlateNumber": detection.car_plate_number,
        "detectionSuccess": request.detection_success,
        "message": "탐지 결과가 수정되었습니다"
    }


@router.put("/arrears/detections/{detection_id}/resolve", response_model=dict)
async def resolve_arrears(
    detection_id: str,
    current_user: User = Depends(require_nts_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    체납자 해결완료 처리
    국세청 관리자 전용
    web DB에 해결완료 기록 저장
    """
    # 탐지 기록 조회 (r_arrears_detection_mart)
    detection = web_db.query(ArrearsDetectionMart).filter(
        ArrearsDetectionMart.detection_id == detection_id
    ).first()
    
    if not detection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="탐지 기록을 찾을 수 없습니다"
        )
    
    car_plate_number = detection.car_plate_number or "알 수 없음"
    
    # 기존 수정 기록 확인
    existing_modification = web_db.query(ArrearsDetectionModification).filter(
        ArrearsDetectionModification.detection_id == detection_id,
        ArrearsDetectionModification.car_plate_number == car_plate_number
    ).first()
    
    # 이미 해결완료 처리되었는지 확인
    if existing_modification and existing_modification.is_resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 해결완료 처리된 탐지입니다"
        )
    
    # 해결완료 기록 저장/업데이트
    from datetime import datetime
    if existing_modification:
        existing_modification.is_resolved = True
        existing_modification.resolved_at = datetime.now()
        web_db.commit()
        web_db.refresh(existing_modification)
        resolution = existing_modification
    else:
        current_result = bool(detection.detection_success) if detection.detection_success is not None else None
        resolution = ArrearsDetectionModification(
            detection_id=detection_id,
            car_plate_number=car_plate_number,
            previous_result=None,
            new_result=current_result,
            modified_by_user_id=current_user.id,
            is_resolved=True,
            resolved_at=datetime.now()
        )
        web_db.add(resolution)
        web_db.commit()
        web_db.refresh(resolution)
    
    return {
        "detectionId": detection.detection_id,
        "carPlateNumber": detection.car_plate_number,
        "isResolved": True,
        "resolvedAt": resolution.resolved_at.isoformat() if resolution.resolved_at else None,
        "message": "해결완료 처리되었습니다"
    }


@router.get("/arrears/detections/recent", response_model=List[dict])
async def get_recent_detections(
    since: Optional[datetime] = Query(None, description="이 시간 이후의 탐지 기록 조회 (오늘 날짜 기준으로 무시됨)"),
    current_user: User = Depends(require_nts_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    최신 탐지 기록 조회 (알림용)
    국세청 관리자 전용
    오늘 날짜의 탐지 기록만 반환
    """
    query = web_db.query(ArrearsDetectionMart)
    
    # 오늘 날짜 기준으로 필터링
    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59, 999999)
    
    # 오늘 날짜의 탐지 기록만 조회
    query = query.filter(
        ArrearsDetectionMart.detected_time >= today_start,
        ArrearsDetectionMart.detected_time <= today_end
    )
    
    # since 파라미터가 있으면 그 이후의 데이터만 추가 필터링 (중복 알림 방지)
    if since:
        query = query.filter(ArrearsDetectionMart.detected_time > since)
    
    # 최신순 정렬, 최대 50개만 반환 (알림용이므로)
    detections = query.order_by(ArrearsDetectionMart.detected_time.desc()).limit(50).all()
    
    return [{
        "detectionId": d.detection_id,
        "carPlateNumber": d.car_plate_number or "알 수 없음",
        "detectionSuccess": bool(d.detection_success) if d.detection_success is not None else None,
        "detectedLat": d.detected_lat,
        "detectedLon": d.detected_lon,
        "detectedTime": d.detected_time.isoformat() if d.detected_time else None,
        "location": f"위도: {d.detected_lat}, 경도: {d.detected_lon}" if d.detected_lat and d.detected_lon else "위치 정보 없음"
    } for d in detections]


@router.get("/arrears/stats", response_model=dict)
async def get_arrears_stats(
    current_user: User = Depends(require_nts_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    체납자 통계 조회
    - 전체 체납자 수 (arrears_info 테이블)
    - 탐지 성공 건수 (arrears_detection에서 detection_success = 1)
    - 탐지 실패 건수 (전체 체납자 - 탐지 성공)
    - 미확인 건수 (arrears_detection에서 detection_success = NULL)
    """
    # require_nts_admin가 이미 organization 체크를 수행하므로 중복 체크 불필요
    
    # 전체 체납자 수 (r_arrears_info_mart가 있으면 그걸 사용, 없으면 r_arrears_detection_mart에서 DISTINCT)
    try:
        # 테이블 존재 여부 확인
        web_db.execute(text("SELECT 1 FROM r_arrears_info_mart LIMIT 1"))
        total_arrears = web_db.query(func.count(ArrearsInfoMart.car_plate_number)).scalar() or 0
    except:
        total_arrears = web_db.query(func.count(func.distinct(ArrearsDetectionMart.car_plate_number))).scalar() or 0
    
    # 탐지 성공 건수 (r_arrears_detection_mart에서 detection_success = 1)
    success_count = web_db.query(func.count(ArrearsDetectionMart.detection_id)).filter(
        ArrearsDetectionMart.detection_success == 1
    ).scalar() or 0
    
    # 미탐지 건수 = 전체 체납자 - 탐지 성공
    undetected_count = total_arrears - success_count
    
    # 미확인 건수 (r_arrears_detection_mart에서 detection_success = NULL)
    unconfirmed_count = web_db.query(func.count(ArrearsDetectionMart.detection_id)).filter(
        ArrearsDetectionMart.detection_success.is_(None)
    ).scalar() or 0
    
    # 오탐지로 수정한 횟수 (new_result = 0인 것의 개수)
    false_positive_count = web_db.query(func.count(ArrearsDetectionModification.id)).filter(
        ArrearsDetectionModification.new_result == False
    ).scalar() or 0
    
    # 해결완료 건수 (web DB에서 is_resolved = True인 것)
    now = datetime.now()
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
    
    return {
        "totalArrears": total_arrears,
        "detectionSuccess": success_count,
        "undetected": undetected_count,  # 미탐지 (전체 체납자 - 탐지 성공)
        "falsePositiveCount": false_positive_count,  # 오탐지로 수정한 횟수
        "unconfirmed": unconfirmed_count,
        "resolvedCount": resolved_count
    }

