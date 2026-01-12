import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '../types/user';
import { removeStorageItem } from '../utils/helpers';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, role: UserRole, organization?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

// Mock 데이터 제거됨 - 실제 API를 사용합니다

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (username: string, _password: string, role: UserRole, organization?: string) => {
        // Mock 데이터 제거됨 - 실제 API를 사용합니다
        // 이 함수는 더 이상 사용되지 않으며, AuthContext의 login을 사용해야 합니다
        set({ isLoading: false });
        throw new Error('이 함수는 더 이상 사용되지 않습니다. AuthContext의 login을 사용하세요.');
      },

      logout: async () => {
        removeStorageItem('accessToken');
        removeStorageItem('refreshToken');
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);



