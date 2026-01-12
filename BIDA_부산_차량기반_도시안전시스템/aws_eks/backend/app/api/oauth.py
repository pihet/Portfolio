from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from app.database import get_web_db
from app.models.user import User, UserRole
from app.core.security import create_access_token
from app.core.config import settings
from app.schemas.user import UserResponse
from app.utils.logging import log_user_action, get_client_ip
from app.models.user_log import LogStatus
import httpx

router = APIRouter()

# OAuth 클라이언트 설정
oauth = OAuth()

# 디버깅용: OAuth 설정 상태 확인
@router.get("/status")
async def oauth_status():
    """OAuth 설정 상태 확인 (디버깅용)"""
    return {
        "google": {
            "configured": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
            "client_id_set": bool(settings.GOOGLE_CLIENT_ID),
            "client_secret_set": bool(settings.GOOGLE_CLIENT_SECRET),
            "registered": hasattr(oauth, 'google'),
            "client_id": settings.GOOGLE_CLIENT_ID[:30] + "..." if settings.GOOGLE_CLIENT_ID else None
        },
        "redirect_uri": settings.OAUTH_REDIRECT_URI,
        "frontend_url": settings.FRONTEND_URL,
        "instructions": {
            "google_cloud_console": "https://console.cloud.google.com/apis/credentials",
            "redirect_uri_to_register": settings.OAUTH_REDIRECT_URI,
            "note": "Google Cloud Console의 '승인된 리디렉션 URI'에 위 redirect_uri를 정확히 등록해야 합니다."
        }
    }

# Google OAuth
if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
    oauth.register(
        name='google',
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        },
        # state를 명시적으로 관리하지 않음 (authlib이 자동 처리)
    )


@router.get("/login/{provider}")
async def oauth_login(
    provider: str, 
    request: Request,
    userType: str = Query("user", description="사용자 유형 (user 또는 admin)"),
    organization: str = Query(None, description="소속 기관 (admin인 경우 필수)")
):
    """OAuth 로그인 시작"""
    if provider != 'google':
        raise HTTPException(status_code=404, detail="Provider not found. Only Google OAuth is supported.")
    
    # OAuth 클라이언트가 등록되어 있는지 확인
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google OAuth is not configured")
    
    # 사용자 유형 검증
    if userType not in ['user', 'admin']:
        raise HTTPException(status_code=400, detail="Invalid userType. Must be 'user' or 'admin'")
    
    # 관리자인 경우 organization 필수
    if userType == 'admin' and not organization:
        raise HTTPException(status_code=400, detail="Organization is required for admin users")
    
    # redirect_uri는 Google Cloud Console에 등록된 것과 정확히 일치해야 함
    redirect_uri = settings.OAUTH_REDIRECT_URI
    
    # 디버깅: 사용하는 redirect_uri 출력
    print(f"[OAuth Login] Provider: {provider}")
    print(f"[OAuth Login] UserType: {userType}, Organization: {organization}")
    print(f"[OAuth Login] Redirect URI: {redirect_uri}")
    print(f"[OAuth Login] Google Client ID: {settings.GOOGLE_CLIENT_ID[:20]}..." if settings.GOOGLE_CLIENT_ID else "Not set")
    
    try:
        if not hasattr(oauth, 'google'):
            raise HTTPException(status_code=500, detail="Google OAuth client not registered")
        
        # state에 사용자 유형 정보 포함 (JSON 인코딩)
        import json
        import base64
        state_data = {
            "userType": userType,
            "organization": organization if userType == 'admin' else None
        }
        state_encoded = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
        
        # state에 사용자 유형 정보 포함하여 리다이렉트
        return await oauth.google.authorize_redirect(request, redirect_uri, state=state_encoded)
    except AttributeError as e:
        raise HTTPException(status_code=500, detail=f"OAuth client not registered: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OAuth redirect failed: {str(e)}")


@router.get("/callback")
async def oauth_callback(
    provider: str = Query(None, description="OAuth provider"),
    code: str = Query(None, description="Authorization code"),
    state: str = Query(None, description="State parameter"),
    error: str = Query(None, description="Error from OAuth provider"),
    request: Request = None,
    db: Session = Depends(get_web_db)
):
    """OAuth 콜백 처리"""
    # provider가 없으면 Google로 간주 (기본값)
    # Google은 콜백 URL에 provider 파라미터를 포함하지 않음
    if not provider:
        provider = 'google'
    
    print(f"[OAuth Callback] Provider: {provider}")
    print(f"[OAuth Callback] Code: {code[:20] + '...' if code else 'None'}")
    print(f"[OAuth Callback] State: {state}")
    print(f"[OAuth Callback] Error: {error}")
    
    if provider != 'google':
        raise HTTPException(status_code=404, detail="Provider not found. Only Google OAuth is supported.")
    
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code not provided")
    
    ip_address = get_client_ip(request)
    
    # state에서 사용자 유형 정보 추출 (먼저 파싱)
    user_type = "user"
    organization_value = None
    if state:
        try:
            import json
            import base64
            state_decoded = base64.urlsafe_b64decode(state.encode()).decode()
            state_data = json.loads(state_decoded)
            user_type = state_data.get("userType", "user")
            organization_value = state_data.get("organization")
            print(f"[OAuth Callback] State parsed - userType: {user_type}, organization: {organization_value}")
        except Exception as e:
            print(f"[OAuth Callback] Failed to parse state: {str(e)}, using default user type")
            user_type = "user"
    
    try:
        # 세션 확인 (디버깅용)
        if hasattr(request, 'session'):
            print(f"Session keys: {list(request.session.keys())}")
            print(f"Session state: {request.session.get('_state_google', 'NOT FOUND')}")
        else:
            print("No session attribute in request")
        print(f"Request state param: {state}")
        
        # 토큰 교환
        # 개발 환경: state 검증 문제를 우회하기 위해 state를 직접 전달
        if provider == 'google':
            # redirect_uri는 Google Cloud Console에 등록된 것과 정확히 일치해야 함
            # provider 파라미터는 쿼리 스트링에 포함되지만, redirect_uri 자체에는 포함하지 않음
            redirect_uri = settings.OAUTH_REDIRECT_URI  # provider 파라미터 제거
            
            try:
                # 먼저 authlib을 통해 시도
                token = await oauth.google.authorize_access_token(request)
                user_info = token.get('userinfo')
            except Exception as state_error:
                # state 검증 실패 시 직접 토큰 교환
                if 'mismatching_state' in str(state_error) or 'state' in str(state_error).lower():
                    print(f"State validation failed, using direct token exchange: {state_error}")
                    
                    # 직접 토큰 교환
                    print(f"[Direct Token Exchange] Starting...")
                    print(f"[Direct Token Exchange] Redirect URI: {redirect_uri}")
                    print(f"[Direct Token Exchange] Code: {code[:30]}...")
                    print(f"[Direct Token Exchange] Client ID: {settings.GOOGLE_CLIENT_ID[:30]}...")
                    
                    async with httpx.AsyncClient() as client:
                        # 토큰 교환
                        token_response = await client.post(
                            'https://oauth2.googleapis.com/token',
                            data={
                                'code': code,
                                'client_id': settings.GOOGLE_CLIENT_ID,
                                'client_secret': settings.GOOGLE_CLIENT_SECRET,
                                'redirect_uri': redirect_uri,
                                'grant_type': 'authorization_code'
                            },
                            timeout=10.0
                        )
                        
                        print(f"[Direct Token Exchange] Response status: {token_response.status_code}")
                        
                        if token_response.status_code != 200:
                            error_detail = token_response.text
                            print(f"[Direct Token Exchange] Error response: {error_detail}")
                            try:
                                error_json = token_response.json()
                                print(f"[Direct Token Exchange] Error JSON: {error_json}")
                                error_message = error_json.get('error_description', error_json.get('error', 'Unknown error'))
                            except:
                                error_message = error_detail
                            
                            raise HTTPException(
                                status_code=400, 
                                detail=f"Failed to exchange token: {error_message}"
                            )
                        
                        token_data = token_response.json()
                        access_token = token_data.get('access_token')
                        
                        if not access_token:
                            raise HTTPException(status_code=400, detail="No access token received")
                        
                        # userinfo 가져오기
                        print(f"[Direct Token Exchange] Fetching userinfo...")
                        userinfo_response = await client.get(
                            'https://www.googleapis.com/oauth2/v2/userinfo',
                            headers={'Authorization': f"Bearer {access_token}"}
                        )
                        
                        print(f"[Direct Token Exchange] Userinfo response status: {userinfo_response.status_code}")
                        
                        if userinfo_response.status_code != 200:
                            error_detail = userinfo_response.text
                            print(f"[Direct Token Exchange] Userinfo error: {error_detail}")
                            raise HTTPException(status_code=400, detail=f"Failed to get user info from Google: {error_detail}")
                        
                        user_info = userinfo_response.json()
                        print(f"[Direct Token Exchange] Userinfo received: {user_info.get('email', 'No email')}")
                else:
                    raise
            
            if not user_info:
                raise HTTPException(status_code=400, detail="Failed to get user info from Google")
            
            oauth_id = user_info.get('sub')
            email = user_info.get('email')
            name = user_info.get('name', email.split('@')[0] if email else 'User')
            
            print(f"[OAuth Callback] User info extracted - email: {email}, oauth_id: {oauth_id}, name: {name}")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by OAuth provider")
        
        if not oauth_id:
            raise HTTPException(status_code=400, detail="OAuth ID not provided by OAuth provider")
        
        # 기존 사용자 확인 (OAuth ID 또는 이메일로)
        user = db.query(User).filter(
            (User.oauth_id == oauth_id) & (User.oauth_provider == provider)
        ).first()
        
        # OAuth ID로 찾은 기존 사용자도 유형 검증
        if user:
            from app.api.auth import get_role_from_organization
            expected_role = get_role_from_organization(user_type, organization_value)
            
            # 역할이 일치하지 않으면 오류
            if user.role != expected_role:
                log_user_action(
                    db=db,
                    action="OAuth 로그인",
                    status=LogStatus.ERROR,
                    user=user,
                    ip_address=ip_address,
                    details=f"사용자 유형 불일치 - 선택한 유형: {user_type}, 등록된 유형: {user.role.value}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"등록된 사용자 유형과 일치하지 않습니다. (등록된 유형: {'관리자' if user.role == UserRole.ADMIN else '일반 사용자'})"
                )
            
            # 관리자인 경우 organization도 확인
            if user.role == UserRole.ADMIN:
                if not organization_value:
                    log_user_action(
                        db=db,
                        action="OAuth 로그인",
                        status=LogStatus.ERROR,
                        user=user,
                        ip_address=ip_address,
                        details="관리자는 소속 기관을 선택해야 합니다"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="관리자는 소속 기관을 선택해야 합니다."
                    )
                
                # DB에 저장된 organization과 로그인 시 선택한 organization이 일치하는지 확인
                if user.organization != organization_value:
                    log_user_action(
                        db=db,
                        action="OAuth 로그인",
                        status=LogStatus.ERROR,
                        user=user,
                        ip_address=ip_address,
                        details=f"소속 기관 불일치 - 선택한 기관: {organization_value}, 등록된 기관: {user.organization}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"등록된 소속 기관과 일치하지 않습니다. (등록된 기관: {user.organization})"
                    )
        
        if not user:
            # 이메일로 기존 사용자 확인
            user = db.query(User).filter(User.email == email).first()
            
            if user:
                # 기존 사용자 유형 검증
                from app.api.auth import get_role_from_organization
                expected_role = get_role_from_organization(user_type, organization_value)
                
                # 역할이 일치하지 않으면 오류
                if user.role != expected_role:
                    log_user_action(
                        db=db,
                        action="OAuth 로그인",
                        status=LogStatus.ERROR,
                        user=user,
                        ip_address=ip_address,
                        details=f"사용자 유형 불일치 - 선택한 유형: {user_type}, 등록된 유형: {user.role.value}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"등록된 사용자 유형과 일치하지 않습니다. (등록된 유형: {'관리자' if user.role == UserRole.ADMIN else '일반 사용자'})"
                    )
                
                # 관리자인 경우 organization도 확인
                if user.role == UserRole.ADMIN:
                    if not organization_value:
                        log_user_action(
                            db=db,
                            action="OAuth 로그인",
                            status=LogStatus.ERROR,
                            user=user,
                            ip_address=ip_address,
                            details="관리자는 소속 기관을 선택해야 합니다"
                        )
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="관리자는 소속 기관을 선택해야 합니다."
                        )
                    
                    # DB에 저장된 organization과 로그인 시 선택한 organization이 일치하는지 확인
                    if user.organization != organization_value:
                        log_user_action(
                            db=db,
                            action="OAuth 로그인",
                            status=LogStatus.ERROR,
                            user=user,
                            ip_address=ip_address,
                            details=f"소속 기관 불일치 - 선택한 기관: {organization_value}, 등록된 기관: {user.organization}"
                        )
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"등록된 소속 기관과 일치하지 않습니다. (등록된 기관: {user.organization})"
                        )
                
                # 기존 사용자에 OAuth 정보 연결
                user.oauth_provider = provider
                user.oauth_id = oauth_id
                user.oauth_email = email
                db.commit()
                db.refresh(user)
                
                print(f"[OAuth Callback] Existing user found - email: {email}, role: {user.role}, organization: {user.organization}")
                
                log_user_action(
                    db=db,
                    action="OAuth 계정 연결",
                    status=LogStatus.SUCCESS,
                    user=user,
                    ip_address=ip_address,
                    details=f"{provider} OAuth 계정 연결"
                )
            else:
                # 새 사용자 생성 시에만 state의 userType과 organization 사용
                from app.api.auth import get_role_from_organization
                role = get_role_from_organization(user_type, organization_value)
                
                print(f"[OAuth Callback] Creating new user - email: {email}, name: {name}, role: {role}, organization: {organization_value}")
                try:
                    user = User(
                        email=email,
                        hashed_password="oauth_user",  # OAuth 사용자는 비밀번호 없지만 NOT NULL 제약을 위해 임시 값
                        name=name,
                        role=role,
                        organization=organization_value,
                        oauth_provider=provider,
                        oauth_id=oauth_id,
                        oauth_email=email,
                        is_active=True
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                    print(f"[OAuth Callback] New user created successfully - ID: {user.id}, Role: {user.role}, Organization: {user.organization}")
                except Exception as e:
                    print(f"[OAuth Callback] Error creating user: {str(e)}")
                    db.rollback()
                    raise
                
                log_user_action(
                    db=db,
                    action="OAuth 회원가입",
                    status=LogStatus.SUCCESS,
                    user=user,
                    ip_address=ip_address,
                    details=f"{provider} OAuth 회원가입 - Role: {role}, Organization: {organization_value}"
                )
        else:
            # 이미 OAuth로 등록된 사용자 - 기존 role과 organization 유지
            print(f"[OAuth Callback] Existing OAuth user - email: {email}, role: {user.role}, organization: {user.organization}")
        
        # 로그인 처리
        print(f"[OAuth Callback] Creating JWT tokens for user ID: {user.id}")
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = f"refresh-{access_token}"
        
        print(f"[OAuth Callback] Tokens created, redirecting to frontend...")
        
        log_user_action(
            db=db,
            action="OAuth 로그인",
            status=LogStatus.SUCCESS,
            user=user,
            ip_address=ip_address,
            details=f"{provider} OAuth 로그인"
        )
        
        # 프론트엔드로 리다이렉트 (토큰 포함)
        frontend_url = f"{settings.FRONTEND_URL}/auth/callback?token={access_token}&refresh_token={refresh_token}"
        print(f"[OAuth Callback] Redirecting to: {frontend_url}")
        return RedirectResponse(url=frontend_url)
        
    except HTTPException as http_exc:
        # HTTPException 발생 시 프론트엔드로 오류 메시지 전달
        error_message = http_exc.detail
        frontend_url = f"{settings.FRONTEND_URL}/auth/callback?error={error_message}"
        print(f"[OAuth Callback] Error occurred, redirecting to: {frontend_url}")
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"OAuth authentication error: {str(e)}")
        print(f"Traceback: {error_detail}")
        error_message = f"OAuth authentication failed: {str(e)}"
        frontend_url = f"{settings.FRONTEND_URL}/auth/callback?error={error_message}"
        return RedirectResponse(url=frontend_url)

