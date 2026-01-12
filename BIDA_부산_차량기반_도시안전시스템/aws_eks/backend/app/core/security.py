from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from app.core.config import settings
import hashlib
import bcrypt

# passlib 대신 bcrypt를 직접 사용하여 초기화 문제 방지


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    # 저장 시와 동일하게 SHA-256으로 먼저 해시
    password_bytes = plain_password.encode('utf-8')
    password_hash = hashlib.sha256(password_bytes).hexdigest()
    # bcrypt를 직접 사용하여 검증
    try:
        # hashed_password가 이미 문자열이면 bytes로 변환
        if isinstance(hashed_password, str):
            hashed_password_bytes = hashed_password.encode('utf-8')
        else:
            hashed_password_bytes = hashed_password
        
        return bcrypt.checkpw(password_hash.encode('utf-8'), hashed_password_bytes)
    except Exception as e:
        print(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """비밀번호 해싱"""
    # bcrypt는 72바이트를 초과할 수 없으므로, 
    # 항상 SHA-256으로 먼저 해시한 후 bcrypt로 해시 (안전하고 일관성 유지)
    password_bytes = password.encode('utf-8')
    # SHA-256으로 먼저 해시 (항상 64자 hex 문자열 = 64바이트)
    password_hash = hashlib.sha256(password_bytes).hexdigest()
    # bcrypt를 직접 사용하여 해시
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_hash.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """JWT 토큰 생성"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """JWT 토큰 검증"""
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True}  # 만료 시간 검증 명시
        )
        return payload
    except JWTError as e:
        # jose 라이브러리의 JWTError는 여러 하위 예외를 포함
        error_type = type(e).__name__
        error_msg = str(e)
        
        if "expired" in error_msg.lower() or "ExpiredSignatureError" in error_type:
            print(f"JWT token has expired: {error_msg}")
        elif "claims" in error_msg.lower() or "JWTClaimsError" in error_type:
            print(f"JWT claims error: {error_msg}")
        else:
            print(f"JWT verification failed: {error_type}: {error_msg}")
        return None
    except Exception as e:
        print(f"Token verification error: {type(e).__name__}: {e}")
        return None

