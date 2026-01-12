import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Car, Shield, Building2, BadgeAlert, UserX, LogOut, Settings, LayoutDashboard, Users, FileText } from 'lucide-react';
import { logUserAction } from '../utils/api';

interface AdminLayoutProps {
  type: 'busan' | 'nts' | 'police' | 'system';
}

export default function AdminLayout({ type }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    // 로그아웃 로그 기록
    await logUserAction('로그아웃', `사용자: ${user?.name || user?.email}`);
    logout();
    navigate('/login');
  };

  const getOrganizationName = () => {
    switch (type) {
      case 'busan': return '부산시청';
      case 'nts': return '국세청';
      case 'police': return '경찰청';
      case 'system': return '시스템 관리';
      default: return '';
    }
  };

  const getMenuItems = () => {
    switch (type) {
      case 'busan':
        return [
          { path: '/admin/city/safe-driving', label: '안전운전 관리', icon: Car },
          { path: '/admin/city/delinquent', label: '체납자 관리', icon: BadgeAlert },
          { path: '/admin/city/missing-person', label: '실종자 관리', icon: UserX },
        ];
      case 'nts':
        return [
          { path: '/admin/nts', label: '체납자 관리', icon: BadgeAlert },
        ];
      case 'police':
        return [
          { path: '/admin/police?tab=missing', label: '실종자 관리', icon: UserX },
        ];
      case 'system':
        return [
          { path: '/admin/system', label: '대시보드', icon: LayoutDashboard },
          { path: '/admin/system/users', label: '사용자 관리', icon: Users },
          { path: '/admin/system/logs', label: '로그 모니터링', icon: FileText },
        ];
      default:
        return [];
    }
  };

  const isActive = (path: string) => {
    if (path.includes('?')) {
      const [basePath] = path.split('?');
      return location.pathname === basePath;
    }
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* 사이드바 */}
      <aside className="w-72 bg-white/95 backdrop-blur-xl border-r border-gray-300/50 flex flex-col shadow-apple-lg h-screen sticky top-0">
        <div className="p-8 border-b border-gray-300/50 flex-shrink-0">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-apple-lg">
              {type === 'busan' && <Building2 className="size-7 text-white" />}
              {type === 'nts' && <BadgeAlert className="size-7 text-white" />}
              {type === 'police' && <Shield className="size-7 text-white" />}
              {type === 'system' && <Settings className="size-7 text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">{getOrganizationName()}</h2>
              <p className="text-sm text-gray-600 font-medium">관리자 대시보드</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {getMenuItems().map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={async () => {
                  const [path] = item.path.split('?');
                  await logUserAction('사이드바 메뉴 클릭', item.label);
                  navigate(path);
                }}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all text-base font-semibold ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-blue-600 shadow-apple'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="size-6" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-gray-300/50 bg-white flex-shrink-0 sticky bottom-0">
          <div className="flex items-center gap-4 mb-4 px-2">
            <div className="size-12 bg-gray-200 rounded-full flex items-center justify-center shadow-apple">
              <span className="text-lg text-gray-700 font-bold">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base text-gray-900 font-semibold truncate">{user?.name || '사용자'}</p>
              <p className="text-sm text-gray-600 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <Button variant="outline" size="default" onClick={handleLogout} className="w-full rounded-xl">
            <LogOut className="size-5 mr-2" />
            로그아웃
          </Button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        <div className="p-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
