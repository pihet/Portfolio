from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    userType: Optional[str] = None  # 'user' | 'admin'
    organization: Optional[str] = None  # 'busan' | 'nts' | 'police' | 'system'


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "user"  # 'user' | 'admin'
    organization: Optional[str] = None  # 'busan' | 'nts' | 'police' | 'system'


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"

