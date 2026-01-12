import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Car, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'user' as 'user' | 'admin',
    organization: '',
  });
  const [loading, setLoading] = useState(false);
  const { signup, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirected = useRef(false);

  const getRedirectPath = (role: string, organization?: string): string => {
    if (role === 'ADMIN') {
      // organization에 따라 다른 관리자 페이지로 이동
      switch (organization) {
        case 'busan':
          return '/admin/city/safe-driving';
        case 'nts':
          return '/admin/nts';
        case 'police':
          return '/admin/police';
        case 'system':
          return '/admin/system';
        default:
          return '/admin/system'; // 기본값
      }
    } else {
      return '/user/dashboard';
    }
  };

  // 이미 로그인된 사용자는 자동으로 리다이렉트 (한 번만)
  useEffect(() => {
    if (user && location.pathname === '/register' && !hasRedirected.current) {
      hasRedirected.current = true;
      const redirectPath = getRedirectPath(user.role, user.organization);
      navigate(redirectPath, { replace: true });
    }
  }, [user, location.pathname, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      // 회원가입 처리
      await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.userType,
        organization: formData.organization,
      });
      
      // 회원가입 성공 시 로그인 페이지로 이동
      navigate('/login', { 
        replace: true,
        state: { 
          message: '회원가입이 완료되었습니다. 로그인해주세요.',
          email: formData.email // 이메일을 전달하여 로그인 폼에 자동 입력 가능하게 (선택사항)
        }
      });
    } catch (error) {
      console.error('회원가입 실패:', error);
      alert(error instanceof Error ? error.message : '회원가입에 실패했습니다. 다시 시도해주세요.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 왼쪽 브랜드 영역 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAgNGgtMnYyaDJ2LTJ6bTQtNHYyaDJ2LTJoLTJ6bTAtNGgydi0yaC0ydjJ6bS0yLTJ2LTJoLTJ2Mmgyem0tMiAyaC0ydjJoMnYtMnptMiAydjJoMnYtMmgtMnptMC00aDJ2LTJoLTJ2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
        
        <div className="relative z-10 flex flex-col justify-center px-20 text-white">
          <div className="mb-12">
            <div className="inline-flex items-center gap-4 bg-white/10 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/20 shadow-apple-lg">
              <Car className="size-10" />
              <span className="text-3xl font-bold tracking-tight">SMART BUSAN</span>
            </div>
          </div>
          
          <h1 className="text-6xl mb-8 leading-tight font-bold tracking-tight">
            부산시<br />
            스마트 차량<br />
            통합 관리 시스템
          </h1>
          
          <p className="text-2xl text-blue-100 mb-16 leading-relaxed font-light">
            안전한 도시를 만드는 지능형 교통 관제 플랫폼
          </p>
        </div>
      </div>

      {/* 오른쪽 회원가입 폼 */}
      <div className="flex-1 flex items-center justify-center p-12 bg-gray-100">
        <Card className="w-full max-w-2xl p-16 shadow-apple-xl border-0 bg-white">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6 lg:hidden">
              <Car className="size-10 text-blue-600" />
              <span className="text-3xl text-blue-600 font-bold tracking-tight">SMART BUSAN</span>
            </div>
            <h2 className="text-5xl font-bold text-gray-950 mb-4 tracking-tight">회원가입</h2>
            <p className="text-xl text-gray-700 leading-relaxed font-medium">새 계정을 만들어 시작하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="name" className="text-base font-semibold text-gray-900">이름</Label>
              <Input
                id="name"
                type="text"
                placeholder="홍길동"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-14 text-base rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="email" className="text-base font-semibold text-gray-900">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-14 text-base rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="password" className="text-base font-semibold text-gray-900">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-14 text-base rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="confirmPassword" className="text-base font-semibold text-gray-900">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="h-14 text-base rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="userType" className="text-base font-semibold text-gray-900">사용자 유형</Label>
              <Select
                value={formData.userType}
                onValueChange={(value: 'user' | 'admin') => setFormData({ ...formData, userType: value, organization: '' })}
              >
                <SelectTrigger id="userType" className="h-14 text-base rounded-xl border-2">
                  <SelectValue placeholder="사용자 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">일반 사용자</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.userType === 'admin' && (
              <div className="space-y-3">
                <Label htmlFor="organization" className="text-base font-semibold text-gray-900">소속 기관</Label>
                <Select
                  value={formData.organization}
                  onValueChange={(value) => setFormData({ ...formData, organization: value })}
                >
                  <SelectTrigger id="organization" className="h-14 text-base rounded-xl border-2">
                    <SelectValue placeholder="기관 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="busan">부산시</SelectItem>
                    <SelectItem value="nts">국세청</SelectItem>
                    <SelectItem value="police">경찰청</SelectItem>
                    <SelectItem value="system">시스템 관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button type="submit" className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-apple-lg" disabled={loading}>
              {loading ? '가입 중...' : '회원가입'}
            </Button>

            <div className="text-center pt-8">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xl text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-2 font-semibold"
              >
                <ArrowLeft className="size-5" />
                <span className="underline">로그인으로 돌아가기</span>
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
