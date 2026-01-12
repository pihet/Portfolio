import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Car, User, LogOut, LayoutDashboard, Shield } from 'lucide-react';
import { logUserAction } from '../utils/api';

export default function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    // 로그아웃 로그 기록
    await logUserAction('로그아웃', `사용자: ${user?.name || user?.email}`);
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/user' || path === '/user/dashboard') {
      return location.pathname === '/user' || location.pathname === '/user/dashboard';
    }
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-gray-300/50 sticky top-0 z-50 shadow-apple-lg">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-apple-lg">
                  <Car className="size-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">SMART BUSAN</h1>
                  <p className="text-sm text-gray-600 font-medium">안전운전 관리</p>
                </div>
              </div>
              
              <nav className="hidden md:flex items-center gap-3 ml-10">
                <button
                  onClick={async () => {
                    await logUserAction('탭바 클릭', '대시보드');
                    navigate('/user/dashboard');
                  }}
                  className={`px-6 py-3 rounded-xl transition-all flex items-center gap-3 text-base font-semibold ${
                    isActive('/user/dashboard')
                      ? 'bg-blue-50 text-blue-600 shadow-apple'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <LayoutDashboard className="size-5" />
                  대시보드
                </button>
                <button
                  onClick={async () => {
                    await logUserAction('탭바 클릭', '월별 안전운전 점수');
                    navigate('/user/safety-score');
                  }}
                  className={`px-6 py-3 rounded-xl transition-all flex items-center gap-3 text-base font-semibold ${
                    isActive('/user/safety-score') || isActive('/user/safety-detail')
                      ? 'bg-blue-50 text-blue-600 shadow-apple'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Shield className="size-5" />
                  월별 안전운전 점수
                </button>
                <button
                  onClick={async () => {
                    await logUserAction('탭바 클릭', '마이페이지');
                    navigate('/user/mypage');
                  }}
                  className={`px-6 py-3 rounded-xl transition-all flex items-center gap-3 text-base font-semibold ${
                    isActive('/user/mypage')
                      ? 'bg-blue-50 text-blue-600 shadow-apple'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <User className="size-5" />
                  마이페이지
                </button>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-base text-gray-900 font-semibold">{user?.name || '사용자'}님</p>
                <p className="text-sm text-gray-600">일반 사용자</p>
              </div>
              <Button variant="outline" size="default" onClick={handleLogout} className="rounded-xl">
                <LogOut className="size-5 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 모바일 네비게이션 */}
      <nav className="md:hidden bg-white/95 border-b border-gray-300/50">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex gap-4 py-3">
            <button
              onClick={async () => {
                await logUserAction('탭바 클릭', '대시보드 (모바일)');
                navigate('/user/dashboard');
              }}
              className={`flex-1 py-3 text-center rounded-xl transition-all text-base font-semibold ${
                isActive('/user/dashboard')
                  ? 'bg-blue-50 text-blue-600 shadow-apple'
                  : 'text-gray-700'
              }`}
            >
              대시보드
            </button>
            <button
              onClick={async () => {
                await logUserAction('탭바 클릭', '월별 안전운전 점수 (모바일)');
                navigate('/user/safety-score');
              }}
              className={`flex-1 py-3 text-center rounded-xl transition-all text-base font-semibold ${
                isActive('/user/safety-score') || isActive('/user/safety-detail')
                  ? 'bg-blue-50 text-blue-600 shadow-apple'
                  : 'text-gray-700'
              }`}
            >
              월별 안전운전 점수
            </button>
            <button
              onClick={async () => {
                await logUserAction('탭바 클릭', '마이페이지 (모바일)');
                navigate('/user/mypage');
              }}
              className={`flex-1 py-3 text-center rounded-xl transition-all text-base font-semibold ${
                isActive('/user/mypage')
                  ? 'bg-blue-50 text-blue-600 shadow-apple'
                  : 'text-gray-700'
              }`}
            >
              마이페이지
            </button>
          </div>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        <Outlet />
      </main>
    </div>
  );
}
