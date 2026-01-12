from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_web_db
from app.models.user import User, UserRole
from app.models.user_log import LogStatus
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse
from app.core.security import verify_password, get_password_hash, create_access_token
from app.utils.logging import log_user_action, get_client_ip
from app.api.deps import get_current_user

router = APIRouter()


class LogActionRequest(BaseModel):
    action: str
    details: Optional[str] = None


def get_role_from_organization(user_type: str, organization: str = None) -> UserRole:
    """userType으로 UserRole 결정 (GENERAL 또는 ADMIN)"""
    if user_type == "admin":
        return UserRole.ADMIN
    else:
        return UserRole.GENERAL


@router.post("/register", response_model=dict)
async def register(
    request: RegisterRequest,
    http_request: Request,
    db: Session = Depends(get_web_db)
):
    """회원가입"""
    # 이메일 중복 확인
    existing_email = db.query(User).filter(User.email == request.email).first()
    if existing_email:
        # 로그 기록 (실패)
        log_user_action(
            db=db,
            action="회원가입",
            status=LogStatus.ERROR,
            username=request.email,
            ip_address=get_client_ip(http_request),
            details="이메일 중복"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # 역할 결정
    role = get_role_from_organization(request.role, request.organization)
    
    # 사용자 생성
    hashed_password = get_password_hash(request.password)
    user = User(
        email=request.email,    # email만 고유해야 함
        hashed_password=hashed_password,
        name=request.name,
        role=role,
        organization=request.organization
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # 로그 기록 (성공)
    log_user_action(
        db=db,
        action="회원가입",
        status=LogStatus.SUCCESS,
        user=user,
        ip_address=get_client_ip(http_request)
    )
    
    # 토큰 생성 (JWT 표준에 따라 sub는 문자열이어야 함)
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = f"refresh-{access_token}"
    
    # 사용자 정보 반환
    user_response = UserResponse.from_orm_user(user)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_response.dict()
    }


@router.post("/login", response_model=dict)
async def login(
    request: LoginRequest,
    http_request: Request,
    db: Session = Depends(get_web_db)
):
    """로그인"""
    user = db.query(User).filter(User.email == request.email).first()
    ip_address = get_client_ip(http_request)
    
    if not user:
        # 로그 기록 (실패 - 사용자 없음)
        log_user_action(
            db=db,
            action="로그인",
            status=LogStatus.ERROR,
            username=request.email,
            ip_address=ip_address,
            details="사용자 없음"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # OAuth 사용자인 경우 일반 로그인 불가
    if user.oauth_provider:
        log_user_action(
            db=db,
            action="로그인",
            status=LogStatus.ERROR,
            user=user,
            ip_address=ip_address,
            details=f"OAuth 사용자 ({user.oauth_provider})는 일반 로그인 불가"
        )
        provider_name = {
            'google': 'Google',
            'naver': 'Naver',
            'kakao': 'Kakao'
        }.get(user.oauth_provider, user.oauth_provider)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이 계정은 {provider_name} OAuth로 로그인해야 합니다. OAuth 버튼을 사용해주세요."
        )
    
    # 비밀번호 검증
    if not verify_password(request.password, user.hashed_password):
        # 로그 기록 (실패 - 비밀번호 오류)
        log_user_action(
            db=db,
            action="로그인",
            status=LogStatus.ERROR,
            user=user,
            ip_address=ip_address,
            details="비밀번호 오류"
        )
        print(f"Password verification failed for user: {user.email}")
        print(f"Stored hash: {user.hashed_password[:50]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        # 로그 기록 (실패 - 비활성 사용자)
        log_user_action(
            db=db,
            action="로그인",
            status=LogStatus.ERROR,
            user=user,
            ip_address=ip_address,
            details="비활성 사용자"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # 역할 및 소속 기관 확인
    # userType이 제공된 경우 DB에 저장된 정보와 일치하는지 확인
    if request.userType:
        expected_role = get_role_from_organization(request.userType, request.organization)
        
        # 역할이 일치하지 않으면 오류
        if user.role != expected_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"등록된 사용자 유형과 일치하지 않습니다. (등록된 유형: {'관리자' if user.role == UserRole.ADMIN else '일반 사용자'})"
            )
        
        # 관리자인 경우 organization도 확인
        if user.role == UserRole.ADMIN:
            if not request.organization:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="관리자는 소속 기관을 선택해야 합니다."
                )
            
            # DB에 저장된 organization과 로그인 시 선택한 organization이 일치하는지 확인
            if user.organization != request.organization:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"등록된 소속 기관과 일치하지 않습니다. (등록된 기관: {user.organization})"
                )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = f"refresh-{access_token}"
    
    # 로그 기록 (성공)
    log_user_action(
        db=db,
        action="로그인 성공",
        status=LogStatus.SUCCESS,
        user=user,
        ip_address=ip_address,
        details=f"사용자: {user.email}"
    )
    
    # 사용자 정보 반환
    user_response = UserResponse.from_orm_user(user)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_response.dict()
    }


@router.post("/log-action")
async def log_action(
    request: LogActionRequest,
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_web_db)
):
    """클라이언트에서 사용자 액션 로그 기록"""
    ip_address = get_client_ip(http_request)
    
    log_user_action(
        db=db,
        action=request.action,
        status=LogStatus.SUCCESS,
        user=current_user,
        ip_address=ip_address,
        details=request.details
    )
    
    return {"message": "Log recorded successfully"}
