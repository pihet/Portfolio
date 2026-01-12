// API URL 자동 감지: 환경 변수가 있으면 사용, 없으면 현재 호스트 기반으로 자동 설정
export const getApiBaseUrl = (): string => {
  // 현재 페이지의 호스트를 기반으로 API URL 생성
  const hostname = window.location.hostname;
  
  // localhost가 아니면 프로덕션 환경 (Nginx가 /api를 프록시)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return '/api'; // 프로덕션: Nginx가 /api를 백엔드로 프록시
  }
  
  // 개발 환경: 환경 변수가 있으면 사용, 없으면 localhost
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  if (envApiUrl && envApiUrl.trim() !== '') {
    return envApiUrl;
  }
  
  // 기본값: localhost
  return 'http://localhost:8000';
};

// 매번 동적으로 계산하도록 함수로 사용
const getAPIBaseURL = () => getApiBaseUrl();

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getAPIBaseURL();
  let cleanEndpoint = endpoint;
  if (!cleanEndpoint.startsWith('/')) {
    cleanEndpoint = `/${cleanEndpoint}`;
  }
  
  // baseUrl이 /api이면 프로덕션 (Nginx가 /api를 프록시)
  // baseUrl이 http://로 시작하면 개발 환경
  let url: string;
  if (baseUrl === '/api') {
    // 프로덕션: /api/users/me 형태
    url = `${baseUrl}${cleanEndpoint}`;
  } else {
    // 개발 환경: http://localhost:8000/api/users/me 형태
    url = `${baseUrl}/api${cleanEndpoint}`;
  }
  
  console.log('API Request URL:', url); // 디버깅용
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // 토큰이 있으면 헤더에 추가
  const token = localStorage.getItem('accessToken');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
    console.log('Token added to request:', token.substring(0, 20) + '...');
  } else {
    console.warn('No access token found in localStorage');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      // 401 Unauthorized 오류 처리
      if (response.status === 401) {
        // 토큰이 만료되었거나 유효하지 않음
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        // 로그인 페이지로 리다이렉트
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
      }
      
      // 204 No Content는 본문이 없으므로 JSON 파싱 시도하지 않음
      if (response.status === 204) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    // 204 No Content 응답은 본문이 없으므로 null 반환
    if (response.status === 204) {
      return null as any;
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('Network error - 백엔드 서버가 실행 중인지 확인하세요:', url);
      throw new Error(`네트워크 오류: 백엔드 서버(${url})에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.`);
    }
    throw error;
  }
}

// Test 테이블 데이터 가져오기
export async function getTestData() {
  return apiRequest<any[]>('/test');  // /api 제거 (API_BASE_URL에 포함)
}

// Test 테이블 레코드 수 가져오기
export async function getTestCount() {
  return apiRequest<{ count: number }>('/test/count');  // /api 제거
}

// 안전운전관리 API
export interface SafeDrivingStats {
  activeVehicles: number;
  totalSessions: number;
  safetyRate: number;
  rapidAccelCount: number;
  rapidDecelCount: number;
  drowsyCount: number;
  month: number;
  year: number;
}

export interface DistrictSafeDriving {
  district: string;
  safetyScore: number;
  rapidAccelCount: number;
  rapidDecelCount: number;
  drowsyCount: number;
  sessionCount: number;
  totalIncidents: number;
  rank: number;
}

export interface DemographicsSafeDriving {
  category: string;
  ageGroup: string;
  gender: string;
  safetyScore: number;
  sessionCount: number;
  rapidAccelCount: number;
  rapidDecelCount: number;
  drowsyCount: number;
}

export interface HourlySafeDriving {
  hourRange: string;
  safetyRate: number;
  drivingCount: number;
  rapidAccelCount: number;
  rapidDecelCount: number;
  drowsyCount: number;
}

export async function getSafeDrivingStats(year?: number, month?: number): Promise<SafeDrivingStats> {
  const params = new URLSearchParams();
  if (year) params.append('year', year.toString());
  if (month) params.append('month', month.toString());
  const queryString = params.toString();
  return apiRequest<SafeDrivingStats>(`/city/safe-driving/stats${queryString ? `?${queryString}` : ''}`);
}

export async function getDistrictSafeDriving(month?: number): Promise<DistrictSafeDriving[]> {
  const params = month ? `?month=${month}` : '';
  return apiRequest<DistrictSafeDriving[]>(`/city/safe-driving/districts${params}`);
}

export async function getDemographicsSafeDriving(month?: number): Promise<DemographicsSafeDriving[]> {
  const params = month ? `?month=${month}` : '';
  return apiRequest<DemographicsSafeDriving[]>(`/city/safe-driving/demographics${params}`);
}

export async function getHourlySafeDriving(month?: number): Promise<HourlySafeDriving[]> {
  const params = month ? `?month=${month}` : '';
  return apiRequest<HourlySafeDriving[]>(`/city/safe-driving/hourly${params}`);
}

export interface TopDrowsySession {
  sessionId: string | null;
  totalGazeClosure: number;
  detectionCount: number;
  month: number;
  year: number;
}

export async function getTopDrowsySession(month?: number): Promise<TopDrowsySession> {
  const params = month ? `?month=${month}` : '';
  return apiRequest<TopDrowsySession>(`/city/safe-driving/top-drowsy-session${params}`);
}

// 인증 API
export interface LoginRequest {
  email: string;
  password: string;
  userType?: string;
  organization?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    organization?: string;
  };
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: string;
  organization?: string;
}

export interface CurrentUserResponse {
  id: number;
  email: string;
  name: string;
  role: string;
  organization?: string;
  is_active: boolean;
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  return apiRequest<CurrentUserResponse>('/users/me');
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

export async function updateUser(data: UpdateUserRequest): Promise<CurrentUserResponse> {
  return apiRequest<CurrentUserResponse>('/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export interface RegisterResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    organization?: string;
  };
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const baseUrl = getAPIBaseURL();
  const loginUrl = baseUrl === '/api' 
    ? `${baseUrl}/auth/login`
    : `${baseUrl}/api/auth/login`;
  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  // 토큰을 localStorage에 저장
  if (data.access_token) {
    localStorage.setItem('accessToken', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('refreshToken', data.refresh_token);
    }
  }
  
  return data;
}

export async function register(credentials: RegisterRequest): Promise<RegisterResponse> {
  try {
    const baseUrl = getAPIBaseURL();
    const registerUrl = baseUrl === '/api' 
      ? `${baseUrl}/auth/register`
      : `${baseUrl}/api/auth/register`;
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // 토큰을 localStorage에 저장
    if (data.access_token) {
      localStorage.setItem('accessToken', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refreshToken', data.refresh_token);
      }
    }
    
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.');
    }
    throw error;
  }
}

// 일반 사용자 안전운전 점수 API
export interface MonthlySafetyScore {
  sessionId: string;
  carId: string;
  licensePlate?: string;
  startTime: string | null;
  endTime: string | null;
  safetyScore: number;
  totalPenalty: number;
  drowsyPenalty: number;
  rapidPenalty: number;
  gazeClosureCount: number;
  headDropCount: number;
  yawnFlagCount: number;
}

export interface SessionSafetyDetail extends MonthlySafetyScore {
  drowsyDetails: Array<{
    drowsyId: string;
    detectedAt: string | null;
    durationSec: number | null;
    penalty: number;
    gazeClosure: number | null;
    headDrop: number | null;
    yawnFlag: number | null;
  }>;
  rapidDetails: Array<{
    timeGroup: string;
    rapidCount: number;
    penalty: number;
  }>;
}

export async function getMonthlySafetyScores(
  year: number,
  month: number
): Promise<MonthlySafetyScore[]> {
  return apiRequest<MonthlySafetyScore[]>(
    `/user/safety-score/monthly?year=${year}&month=${month}`
  );
}

export async function getSessionSafetyDetail(
  sessionId: string
): Promise<SessionSafetyDetail> {
  return apiRequest<SessionSafetyDetail>(`/user/safety-score/session/${sessionId}`);
}


// 차량 등록 API
export interface RegisterVehicleRequest {
  license_plate: string;
  vehicle_type?: string;
}

export interface RegisterVehicleResponse {
  id: number;
  license_plate: string;
  vehicle_type: string;
  message: string;
}

export interface VehicleInfo {
  id: number;
  licensePlate: string;
  vehicleType: string;
  carId: string | null;
  createdAt: string | null;
}

export interface AvailableCarId {
  carId: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  sessionCount: number;
}

export async function registerVehicleByPlate(
  plateNumber: string,
  vehicleType: string = 'PRIVATE'
): Promise<RegisterVehicleResponse> {
  return apiRequest<RegisterVehicleResponse>('/vehicles/register', {
    method: 'POST',
    body: JSON.stringify({ 
      license_plate: plateNumber,
      vehicle_type: vehicleType
    }),
  });
}

export async function getUserVehicles(): Promise<VehicleInfo[]> {
  return apiRequest<VehicleInfo[]>('/vehicles');
}

export async function getAvailableCarIds(): Promise<AvailableCarId[]> {
  return apiRequest<AvailableCarId[]>('/vehicles/available-car-ids');
}

export async function deleteVehicle(vehicleId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/vehicles/${vehicleId}`, {
    method: 'DELETE',
  });
}

// 시스템 관리자 로그 조회
export interface LogEntry {
  id: number;
  user_id: number | null;
  username: string;
  email: string;
  action: string;
  timestamp: string;
  ip: string;
  status: 'success' | 'error' | 'warning';
  details?: string | null;
}

export interface GetLogsParams {
  search?: string;
  status_filter?: 'success' | 'error' | 'warning';
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export async function getUserLogs(params?: GetLogsParams): Promise<LogEntry[]> {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.append('search', params.search);
  if (params?.status_filter) queryParams.append('status_filter', params.status_filter);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  
  const queryString = queryParams.toString();
  const endpoint = `/admin/logs${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<LogEntry[]>(endpoint);
}

// 시스템 관리자 - 사용자 관리
export interface UserInfo {
  id: number;
  email: string;
  name: string;
  phone?: string | null;
  role: 'GENERAL' | 'ADMIN';
  organization?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export async function getAllUsers(search?: string): Promise<UserInfo[]> {
  const queryParams = new URLSearchParams();
  if (search) queryParams.append('search', search);
  
  const queryString = queryParams.toString();
  const endpoint = `/admin/users${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<UserInfo[]>(endpoint);
}

export async function deleteUser(userId: number): Promise<void> {
  return apiRequest<void>(`/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

export interface SystemStats {
  database_size_mb: number;
  table_count: number;
  today_api_requests: number;
}

export async function getSystemStats(): Promise<SystemStats> {
  return apiRequest<SystemStats>('/admin/stats');
}

export async function updateUserRole(userId: number, role: string): Promise<UserInfo> {
  return apiRequest<UserInfo>(`/admin/users/${userId}/role?role=${role}`, {
    method: 'PUT',
  });
}

// 사용자 액션 로그 기록
export interface LogActionRequest {
  action: string;
  details?: string;
}

export async function logUserAction(action: string, details?: string): Promise<void> {
  try {
    await apiRequest<{ message: string }>('/auth/log-action', {
      method: 'POST',
      body: JSON.stringify({ action, details }),
    });
  } catch (error) {
    // 로그 기록 실패는 조용히 처리 (사용자 경험에 영향 없도록)
    console.error('Failed to log user action:', error);
  }
}

// 국세청 관리자 API
export interface ArrearsDetection {
  detectionId: string;
  carPlateNumber: string;
  imageId: string;
  detectionSuccess: boolean | null;
  detectedLat: number | null;
  detectedLon: number | null;
  detectedTime: string | null;
  location: string;
  isResolved?: boolean;
}

export interface GetArrearsDetectionsParams {
  car_plate_number?: string;
  detection_success?: boolean;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface ArrearsDetectionsResponse {
  items: ArrearsDetection[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getArrearsDetections(params?: GetArrearsDetectionsParams): Promise<ArrearsDetectionsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.car_plate_number) queryParams.append('car_plate_number', params.car_plate_number);
  if (params?.detection_success !== undefined) queryParams.append('detection_success', params.detection_success.toString());
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  
  const queryString = queryParams.toString();
  const endpoint = `/nts/arrears/detections${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<ArrearsDetectionsResponse>(endpoint);
}

export interface UpdateDetectionRequest {
  detection_success: boolean;
}

export interface UpdateDetectionResponse {
  detectionId: string;
  carPlateNumber: string;
  detectionSuccess: boolean;
  message: string;
}

export async function updateDetectionResult(
  detectionId: string,
  request: UpdateDetectionRequest
): Promise<UpdateDetectionResponse> {
  return apiRequest<UpdateDetectionResponse>(`/nts/arrears/detections/${detectionId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export interface ArrearsStats {
  totalArrears: number;
  detectionSuccess: number;
  undetected: number;  // 미탐지 (전체 체납자 - 탐지 성공)
  falsePositiveCount: number;  // 오탐지로 수정한 횟수
  unconfirmed: number;
  resolvedCount: number;
}

export async function getArrearsStats(): Promise<ArrearsStats> {
  return apiRequest<ArrearsStats>('/nts/arrears/stats');
}

export async function getRecentArrearsDetections(since?: string): Promise<ArrearsDetection[]> {
  const queryParams = new URLSearchParams();
  if (since) queryParams.append('since', since);
  
  const queryString = queryParams.toString();
  const endpoint = `/nts/arrears/detections/recent${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<ArrearsDetection[]>(endpoint);
}

export interface ResolveArrearsResponse {
  detectionId: string;
  carPlateNumber: string;
  isResolved: boolean;
  resolvedAt: string | null;
  message: string;
}

export async function resolveArrears(detectionId: string): Promise<ResolveArrearsResponse> {
  return apiRequest<ResolveArrearsResponse>(
    `/nts/arrears/detections/${detectionId}/resolve`,
    {
      method: 'PUT',
    }
  );
}

// 경찰청 관리자 API
export interface MissingPersonDetection {
  detectionId: string;
  missingId: string;
  missingName: string;
  missingAge: number | null;
  imageId: string;
  detectionSuccess: boolean | null;
  detectedLat: number | null;
  detectedLon: number | null;
  detectedTime: string | null;
  location: string;
  isResolved?: boolean;
}

export interface GetMissingPersonDetectionsParams {
  missing_id?: string;
  detection_success?: string; // 'true': 탐지 성공, 'false': 탐지 실패, 'null': 미확인
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface MissingPersonDetectionsResponse {
  items: MissingPersonDetection[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getMissingPersonDetections(params?: GetMissingPersonDetectionsParams): Promise<MissingPersonDetectionsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.missing_id) queryParams.append('missing_id', params.missing_id);
  if (params?.detection_success !== undefined) {
    queryParams.append('detection_success', params.detection_success);
  }
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  
  const queryString = queryParams.toString();
  const endpoint = `/police/missing-person/detections${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<MissingPersonDetectionsResponse>(endpoint);
}

export interface UpdateMissingPersonDetectionRequest {
  detection_success: boolean;
}

export interface UpdateMissingPersonDetectionResponse {
  detectionId: string;
  missingId: string;
  detectionSuccess: boolean;
  message: string;
}

export async function updateMissingPersonDetectionResult(
  detectionId: string,
  request: UpdateMissingPersonDetectionRequest
): Promise<UpdateMissingPersonDetectionResponse> {
  return apiRequest<UpdateMissingPersonDetectionResponse>(`/police/missing-person/detections/${detectionId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export interface ResolveMissingPersonResponse {
  detectionId: string;
  missingId: string;
  isResolved: boolean;
  resolvedAt: string | null;
  message: string;
}

export async function resolveMissingPerson(detectionId: string): Promise<ResolveMissingPersonResponse> {
  return apiRequest<ResolveMissingPersonResponse>(
    `/police/missing-person/detections/${detectionId}/resolve`,
    {
      method: 'PUT',
    }
  );
}

export interface MissingPersonStats {
  missingToday: number;
  missingMonthly: number;
  resolvedCount: number;
}

export interface GetMissingPersonStatsParams {
  year?: number;
  month?: number;
}

export async function getMissingPersonStats(params?: GetMissingPersonStatsParams): Promise<MissingPersonStats> {
  const queryParams = new URLSearchParams();
  if (params?.year) queryParams.append('year', params.year.toString());
  if (params?.month) queryParams.append('month', params.month.toString());
  
  const queryString = queryParams.toString();
  const endpoint = `/police/missing-person/stats${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<MissingPersonStats>(endpoint);
}

export async function getRecentMissingPersonDetections(since?: string): Promise<MissingPersonDetection[]> {
  const queryParams = new URLSearchParams();
  if (since) queryParams.append('since', since);
  
  const queryString = queryParams.toString();
  const endpoint = `/police/missing-person/detections/recent${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<MissingPersonDetection[]>(endpoint);
}

// 부산시청 관리자 - 체납자 통계 API
export interface CityArrearsStats {
  todayDetected: number;
  totalAmount: number;
  monthlyTrend: Array<{
    month: string;
    newArrears: number;
    detected: number;
    resolved: number;
    resolutionRate: number;
  }>;
  monthlyNew: number;  // 이번달 신규 체납자 수
  resolvedCount: number;
  resolutionRate: number;
}

export async function getCityArrearsStats(): Promise<CityArrearsStats> {
  return apiRequest<CityArrearsStats>('/city/arrears/stats');
}

// 부산시청 관리자 - 오늘 탐지된 체납차량 목록
export interface TodayArrearsDetection {
  detectionId: string;
  carPlateNumber: string;
  detectedLat: number | null;
  detectedLon: number | null;
  detectedTime: string | null;
  location: string;
  detectionSuccess: boolean | null;
  totalArrearsAmount: number | null;
  arrearsPeriod: string | null;
  noticeSent: boolean;
}

export async function getTodayArrearsDetections(): Promise<TodayArrearsDetection[]> {
  return apiRequest<TodayArrearsDetection[]>('/city/arrears/detections/today');
}

// 부산시청 관리자 - 실종자 통계 API
export interface CityMissingPersonStats {
  monthlyReports: number;
  monthlyFound: number;
  resolutionRate: number;
  resolvedCount: number;
  monthlyTrend: Array<{
    month: string;
    reports: number;
    found: number;
    resolved: number;
    resolutionRate: number;
  }>;
}

export async function getCityMissingPersonStats(): Promise<CityMissingPersonStats> {
  return apiRequest<CityMissingPersonStats>('/city/missing-person/stats');
}

// 부산시청 관리자 - 오늘 탐지된 실종자 목록
export interface TodayMissingPersonDetection {
  detectionId: string;
  missingId: string;
  missingName: string;
  missingAge: number | null;
  detectedLat: number | null;
  detectedLon: number | null;
  detectedTime: string | null;
  location: string;
  detectionSuccess: boolean | null;
}

export async function getTodayMissingPersonDetections(): Promise<TodayMissingPersonDetection[]> {
  return apiRequest<TodayMissingPersonDetection[]>('/city/missing-person/detections/today');
}