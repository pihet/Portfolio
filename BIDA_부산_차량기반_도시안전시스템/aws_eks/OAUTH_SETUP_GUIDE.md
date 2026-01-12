# OAuth 설정 가이드

## 문제
OAuth 로그인이 400 Bad Request 오류를 발생시키는 이유는 Kubernetes에 OAuth 환경 변수가 설정되지 않았기 때문입니다.

## 해결 방법

### 1. Kubernetes Secrets에 OAuth 정보 추가

다음 명령어로 Kubernetes Secrets에 Google OAuth 정보를 추가하세요:

```bash
# AWS 세션 재인증
aws eks update-kubeconfig --name busan --region ap-northeast-2

# Google OAuth Client ID 추가 (실제 값으로 교체)
kubectl create secret generic backend-secrets \
  --from-literal=google-client-id='YOUR_GOOGLE_CLIENT_ID' \
  --from-literal=google-client-secret='YOUR_GOOGLE_CLIENT_SECRET' \
  --dry-run=client -o yaml | kubectl apply -f -

# 또는 기존 secret에 추가
kubectl patch secret backend-secrets --type='json' \
  -p='[{"op": "add", "path": "/data/google-client-id", "value": "'$(echo -n 'YOUR_GOOGLE_CLIENT_ID' | base64)'"}]'

kubectl patch secret backend-secrets --type='json' \
  -p='[{"op": "add", "path": "/data/google-client-id", "value": "'$(echo -n 'YOUR_GOOGLE_CLIENT_SECRET' | base64)'"}]'
```

**Windows PowerShell에서:**
```powershell
# Google OAuth Client ID와 Secret을 base64로 인코딩
$clientId = "YOUR_GOOGLE_CLIENT_ID"
$clientSecret = "YOUR_GOOGLE_CLIENT_SECRET"

$clientIdB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($clientId))
$clientSecretB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($clientSecret))

# Secret 업데이트 (기존 secret이 있는 경우)
kubectl patch secret backend-secrets --type='json' -p="[{\"op\": \"add\", \"path\": \"/data/google-client-id\", \"value\": \"$clientIdB64\"}]"
kubectl patch secret backend-secrets --type='json' -p="[{\"op\": \"add\", \"path\": \"/data/google-client-secret\", \"value\": \"$clientSecretB64\"}]"
```

### 2. Google Cloud Console 설정

1. **Google Cloud Console** 접속: https://console.cloud.google.com/apis/credentials
2. OAuth 2.0 클라이언트 ID 선택
3. **승인된 리디렉션 URI**에 다음 추가:
   ```
   http://a2a65752d9f8d41758a089addc05bbe4-829974124.ap-northeast-2.elb.amazonaws.com/api/oauth/callback
   ```

### 3. Backend Deployment 업데이트

`k8s/backend-deployment.yaml` 파일이 이미 업데이트되었습니다. 다음 명령어로 배포를 업데이트하세요:

```bash
kubectl apply -f k8s/backend-deployment.yaml

# Pod 재시작 확인
kubectl rollout restart deployment/backend-deployment
kubectl rollout status deployment/backend-deployment
```

### 4. 확인

1. Backend Pod 로그 확인:
   ```bash
   kubectl logs -l app=backend --tail=50
   ```

2. OAuth 상태 확인:
   ```bash
   # Backend Pod에 포트 포워딩
   kubectl port-forward svc/backend-service 8000:80
   
   # 브라우저에서 접속
   http://localhost:8000/api/oauth/status
   ```

## 참고

- OAuth 리다이렉트 URI는 Google Cloud Console에 등록된 것과 정확히 일치해야 합니다.
- Frontend URL이 변경되면 `CORS_ORIGINS`, `FRONTEND_URL`, `OAUTH_REDIRECT_URI`도 함께 업데이트해야 합니다.
- Secret을 업데이트한 후에는 Backend Pod를 재시작해야 합니다.

