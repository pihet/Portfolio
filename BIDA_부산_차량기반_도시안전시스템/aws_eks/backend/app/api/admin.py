from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import List, Optional
from datetime import datetime, date
from app.database import get_web_db, web_engine
from app.api.deps import require_system_admin
from app.models.user import User, UserRole
from app.models.user_log import UserLog, LogStatus
from app.schemas.user import UserResponse
from app.utils.logging import log_user_action, get_client_ip

router = APIRouter()


@router.get("/users", response_model=List[dict])
async def get_all_users(
    request: Request,
    search: Optional[str] = Query(None, description="검색어 (name, email)"),
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_web_db)
):
    """모든 사용자 조회 (시스템 관리자)"""
    query = db.query(User)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.name.like(search_term)) |
            (User.email.like(search_term))
        )
    
    users = query.all()
    result = []
    for user in users:
        user_dict = UserResponse.from_orm_user(user).dict()
        # 프론트엔드 형식에 맞게 필드명 변경
        user_dict['created_at'] = user.created_at.isoformat() if user.created_at else None
        user_dict['id'] = int(user_dict['id'])  # id를 숫자로 변환
        user_dict['is_active'] = user.is_active if hasattr(user, 'is_active') else True
        user_dict['updated_at'] = user.updated_at.isoformat() if user.updated_at else None
        result.append(user_dict)
    
    # 로그 기록: 검색어가 있을 때만 기록 (일반 조회는 로그 기록 안 함)
    if search:
        action = f"사용자 목록 조회 (검색: {search})"
        log_user_action(
            db=db,
            action=action,
            status=LogStatus.SUCCESS,
            user=current_user,
            ip_address=get_client_ip(request),
            details=f"조회된 사용자 수: {len(result)}"
        )
    
    return result


@router.get("/stats", response_model=dict)
async def get_system_stats(
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_web_db)
):
    """시스템 통계 조회 (데이터베이스 크기, API 요청 수 등)"""
    try:
        # 오늘의 API 요청 수 (로그 수)
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_logs_count = db.query(func.count(UserLog.id)).filter(
            UserLog.created_at >= today_start
        ).scalar() or 0
        
        # 데이터베이스 크기 및 테이블 수 조회
        db_size_mb = 0
        table_count = 0
        try:
            with web_engine.connect() as connection:
                # 데이터베이스 크기 조회 (MB)
                result = connection.execute(text("""
                    SELECT 
                        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                    FROM information_schema.tables 
                    WHERE table_schema = DATABASE()
                """))
                size_row = result.fetchone()
                if size_row and size_row[0]:
                    db_size_mb = float(size_row[0])
                
                # 테이블 수 조회
                result = connection.execute(text("""
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_schema = DATABASE()
                    AND table_type = 'BASE TABLE'
                """))
                table_row = result.fetchone()
                if table_row:
                    table_count = int(table_row[0])
        except Exception as e:
            print(f"데이터베이스 통계 조회 오류: {e}")
        
        return {
            "database_size_mb": round(db_size_mb, 2),
            "table_count": table_count,
            "today_api_requests": today_logs_count
        }
    except Exception as e:
        # 오류 발생 시 기본값 반환
        return {
            "database_size_mb": 0,
            "table_count": 0,
            "today_api_requests": 0
        }


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_web_db)
):
    """사용자 삭제 (시스템 관리자)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        log_user_action(
            db=db,
            action="사용자 삭제 시도",
            status=LogStatus.ERROR,
            user=current_user,
            ip_address=get_client_ip(request),
            details=f"사용자를 찾을 수 없음: user_id={user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # 자기 자신은 삭제 불가
    if user.id == current_user.id:
        log_user_action(
            db=db,
            action="사용자 삭제 시도",
            status=LogStatus.WARNING,
            user=current_user,
            ip_address=get_client_ip(request),
            details="자기 자신 삭제 시도"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    # 삭제 전 사용자 정보 저장
    deleted_user_email = user.email
    deleted_user_name = user.name
    
    # 관련 레코드 삭제 (외래키 제약조건 때문에 먼저 삭제 필요)
    from app.models.vehicle import Vehicle
    from app.models.user_vehicle_mapping import UserVehicleMapping
    
    # 사용자의 차량 삭제
    db.query(Vehicle).filter(Vehicle.user_id == user_id).delete(synchronize_session=False)
    
    # 사용자의 차량 매핑 삭제
    db.query(UserVehicleMapping).filter(UserVehicleMapping.user_id == user_id).delete(synchronize_session=False)
    
    # user_logs는 ON DELETE CASCADE로 설정되어 있으므로 자동 삭제됨
    # 하지만 명시적으로 삭제해도 됨 (선택사항)
    
    # 사용자 삭제
    db.delete(user)
    db.commit()
    
    # 로그 기록
    log_user_action(
        db=db,
        action="사용자 삭제",
        status=LogStatus.SUCCESS,
        user=current_user,
        ip_address=get_client_ip(request),
        details=f"삭제된 사용자: {deleted_user_name} ({deleted_user_email})"
    )
    
    return None


@router.put("/users/{user_id}/role", response_model=dict)
async def update_user_role(
    user_id: int,
    role: str,
    request: Request,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_web_db)
):
    """사용자 권한 변경 (시스템 관리자)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        log_user_action(
            db=db,
            action="사용자 권한 변경 시도",
            status=LogStatus.ERROR,
            user=current_user,
            ip_address=get_client_ip(request),
            details=f"사용자를 찾을 수 없음: user_id={user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # role 문자열을 UserRole enum으로 변환
    role_map = {
        "GENERAL": UserRole.GENERAL,
        "ADMIN": UserRole.ADMIN,
        "user": UserRole.GENERAL,  # 하위 호환성
        "admin": UserRole.ADMIN    # 하위 호환성
    }
    
    if role not in role_map:
        log_user_action(
            db=db,
            action="사용자 권한 변경 시도",
            status=LogStatus.ERROR,
            user=current_user,
            ip_address=get_client_ip(request),
            details=f"잘못된 권한 값: {role}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )
    
    old_role = user.role.value
    user.role = role_map[role]
    db.commit()
    db.refresh(user)
    
    user_response = UserResponse.from_orm_user(user)
    user_dict = user_response.dict()
    # 프론트엔드 형식에 맞게 필드명 변경
    user_dict['created_at'] = user.created_at.isoformat() if user.created_at else None
    user_dict['id'] = int(user_dict['id'])  # id를 숫자로 변환
    user_dict['is_active'] = user.is_active if hasattr(user, 'is_active') else True
    user_dict['updated_at'] = user.updated_at.isoformat() if user.updated_at else None
    
    # 로그 기록
    log_user_action(
        db=db,
        action="사용자 권한 변경",
        status=LogStatus.SUCCESS,
        user=current_user,
        ip_address=get_client_ip(request),
        details=f"사용자: {user.name} ({user.email}), 권한 변경: {old_role} → {role}"
    )
    
    return user_dict


@router.get("/logs", response_model=List[dict])
async def get_user_logs(
    request: Request,
    search: Optional[str] = Query(None, description="검색어 (username, action, ip)"),
    status_filter: Optional[str] = Query(None, description="상태 필터 (success, error, warning)"),
    start_date: Optional[datetime] = Query(None, description="시작 날짜"),
    end_date: Optional[datetime] = Query(None, description="종료 날짜"),
    limit: int = Query(50, description="최대 조회 개수 (최대 50)"),
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_web_db)
):
    """사용자 로그 조회 (시스템 관리자) - 최신 로그 50개만 조회 (DB에는 모든 로그 저장)"""
    # 항상 최신 50개만 가져옴 (DB에 저장은 계속되지만, 표시는 최신 50개만)
    max_limit = 50
    actual_limit = min(limit, max_limit) if limit else max_limit
    
    query = db.query(UserLog)
    
    # 날짜 필터는 서버 사이드에서 적용
    if start_date:
        query = query.filter(UserLog.created_at >= start_date)
    if end_date:
        query = query.filter(UserLog.created_at <= end_date)
    
    # 최신 순으로 정렬하고 50개로 제한
    logs = query.order_by(UserLog.created_at.desc()).limit(actual_limit).all()
    
    # 검색 및 상태 필터는 클라이언트 사이드에서 적용 (서버에서 이미 날짜 필터링 완료)
    if search or status_filter:
        filtered_logs = []
        for log in logs:
            # 검색 필터
            if search:
                search_lower = search.lower()
                username_match = log.username and search_lower in log.username.lower()
                action_match = search_lower in log.action.lower()
                ip_match = log.ip_address and search_lower in log.ip_address
                if not (username_match or action_match or ip_match):
                    continue
            
            # 상태 필터
            if status_filter:
                if log.status.value.upper() != status_filter.upper():
                    continue
            
            filtered_logs.append(log)
        logs = filtered_logs
    
    # 필터 정보 수집
    filter_details = []
    if search:
        filter_details.append(f"검색: {search}")
    if status_filter:
        filter_details.append(f"상태: {status_filter}")
    if start_date:
        filter_details.append(f"시작일: {start_date.strftime('%Y-%m-%d')}")
    if end_date:
        filter_details.append(f"종료일: {end_date.strftime('%Y-%m-%d')}")
    filter_details.append(f"제한: {actual_limit}")
    
    # user_id를 통해 users 테이블에서 email 가져오기
    result = []
    for log in logs:
        email = None
        if log.user_id:
            user = db.query(User).filter(User.id == log.user_id).first()
            if user:
                email = user.email
        
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "username": log.username or "알 수 없음",
            "email": email or "알 수 없음",
            "action": log.action,
            "timestamp": log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else None,
            "ip": log.ip_address or "알 수 없음",
            "status": log.status.value,
            "details": log.details
        })
    
    # 로그 기록 (데이터 반환 후에 수행하여 커밋이 확실히 저장되도록)
    action = "로그 조회" + (f" ({', '.join(filter_details)})" if filter_details else "")
    log_user_action(
        db=db,
        action=action,
        status=LogStatus.SUCCESS,
        user=current_user,
        ip_address=get_client_ip(request),
        details=f"조회된 로그 수: {len(logs)}"
    )
    
    return result

