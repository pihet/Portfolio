import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface VehicleRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VehicleData) => void;
}

interface VehicleData {
  plateNumber: string;
}

export default function VehicleRegistrationModal({ isOpen, onClose, onSubmit }: VehicleRegistrationModalProps) {
  const [formData, setFormData] = useState<VehicleData>({
    plateNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      await onSubmit(formData);
      setFormData({
        plateNumber: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '차량 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>차량 등록</DialogTitle>
          <DialogDescription>
            안전운전 관리 서비스를 이용하기 위해 차량 번호판을 입력해주세요.
            번호판을 입력하면 시스템에서 자동으로 차량 정보를 찾아 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="plateNumber">차량 번호판</Label>
            <Input
              id="plateNumber"
              placeholder="예: 12가3456"
              value={formData.plateNumber}
              onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
              required
              disabled={loading}
              className="text-lg"
            />
            <p className="text-xs text-gray-500">
              번호판만 입력하면 됩니다. 시스템에서 자동으로 차량 정보를 찾아 등록합니다.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              취소
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? '등록 중...' : '등록하기'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


