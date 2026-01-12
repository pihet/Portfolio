# DBeaver에서 MariaDB 서버 재시작 가이드

## ⚠️ 중요
**DBeaver는 데이터베이스 클라이언트 도구이므로, 서버 자체를 재시작할 수 없습니다.**  
서버 재시작은 Windows 서비스나 명령줄에서 해야 합니다.

## 방법 1: 배치 파일 사용 (가장 쉬움)

1. `backend/restart_mariadb.bat` 파일을 **우클릭**
2. **"관리자 권한으로 실행"** 선택
3. 자동으로 MariaDB/MySQL 서비스를 찾아서 재시작합니다

## 방법 2: Windows 서비스 관리자 사용

1. `Win + R` 키를 눌러 실행 창 열기
2. `services.msc` 입력 후 Enter
3. 다음 중 하나를 찾기:
   - **MariaDB**
   - **MySQL**
   - **MySQL80**
4. 서비스를 **우클릭** → **"다시 시작"** 선택

## 방법 3: PowerShell (관리자 권한)

1. PowerShell을 **관리자 권한으로 실행**
2. 다음 명령 실행:

```powershell
# MariaDB인 경우
Restart-Service -Name MariaDB

# MySQL인 경우
Restart-Service -Name MySQL

# MySQL80인 경우
Restart-Service -Name MySQL80
```

## 방법 4: 명령 프롬프트 (관리자 권한)

1. 명령 프롬프트를 **관리자 권한으로 실행**
2. 다음 명령 실행:

```cmd
# MariaDB인 경우
net stop MariaDB
net start MariaDB

# MySQL인 경우
net stop MySQL
net start MySQL
```

## DBeaver에서 확인할 수 있는 것

### 1. 인증 플러그인 확인

DBeaver에서 다음 SQL을 실행:

```sql
-- 현재 root 사용자의 인증 플러그인 확인
SELECT user, host, plugin 
FROM mysql.user 
WHERE user = 'root';
```

모든 항목이 `mysql_native_password`로 나와야 합니다.

### 2. 연결 테스트

1. DBeaver에서 데이터베이스 연결을 **우클릭**
2. **"연결 테스트"** 선택
3. 연결이 성공하는지 확인

### 3. 서버 재시작 후 연결 확인

서버를 재시작한 후:
1. DBeaver에서 연결을 **우클릭**
2. **"연결 편집"** 선택
3. **"연결 테스트"** 버튼 클릭
4. 연결이 성공하면 정상입니다

## 서비스 이름 확인 방법

서비스 이름을 모르는 경우:

```cmd
# PowerShell에서
Get-Service | Where-Object {$_.Name -like "*mysql*" -or $_.Name -like "*mariadb*"}

# 명령 프롬프트에서
sc query | findstr /i "mysql mariadb"
```

## 재시작 후 확인 사항

1. ✅ MariaDB 서버 재시작 완료
2. ✅ FastAPI 서버 재시작
3. ✅ 회원가입/로그인 테스트

## 문제 해결

만약 서비스를 찾을 수 없다면:
- MariaDB가 서비스로 설치되지 않았을 수 있습니다
- 수동으로 설치된 경우, 설치 경로에서 직접 재시작해야 할 수 있습니다
- 또는 MariaDB가 다른 이름으로 설치되어 있을 수 있습니다


