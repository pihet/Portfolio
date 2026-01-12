import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getApiBaseUrl } from '../../utils/api';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refresh_token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      setTimeout(() => {
        navigate('/login?error=oauth_failed');
      }, 3000);
      return;
    }

    if (token && refreshToken) {
      // 토큰 저장
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', refreshToken);

      // 사용자 정보 가져오기
      const fetchUserInfo = async () => {
        try {
          const baseUrl = getApiBaseUrl();
          const apiUrl = baseUrl === '/api' 
            ? `${baseUrl}/users/me`
            : `${baseUrl}/api/users/me`;
          const response = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            throw new Error('사용자 정보를 가져올 수 없습니다.');
          }

          const userData = await response.json();

          // 적절한 대시보드로 리다이렉트
          if (userData.role === 'ADMIN') {
            const org = userData.organization;
            const paths: Record<string, string> = {
              'busan': '/admin/city/safe-driving',
              'nts': '/admin/nts',
              'police': '/admin/police',
              'system': '/admin/system'
            };
            navigate(paths[org] || '/admin/system', { replace: true });
          } else {
            navigate('/user/dashboard', { replace: true });
          }
        } catch (err) {
          console.error('OAuth callback error:', err);
          setError('사용자 정보를 불러오는데 실패했습니다.');
          setTimeout(() => {
            navigate('/login?error=oauth_failed');
          }, 2000);
        }
      };

      fetchUserInfo();
    } else {
      setError('토큰을 받지 못했습니다.');
      setTimeout(() => {
        navigate('/login?error=oauth_failed');
      }, 2000);
    }
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4 text-lg font-semibold">{error}</div>
          <p className="text-gray-600">로그인 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <Loader2 className="size-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 text-lg font-medium">로그인 처리 중...</p>
      </div>
    </div>
  );
}


