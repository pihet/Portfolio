"""
경찰청 관리자 API
실종자 탐지 알림 및 관리
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_web_db
from app.api.deps import require_police_admin
from app.models.user import User
from app.models.missing_person_detection import MissingPersonDetectionMart
from app.models.missing_person_detection_modification import MissingPersonDetectionModification

router = APIRouter()


class UpdateDetectionRequest(BaseModel):
    detection_success: bool


@router.get("/missing-person/detections", response_model=dict)
async def get_missing_person_detections(
    missing_id: Optional[str] = Query(None, description="실종자 ID로 필터링"),
    detection_success: Optional[str] = Query(None, description="탐지 성공 여부로 필터링 (true/false/null)"),
    start_date: Optional[datetime] = Query(None, description="시작 날짜"),
    end_date: Optional[datetime] = Query(None, description="종료 날짜"),
    page: int = Query(1, ge=1, description="페이지 번호 (1부터 시작)"),
    limit: int = Query(100, ge=1, le=1000, description="페이지당 항목 수 (최대 1000)"),
    current_user: User = Depends(require_police_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    실종자 탐지 알림 조회 (위치, 시간)
    경찰청 관리자 전용
    페이지네이션 지원
    r_missing_person_detection_mart 사용 (반정규화 - JOIN 불필요)
    """
    query = web_db.query(MissingPersonDetectionMart)
    
    # 필터링
    if missing_id:
        query = query.filter(MissingPersonDetectionMart.missing_id == missing_id)
    
    # 총 개수 계산 (필터링 후) - 먼저 수정 기록 없이 계산
    # detection_success 필터는 수정 기록을 고려해야 하므로 나중에 처리
    all_detections_query = web_db.query(MissingPersonDetectionMart)
    
    if missing_id:
        all_detections_query = all_detections_query.filter(MissingPersonDetectionMart.missing_id == missing_id)
    
    if start_date:
        all_detections_query = all_detections_query.filter(MissingPersonDetectionMart.detected_time >= start_date)
    
    if end_date:
        from datetime import timedelta
        end_date_exclusive = end_date + timedelta(seconds=1)
        all_detections_query = all_detections_query.filter(MissingPersonDetectionMart.detected_time < end_date_exclusive)
    
    # 일단 모든 데이터 조회 (detection_success 필터는 나중에 적용)
    all_detections = all_detections_query.order_by(MissingPersonDetectionMart.detected_time.desc()).all()
    
    # 수정 기록 조회 (전체 detection_id에 대해)
    modification_records = {}
    if all_detections:
        all_detection_ids = [d.detection_id for d in all_detections]
        modification_query = web_db.query(MissingPersonDetectionModification).filter(
            MissingPersonDetectionModification.detection_id.in_(all_detection_ids)
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
            if detection_success.lower() == 'true' and actual_detection_success != True:
                continue
            elif detection_success.lower() == 'false' and actual_detection_success != False:
                continue
            elif detection_success.lower() == 'null' and actual_detection_success is not None:
                continue
        
        filtered_detections.append(d)
    
    # 총 개수 (필터링 후)
    total_count = len(filtered_detections)
    
    # 페이지네이션 적용
    offset = (page - 1) * limit
    detections = filtered_detections[offset:offset + limit]
    
    # 총 페이지 수 계산
    total_pages = (total_count + limit - 1) // limit if total_count > 0 else 0
    
    # 해결완료 여부 조회
    detection_ids = [d.detection_id for d in detections]
    resolved_detections = {}
    if detection_ids:
        resolved_records = web_db.query(MissingPersonDetectionModification).filter(
            MissingPersonDetectionModification.detection_id.in_(detection_ids),
            MissingPersonDetectionModification.is_resolved == True
        ).all()
        resolved_detections = {r.detection_id: True for r in resolved_records}
    
    items = []
    for detection in detections:
        is_resolved = resolved_detections.get(detection.detection_id, False)
        # 수정 기록이 있으면 new_result 사용, 없으면 원본 detection_success 사용
        actual_detection_success = None
        if detection.detection_id in modification_records:
            actual_detection_success = bool(modification_records[detection.detection_id])
        elif detection.detection_success is not None:
            actual_detection_success = bool(detection.detection_success)
        
        items.append({
            "detectionId": detection.detection_id,
            "missingId": detection.missing_id or "알 수 없음",
            "missingName": detection.missing_name or "알 수 없음",
            "missingAge": detection.missing_age,
            "imageId": detection.image_id,
            "detectionSuccess": actual_detection_success,
            "detectedLat": detection.detected_lat,
            "detectedLon": detection.detected_lon,
            "detectedTime": detection.detected_time.isoformat() if detection.detected_time else None,
            "location": f"위도: {detection.detected_lat}, 경도: {detection.detected_lon}" if detection.detected_lat and detection.detected_lon else "위치 정보 없음",
            "isResolved": is_resolved
        })
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "totalPages": total_pages
    }


@router.get("/missing-person/detections/recent", response_model=List[dict])
async def get_recent_missing_person_detections(
    since: Optional[datetime] = Query(None, description="이 시간 이후의 탐지 기록 조회 (오늘 날짜 기준으로 무시됨)"),
    current_user: User = Depends(require_police_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    최신 실종자 탐지 기록 조회 (알림용)
    경찰청 관리자 전용
    오늘 날짜의 탐지 기록만 반환
    """
    query = web_db.query(MissingPersonDetectionMart)
    
    # 오늘 날짜 기준으로 필터링
    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59, 999999)
    
    # 오늘 날짜의 탐지 기록만 조회
    query = query.filter(
        MissingPersonDetectionMart.detected_time >= today_start,
        MissingPersonDetectionMart.detected_time <= today_end
    )
    
    # since 파라미터가 있으면 그 이후의 데이터만 추가 필터링 (중복 알림 방지)
    if since:
        query = query.filter(MissingPersonDetectionMart.detected_time > since)
    
    # 최신순 정렬, 최대 50개만 반환 (알림용이므로)
    detections = query.order_by(MissingPersonDetectionMart.detected_time.desc()).limit(50).all()
    
    items = []
    for detection in detections:
        items.append({
            "detectionId": detection.detection_id,
            "missingId": detection.missing_id or "알 수 없음",
            "missingName": detection.missing_name or "알 수 없음",
            "missingAge": detection.missing_age,
            "detectionSuccess": bool(detection.detection_success) if detection.detection_success is not None else None,
            "detectedLat": detection.detected_lat,
            "detectedLon": detection.detected_lon,
            "detectedTime": detection.detected_time.isoformat() if detection.detected_time else None,
            "location": f"위도: {detection.detected_lat}, 경도: {detection.detected_lon}" if detection.detected_lat and detection.detected_lon else "위치 정보 없음"
        })
    
    return items


@router.put("/missing-person/detections/{detection_id}", response_model=dict)
async def update_detection_result(
    detection_id: str,
    request: UpdateDetectionRequest,
    current_user: User = Depends(require_police_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    탐지 결과 수정 기능
    경찰청 관리자 전용
    web DB에 수정 기록 저장 (r_missing_person_detection_mart는 읽기 전용이므로 수정 기록만 저장)
    """
    # 탐지 기록 조회 (r_missing_person_detection_mart - 읽기 전용)
    detection = web_db.query(MissingPersonDetectionMart).filter(
        MissingPersonDetectionMart.detection_id == detection_id
    ).first()
    
    if not detection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="탐지 기록을 찾을 수 없습니다"
        )
    
    # 이전 탐지 결과 저장 (수정 기록용)
    # 이전 탐지 결과 저장 (수정 기록용)
    # 기존 수정 기록이 있으면 그 new_result를 previous_result로 사용
    # 없으면 원본 detection_success를 previous_result로 사용
    previous_result = None
    
    # 기존 수정 기록 확인 (같은 missing_id와 detection_id)
    missing_id = detection.missing_id or "알 수 없음"
    existing_modification = web_db.query(MissingPersonDetectionModification).filter(
        MissingPersonDetectionModification.detection_id == detection_id,
        MissingPersonDetectionModification.missing_id == missing_id
    ).order_by(MissingPersonDetectionModification.id.desc()).first()  # 최신 수정 기록 가져오기
    
    if existing_modification:
        # 기존 수정 기록이 있으면 그 new_result를 previous_result로 사용
        previous_result = existing_modification.new_result
    else:
        # 첫 번째 수정이면 원본 detection_success를 previous_result로 사용
        previous_result = bool(detection.detection_success) if detection.detection_success is not None else None
    
    if existing_modification:
        # 기존 행 업데이트
        existing_modification.previous_result = previous_result
        existing_modification.new_result = request.detection_success
        existing_modification.modified_by_user_id = current_user.id
        web_db.commit()
        web_db.refresh(existing_modification)
    else:
        # 새 행 생성
        modification = MissingPersonDetectionModification(
            detection_id=detection_id,
            missing_id=missing_id,
            previous_result=previous_result,
            new_result=request.detection_success,
            modified_by_user_id=current_user.id
        )
        web_db.add(modification)
        web_db.commit()
        web_db.refresh(modification)
    
    return {
        "detectionId": detection.detection_id,
        "missingId": detection.missing_id,
        "detectionSuccess": request.detection_success,
        "message": "탐지 결과가 수정되었습니다"
    }


@router.put("/missing-person/detections/{detection_id}/resolve", response_model=dict)
async def resolve_missing_person(
    detection_id: str,
    current_user: User = Depends(require_police_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    실종자 해결완료 처리
    경찰청 관리자 전용
    web DB에 해결완료 기록 저장
    """
    # 탐지 기록 조회 (r_missing_person_detection_mart)
    detection = web_db.query(MissingPersonDetectionMart).filter(
        MissingPersonDetectionMart.detection_id == detection_id
    ).first()
    
    if not detection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="탐지 기록을 찾을 수 없습니다"
        )
    
    missing_id = detection.missing_id or "알 수 없음"
    
    # 기존 수정 기록 확인
    existing_modification = web_db.query(MissingPersonDetectionModification).filter(
        MissingPersonDetectionModification.detection_id == detection_id,
        MissingPersonDetectionModification.missing_id == missing_id
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
        resolution = MissingPersonDetectionModification(
            detection_id=detection_id,
            missing_id=missing_id,
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
        "missingId": detection.missing_id,
        "isResolved": True,
        "resolvedAt": resolution.resolved_at.isoformat() if resolution.resolved_at else None,
        "message": "해결완료 처리되었습니다"
    }


@router.get("/missing-person/stats", response_model=dict)
async def get_missing_person_stats(
    year: Optional[int] = Query(None, description="년도 (예: 2024)"),
    month: Optional[int] = Query(None, description="월 (1-12)"),
    current_user: User = Depends(require_police_admin),
    web_db: Session = Depends(get_web_db)
):
    """
    실종자 통계 조회
    - 오늘 탐지 건수
    - 월간 탐지 건수 (선택한 년도/월 기준, 없으면 이번 달)
    """
    # 오늘 날짜
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 오늘 탐지 건수 (detection_success = true인 것만 카운트)
    today_count = web_db.query(func.count(MissingPersonDetectionMart.detection_id)).filter(
        MissingPersonDetectionMart.detected_time >= today,
        MissingPersonDetectionMart.detection_success == 1
    ).scalar() or 0
    
    # 월간 탐지 건수 계산
    if year and month:
        first_day_of_month = datetime(year, month, 1, 0, 0, 0)
        if month == 12:
            last_day_of_month = datetime(year + 1, 1, 1, 0, 0, 0)
        else:
            last_day_of_month = datetime(year, month + 1, 1, 0, 0, 0)
    else:
        first_day_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if datetime.now().month == 12:
            last_day_of_month = datetime(datetime.now().year + 1, 1, 1, 0, 0, 0)
        else:
            last_day_of_month = datetime(datetime.now().year, datetime.now().month + 1, 1, 0, 0, 0)
    
    # 월간 탐지 건수
    monthly_count = web_db.query(func.count(MissingPersonDetectionMart.detection_id)).filter(
        MissingPersonDetectionMart.detected_time.isnot(None),
        MissingPersonDetectionMart.detected_time >= first_day_of_month,
        MissingPersonDetectionMart.detected_time < last_day_of_month,
        MissingPersonDetectionMart.detection_success == 1
    ).scalar() or 0
    
    # 해결완료 건수
    resolved_count = web_db.query(func.count(MissingPersonDetectionModification.id)).filter(
        MissingPersonDetectionModification.is_resolved == True,
        MissingPersonDetectionModification.resolved_at >= first_day_of_month,
        MissingPersonDetectionModification.resolved_at < last_day_of_month
    ).scalar() or 0
    
    return {
        "missingToday": today_count,
        "missingMonthly": monthly_count,
        "resolvedCount": resolved_count
    }

