from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db, get_web_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.core.security import verify_password, get_password_hash
from datetime import datetime

router = APIRouter()


@router.get("/me", response_model=dict)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """현재 로그인한 사용자 정보 조회"""
    user_response = UserResponse.from_orm_user(current_user)
    return user_response.dict()


@router.put("/me", response_model=dict)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_web_db)
):
    """현재 사용자 정보 수정"""
    # 비밀번호 변경 처리
    if user_update.new_password:
        if not user_update.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="현재 비밀번호를 입력해주세요"
            )
        
        # OAuth 사용자는 비밀번호 변경 불가
        if current_user.oauth_provider:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"OAuth 로그인 사용자는 비밀번호를 변경할 수 없습니다"
            )
        
        # 현재 비밀번호 확인
        if not verify_password(user_update.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="현재 비밀번호가 일치하지 않습니다"
            )
        
        # 새 비밀번호로 업데이트
        current_user.hashed_password = get_password_hash(user_update.new_password)
    
    # 이름 수정
    if user_update.name is not None:
        current_user.name = user_update.name
    
    # 이메일 수정
    if user_update.email is not None:
        # 이메일 중복 확인
        existing = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        current_user.email = user_update.email
    
    # updated_at 수동 업데이트 (onupdate가 자동으로 처리하지만 명시적으로 설정)
    current_user.updated_at = datetime.now()
    
    db.commit()
    db.refresh(current_user)
    user_response = UserResponse.from_orm_user(current_user)
    return user_response.dict()

