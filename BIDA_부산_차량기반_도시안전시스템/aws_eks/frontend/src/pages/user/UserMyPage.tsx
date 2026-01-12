import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { User, Car, Edit, Plus, Trash2 } from 'lucide-react';
import VehicleRegistrationModal from '../../components/user/VehicleRegistrationModal';
import { useVehicle } from '../../hooks/useVehicle';
import { useEffect } from 'react';
import { updateUser, getCurrentUser } from '../../utils/api';

export default function UserMyPage() {
  const { user, setUser } = useAuth();
  const { vehicles, fetchVehicles, registerVehicle, deleteVehicle } = useVehicle();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);

      // 비밀번호 변경 시 유효성 검사
      if (formData.newPassword) {
        if (!formData.currentPassword) {
          alert('현재 비밀번호를 입력해주세요.');
          setIsSaving(false);
          return;
        }
        if (formData.newPassword !== formData.confirmPassword) {
          alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
          setIsSaving(false);
          return;
        }
        if (formData.newPassword.length < 4) {
          alert('새 비밀번호는 최소 4자 이상이어야 합니다.');
          setIsSaving(false);
          return;
        }
      }

      // API 호출
      const updateData: any = {};
      if (formData.name !== user?.name) {
        updateData.name = formData.name;
      }
      // 이메일은 수정 불가 (제거)
      // if (formData.email !== user?.email) {
      //   updateData.email = formData.email;
      // }
      if (formData.newPassword) {
        updateData.current_password = formData.currentPassword;
        updateData.new_password = formData.newPassword;
      }

      // 변경사항이 없으면 알림
      if (Object.keys(updateData).length === 0) {
        alert('변경된 내용이 없습니다.');
        setIsSaving(false);
        return;
      }

      await updateUser(updateData);

      // 사용자 정보 새로고침
      const updatedUser = await getCurrentUser();
      setUser({
        id: updatedUser.id.toString(),
        username: updatedUser.email,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role as any,
        organization: updatedUser.organization,
        createdAt: new Date().toISOString(),
      });

      alert('정보가 성공적으로 수정되었습니다.');
      setIsEditingProfile(false);
      setFormData({
        name: updatedUser.name || '',
        email: updatedUser.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('정보 수정 실패:', error);
      alert(error instanceof Error ? error.message : '정보 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  const handleVehicleAdd = async (data: any) => {
    try {
      await registerVehicle({
        licensePlate: data.plateNumber,
        vehicleType: 'private',
      });
      setIsVehicleModalOpen(false);
      fetchVehicles();
    } catch (error) {
      console.error('차량 등록 실패:', error);
      alert('차량 등록에 실패했습니다.');
    }
  };

  const handleVehicleDelete = async (id: string) => {
    if (window.confirm('차량 정보를 삭제하시겠습니까?')) {
      try {
        await deleteVehicle(id);
        fetchVehicles();
      } catch (error) {
        console.error('차량 삭제 실패:', error);
        alert('차량 삭제에 실패했습니다.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">마이페이지</h1>
        <p className="text-gray-600">개인정보 및 차량 정보를 관리하세요</p>
      </div>

      {/* 개인정보 카드 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                개인정보
              </CardTitle>
              <CardDescription>회원 정보를 확인하고 수정할 수 있습니다</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
            >
              <Edit className="size-4 mr-2" />
              {isEditingProfile ? '취소' : '수정'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditingProfile ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">이름</Label>
                  <p className="text-gray-900 mt-1 font-medium">{user?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-600">이메일</Label>
                  <p className="text-gray-900 mt-1 font-medium">{user?.email || '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-gray-600">사용자 유형</Label>
                <div className="mt-1">
                  <Badge>일반 사용자</Badge>
                </div>
              </div>
            </>
          ) : (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={formData.email}
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500">이메일은 수정할 수 없습니다</p>
                </div>
              </div>
              {user?.oauth_provider ? (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    OAuth 로그인 사용자는 비밀번호를 변경할 수 없습니다.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">현재 비밀번호</Label>
                    <Input 
                      id="currentPassword" 
                      type="password" 
                      placeholder="비밀번호 변경 시에만 입력"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">새 비밀번호</Label>
                      <Input 
                        id="newPassword" 
                        type="password" 
                        placeholder="비밀번호 변경 시에만 입력"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                      <Input 
                        id="confirmPassword" 
                        type="password" 
                        placeholder="비밀번호 변경 시에만 입력"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? '저장 중...' : '저장하기'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                  취소
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 차량 정보 카드 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Car className="size-5" />
                등록된 차량 {vehicles.length > 0 && `(${vehicles.length}대)`}
              </CardTitle>
              <CardDescription>
                차량 정보를 등록하고 관리하세요 {vehicles.length > 0 && `(최대 여러 대 등록 가능)`}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsVehicleModalOpen(true)}>
              <Plus className="size-4 mr-2" />
              차량 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              등록된 차량이 없습니다. 차량을 추가해주세요.
            </div>
          ) : (
            <div className="space-y-3">
              {vehicles.map((vehicle, index) => (
                <div
                  key={vehicle.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-3 bg-blue-50 rounded-lg flex-shrink-0">
                      <Car className="size-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {index + 1}번 차량
                        </span>
                        <p className="text-gray-900 font-medium text-lg">
                          {vehicle.licensePlate}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVehicleDelete(vehicle.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <VehicleRegistrationModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSubmit={handleVehicleAdd}
      />
    </div>
  );
}

