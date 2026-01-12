import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types/user';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // 로딩 중이면 대기 (사용자 정보 복원 중)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  // 토큰이 있지만 사용자 정보가 없으면 (토큰이 유효하지 않음)
  const token = localStorage.getItem('accessToken');
  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  // 사용자가 없으면 로그인 페이지로 리다이렉트
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 권한이 없으면 로그인 페이지로 리다이렉트
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}



