import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types/user';
import { login as apiLogin, register as apiRegister, getCurrentUser, type LoginRequest, type RegisterRequest } from '../utils/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: string, organization?: string) => Promise<User>;
  signup: (data: SignupData) => Promise<User>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: string;
  organization?: string;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // localStorage에서 토큰이 있으면 사용자 정보 복원
  useEffect(() => {
    const restoreUser = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          // 토큰이 있으면 사용자 정보를 API로 가져옴
          const userData = await getCurrentUser();
          const restoredUser: User = {
            id: userData.id.toString(),
            username: userData.email,
            name: userData.name,
            email: userData.email,
            role: userData.role as UserRole,
            organization: userData.organization,
            createdAt: new Date().toISOString(),
          };
          setUser(restoredUser);
        } catch (error) {
          // 토큰이 유효하지 않으면 제거
          console.error('사용자 정보 복원 실패:', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    restoreUser();
  }, []);

  const login = async (email: string, password: string, role: string, organization?: string): Promise<User> => {
    try {
      // 실제 FastAPI 백엔드와 통신
      const loginRequest: LoginRequest = {
        email,
        password,
        userType: role,
        organization,
      };
      
      const response = await apiLogin(loginRequest);
      
      // 사용자 정보 생성
      const userData: User = {
        id: response.user.id.toString(),
        username: response.user.email, // username은 email로 설정 (하위 호환성)
        name: response.user.name,
        email: response.user.email,
        role: response.user.role as UserRole,
        organization: response.user.organization,
        createdAt: new Date().toISOString(),
      };
      
      // 사용자 정보 설정
      setUser(userData);
      
      return userData;
    } catch (error) {
      console.error('로그인 실패:', error);
      throw error;
    }
  };

  const signup = async (data: SignupData): Promise<User> => {
    try {
      // 실제 FastAPI 백엔드와 통신
      const registerRequest: RegisterRequest = {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        organization: data.organization,
      };

      const result = await apiRegister(registerRequest);

      // 사용자 정보 생성
      if (!result.user) {
        throw new Error('회원가입 응답에 사용자 정보가 없습니다.');
      }

      const userData: User = {
        id: result.user.id.toString(),
        username: result.user.email, // username은 email로 설정 (하위 호환성)
        name: result.user.name,
        email: result.user.email,
        role: result.user.role as UserRole,
        organization: result.user.organization,
        createdAt: new Date().toISOString(),
      };

      // 회원가입 시에는 사용자 정보를 설정하지 않음 (로그인 페이지로 이동 후 로그인 필요)
      // setUser(userData);
      
      return userData;
    } catch (error) {
      console.error('회원가입 실패:', error);
      throw error;
    }
  };

  const logout = () => {
    // 토큰 제거
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
      'Make sure AuthProvider is wrapping your component tree in App.tsx'
    );
  }
  return context;
}


