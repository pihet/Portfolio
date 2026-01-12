from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_web_db
from app.models.user import User, UserRole
from app.core.security import verify_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_web_db)
) -> User:
    """현재 로그인한 사용자 가져오기"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        print("No token provided")
        raise credentials_exception
    
    print(f"Token received: {token[:20]}...")  # 디버깅용 (처음 20자만)
    
    payload = verify_token(token)
    if payload is None:
        print("Token verification failed")
        raise credentials_exception
    
    user_id = payload.get("sub")
    if user_id is None:
        print("No 'sub' in payload")
        raise credentials_exception
    
    # user_id가 문자열일 수도 있으므로 정수로 변환
    try:
        user_id = int(user_id)
    except (ValueError, TypeError) as e:
        print(f"Invalid user_id format: {user_id}, error: {e}")
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        print(f"User not found with id: {user_id}")
        raise credentials_exception
    
    print(f"User authenticated: {user.email}, role: {user.role}")
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """활성화된 사용자만 허용"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_busan_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """부산시 관리자 권한 필요 (ADMIN)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def require_nts_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """국세청 관리자 권한 필요 (ADMIN + organization='nts')"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    if current_user.organization != "nts":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="국세청 관리자만 접근 가능합니다"
        )
    return current_user


def require_police_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """경찰청 관리자 권한 필요 (ADMIN + organization='police')"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    if current_user.organization != "police":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="경찰청 관리자만 접근 가능합니다"
        )
    return current_user


def require_system_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """시스템 관리자 권한 필요 (ADMIN)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

