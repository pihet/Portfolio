from fastapi import Request
from sqlalchemy.orm import Session
from app.models.user_log import UserLog, LogStatus
from app.models.user import User
from app.database import WebSessionLocal
from datetime import datetime


def get_client_ip(request: Request) -> str:
    """클라이언트 IP 주소 가져오기"""
    if request.client:
        return request.client.host
    return "unknown"


def log_user_action(
    db: Session,
    action: str,
    status: LogStatus = LogStatus.SUCCESS,
    user: User = None,
    username: str = None,
    ip_address: str = None,
    details: str = None
):
    """사용자 액션 로그 기록 (독립 세션 사용)"""
    # 독립 세션을 사용하여 메인 트랜잭션과 분리
    log_db = WebSessionLocal()
    try:
        # 한국 시간(KST)으로 현재 시간 설정
        now_kst = datetime.now()
        
        log = UserLog(
            user_id=user.id if user else None,
            username=username or (user.name if user else None),
            action=action,
            ip_address=ip_address,
            status=status,
            details=details,
            created_at=now_kst  # 명시적으로 현재 시간(한국 시간) 설정
        )
        log_db.add(log)
        log_db.commit()  # 독립 세션에서 커밋
        log_db.refresh(log)  # ID를 확실히 가져오기 위해 refresh
        print(f"[LOG] 로그 저장 성공: {action}, status={status.value}, user_id={log.user_id}, log_id={log.id}, created_at={log.created_at}")
    except Exception as e:
        log_db.rollback()  # 에러 발생 시 롤백
        print(f"[LOG ERROR] 로그 저장 실패: {action}, error={str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        log_db.close()  # 세션 닫기







