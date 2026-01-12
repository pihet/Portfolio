import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Search, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getAllUsers, deleteUser, type UserInfo } from '../../../utils/api';

const ITEMS_PER_PAGE = 10;

export default function SystemUserManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllUsers(searchTerm || undefined);
      setUsers(data);
    } catch (err) {
      console.error('사용자 조회 실패:', err);
      setError(err instanceof Error ? err.message : '사용자를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 검색어가 변경되면 API 호출 (디바운스)
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedUsers = users.slice(startIndex, endIndex);

  // 검색어 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('정말 이 사용자를 삭제하시겠습니까?')) {
      try {
        await deleteUser(userId);
        setUsers(users.filter(u => u.id !== userId));
        alert('사용자가 삭제되었습니다.');
      } catch (err) {
        console.error('사용자 삭제 실패:', err);
        alert(err instanceof Error ? err.message : '사용자 삭제에 실패했습니다.');
      }
    }
  };

  const getRoleBadge = (role: string, organization?: string | null) => {
    if (role === 'ADMIN') {
      const orgMap: Record<string, { label: string; className: string }> = {
        'system': { label: '시스템 관리자', className: 'bg-purple-500 text-white' },
        'busan': { label: '부산시 관리자', className: 'bg-blue-500 text-white' },
        'nts': { label: '국세청 관리자', className: 'bg-orange-500 text-white' },
        'police': { label: '경찰청 관리자', className: 'bg-red-500 text-white' },
      };
      const orgInfo = organization ? orgMap[organization] : { label: '관리자', className: 'bg-gray-500 text-white' };
      return <Badge className={orgInfo.className}>{orgInfo.label}</Badge>;
    } else {
      return <Badge className="bg-gray-500 text-white">일반 사용자</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="size-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2 font-medium">오류 발생</div>
        <div className="text-sm text-gray-500 mb-4">{error}</div>
        <Button onClick={fetchUsers}>다시 시도</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">사용자 관리</h1>
        <p className="text-gray-600">사용자 계정 관리 및 수정</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>사용자 계정 관리</CardTitle>
              <CardDescription>전체 사용자 목록</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="사용자 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? '검색 결과가 없습니다.' : '사용자가 없습니다.'}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{u.name || '-'}</span>
                      {getRoleBadge(u.role, u.organization)}
                      {!u.is_active && (
                        <Badge variant="secondary" className="ml-2">비활성</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{u.name || '-'} | {u.email || '-'} {u.phone ? `| ${u.phone}` : ''}</p>
                      <p className="text-xs text-gray-500">
                        가입일: {u.created_at ? new Date(u.created_at).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteUser(u.id)}
                      disabled={u.id.toString() === user?.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="size-4 mr-1" />
                      삭제
                    </Button>
                  </div>
                </div>
                ))}
              </div>
              
              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="min-w-[40px]"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

