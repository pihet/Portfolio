export type UserRole = 'GENERAL' | 'ADMIN';

export interface User {
  id: string;
  username?: string; // 선택적 (하위 호환성)
  email: string;
  role: UserRole;
  name: string; // 필수
  phone?: string;
  organization?: string;
  createdAt: string;
  oauth_provider?: string; // OAuth 제공자 (google, kakao 등)
}



