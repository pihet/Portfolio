from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.GENERAL
    organization: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class UserResponse(BaseModel):
    id: str  # frontend는 string으로 사용
    email: str
    name: Optional[str] = None
    role: str  # frontend는 string으로 사용
    organization: Optional[str] = None
    createdAt: str  # ISO format string
    
    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm_user(cls, user):
        """ORM User 객체를 UserResponse로 변환"""
        return cls(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=user.role.value,
            organization=user.organization,
            createdAt=user.created_at.isoformat() if user.created_at else ""
        )

