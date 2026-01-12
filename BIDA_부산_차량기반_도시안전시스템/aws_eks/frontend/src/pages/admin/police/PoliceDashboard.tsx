import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { UserX, Bell, Edit, MapPin, Clock, Loader2, Search, ChevronLeft, ChevronRight, Calendar, TrendingUp } from 'lucide-react';
import PowerBIEmbedView from '../../../components/common/powerbi/PowerBIEmbedView';
import { 
  getMissingPersonDetections, 
  updateMissingPersonDetectionResult, 
  getMissingPersonStats, 
  getRecentMissingPersonDetections,
  resolveMissingPerson,
  type MissingPersonDetection, 
  type MissingPersonStats 
} from '../../../utils/api';
import { useToast } from '../../../components/ui/toast';

const POLICE_MISSING_PERSON_URL = import.meta.env.VITE_POWER_BI_POLICE_MISSING_PERSON_URL || "";

const ITEMS_PER_PAGE = 100;

export default function PoliceDashboard() {
  const [detections, setDetections] = useState<MissingPersonDetection[]>([]);
  const [stats, setStats] = useState<MissingPersonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState<MissingPersonDetection | null>(null);
  const [editSuccess, setEditSuccess] = useState<boolean>(selectedDetection?.detectionSuccess ?? false);
  const [updating, setUpdating] = useState(false);
  // 오늘 날짜 00:00:00으로 초기화 (오늘 날짜 기준 알림을 위해)
  const getTodayStart = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };
  const [lastCheckTime, setLastCheckTime] = useState<Date>(getTodayStart());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [shownDetections, setShownDetections] = useState<Set<string>>(new Set());
  const { addToast } = useToast();
  
  // 월별 선택 상태
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  
  // 탐지 결과 카테고리 선택 (전체, 탐지 성공, 오탐지)
  const [selectedCategory, setSelectedCategory] = useState<string>('all'); // 'all', 'success', 'failure'

  useEffect(() => {
    fetchData();
    
    // 브라우저 알림 권한 요청
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    }
  }, []);


  useEffect(() => {
    if (!loading) {
      fetchDetections(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // 주기적 자동 새로고침 (10초마다) - 다른 사용자의 수정 사항 빠르게 반영
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hasFocus() && !loading) {
        fetchDetections(true);
        getMissingPersonStats({
          year: selectedYear,
          month: selectedMonth
        }).then(setStats).catch(console.error);
      }
    }, 10000); // 30초에서 10초로 단축

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentPage, searchTerm, selectedYear, selectedMonth]);

  // 페이지 포커스 시 자동 새로고침
  useEffect(() => {
    const handleFocus = () => {
      if (!loading) {
        fetchDetections(true);
        getMissingPersonStats({
          year: selectedYear,
          month: selectedMonth
        }).then(setStats).catch(console.error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, selectedYear, selectedMonth]);

  // 검색어 변경 시 첫 페이지로 리셋하고 검색 실행 (debounce 적용)
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchDetections(false);
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // 년도/월 변경 시 데이터 새로고침
  useEffect(() => {
    setCurrentPage(1);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  // 카테고리 변경 시 데이터 새로고침
  useEffect(() => {
    setCurrentPage(1);
    fetchDetections(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // 날짜가 바뀌면 shownDetections 초기화
  useEffect(() => {
    const checkDateChange = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastCheckDate = new Date(lastCheckTime.getFullYear(), lastCheckTime.getMonth(), lastCheckTime.getDate());
      
      // 날짜가 바뀌었으면 shownDetections 초기화 및 lastCheckTime을 오늘 00:00:00으로 설정
      if (today.getTime() !== lastCheckDate.getTime()) {
        setShownDetections(new Set());
        setLastCheckTime(getTodayStart());
      }
    };
    
    // 1분마다 날짜 변경 확인
    const dateCheckInterval = setInterval(checkDateChange, 60000);
    return () => clearInterval(dateCheckInterval);
  }, [lastCheckTime]);

  // 실시간 탐지 알림 체크 (10초마다)
  useEffect(() => {
    const checkNewDetections = async () => {
      // 로딩 중이 아니면 실행 (document.hasFocus() 체크 제거 - 항상 체크)
      if (loading) return;
      
      try {
        const since = lastCheckTime.toISOString();
        const newDetections = await getRecentMissingPersonDetections(since);
        
        if (newDetections.length > 0) {
          // 이미 표시하지 않은 새로운 탐지 기록만 알림 표시
          const unseenDetections = newDetections.filter(
            (detection) => !shownDetections.has(detection.detectionId)
          );
          
          if (unseenDetections.length > 0) {
            console.log('새로운 탐지 발견:', unseenDetections.length, '개');
            unseenDetections.forEach((detection) => {
              showDetectionNotification(detection);
              // 표시한 탐지 ID 저장
              setShownDetections((prev) => new Set([...prev, detection.detectionId]));
            });
            
            // 목록 새로고침 (현재 페이지가 1페이지일 때만)
            if (currentPage === 1) {
              fetchDetections(true);
            }
            
            // 통계 새로고침
            getMissingPersonStats({
              year: selectedYear,
              month: selectedMonth
            }).then(setStats).catch(console.error);
          }
        }
        
        // 마지막 확인 시간 업데이트
        setLastCheckTime(new Date());
      } catch (err) {
        console.error('최신 탐지 기록 확인 실패:', err);
      }
    };

    // 초기 실행 (즉시 체크)
    checkNewDetections();
    
    const interval = setInterval(checkNewDetections, 10000); // 10초마다
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCheckTime, loading, currentPage, shownDetections, selectedYear, selectedMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const statsData = await getMissingPersonStats({
        year: selectedYear,
        month: selectedMonth
      });
      setStats(statsData);
      await fetchDetections(false);
      // 데이터 로딩 완료 후 마지막 확인 시간을 현재 시간으로 설정 (오늘 날짜 내의 새로운 탐지만 알림)
      setLastCheckTime(new Date());
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetections = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      
      // 검색어가 있으면 날짜 필터 제거, 없으면 선택한 년도/월 필터 적용
      let startDate: Date | undefined = undefined;
      let endDate: Date | undefined = undefined;
      
      if (!searchTerm) {
        // 선택한 년도/월의 시작일과 종료일 계산
        // 백엔드에서 end_date + 1초로 다음 달 1일 00:00:00 미만으로 변환하므로
        // 해당 월의 마지막 날 23:59:59로 설정하면 통계와 동일한 범위가 됨
        startDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0);
        endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
      }
      
      // 카테고리에 따른 탐지 결과 필터링
      let detectionSuccess: string | undefined = undefined;
      if (selectedCategory === 'success') {
        detectionSuccess = 'true';
      } else if (selectedCategory === 'failure') {
        detectionSuccess = 'false';
      }
      // 'all'인 경우 detectionSuccess는 undefined로 유지
      
      const response = await getMissingPersonDetections({
        missing_id: searchTerm || undefined,
        detection_success: detectionSuccess,
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
        page: currentPage,
        limit: ITEMS_PER_PAGE
      });
      setDetections(response.items);
      setTotalPages(response.totalPages);
      setTotalCount(response.total);
    } catch (err) {
      console.error('실종자 탐지 조회 실패:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : '실종자 탐지를 불러오는데 실패했습니다.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleEditClick = (detection: MissingPersonDetection) => {
    setSelectedDetection(detection);
    setEditSuccess(detection.detectionSuccess ?? false);
    setEditDialogOpen(true);
  };

  const handleUpdateDetection = async () => {
    if (!selectedDetection) return;
    
    try {
      setUpdating(true);
      await updateMissingPersonDetectionResult(selectedDetection.detectionId, {
        detection_success: editSuccess
      });
      
      // 목록 및 통계 새로고침 (수정된 결과 반영)
      await fetchData();
      setEditDialogOpen(false);
      alert('탐지 결과가 수정되었습니다.');
    } catch (err) {
      console.error('탐지 결과 수정 실패:', err);
      alert(err instanceof Error ? err.message : '탐지 결과 수정에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const handleResolve = async (detection: MissingPersonDetection) => {
    if (!confirm(`${detection.missingName}님의 실종 사건을 해결완료 처리하시겠습니까?`)) {
      return;
    }
    
    try {
      setUpdating(true);
      await resolveMissingPerson(detection.detectionId);
      
      // 목록 및 통계 새로고침
      await fetchData();
      alert('해결완료 처리되었습니다.');
    } catch (err) {
      console.error('해결완료 처리 실패:', err);
      alert(err instanceof Error ? err.message : '해결완료 처리에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const getDetectionStatusBadge = (success: boolean | null) => {
    if (success === null) {
      return <Badge variant="secondary">미확인</Badge>;
    }
    if (success) {
      return <Badge className="bg-green-500 text-white">탐지 성공</Badge>;
    }
    return <Badge variant="destructive">오탐지</Badge>;
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '시간 정보 없음';
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const showDetectionNotification = (detection: MissingPersonDetection) => {
    const location = detection.location || '위치 정보 없음';
    const time = detection.detectedTime 
      ? new Date(detection.detectedTime).toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      : '시간 정보 없음';
    const missingInfo = `${detection.missingName}${detection.missingAge ? ` (${detection.missingAge}세)` : ''}`;

    // 알림 소리 재생
    const playNotificationSound = () => {
      try {
        // AudioContext를 사용하여 알림 소리 생성 (beep 소리)
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 알림 소리 설정 (800Hz, 0.3초)
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        
        // 0.1초 후 두 번째 beep
        setTimeout(() => {
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);
          oscillator2.frequency.value = 800;
          oscillator2.type = 'sine';
          gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          oscillator2.start(audioContext.currentTime);
          oscillator2.stop(audioContext.currentTime + 0.3);
        }, 100);
      } catch (error) {
        console.error('알림 소리 재생 실패:', error);
      }
    };

    // 알림 소리 재생
    playNotificationSound();

    // 페이지 내 토스트 알림 (항상 표시)
    addToast({
      type: 'warning',
      title: '🚨 실종자 탐지 알림',
      message: `실종자: ${missingInfo}\n📍 위치: ${location}\n🕐 시간: ${time}`,
      duration: 8000, // 8초간 표시
    });

    // 브라우저 알림 표시 (권한이 있는 경우)
    if ('Notification' in window && notificationPermission === 'granted') {
      new Notification('실종자 탐지 알림', {
        body: `실종자: ${missingInfo}\n위치: ${location}\n시간: ${time}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: detection.detectionId, // 같은 탐지는 한 번만 알림
        requireInteraction: false,
      });
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchDetections();
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 10;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    return pageNumbers;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">실종자 관리 대시보드</h1>
        <p className="text-gray-600">실종자 탐지 알림 관리 (준실시간)</p>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserX className="size-4 text-red-500" />
              오늘 실종자 탐지
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats ? stats.missingToday : '-'}건
            </div>
            <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleDateString('ko-KR')} 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserX className="size-4 text-green-500" />
                월간 실종자 탐지
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => currentDate.getFullYear() - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(value) => setSelectedMonth(parseInt(value))}
                >
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {month}월
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats ? stats.missingMonthly : '-'}건
            </div>
            <p className="text-xs text-gray-500 mt-1">{selectedYear}년 {selectedMonth}월 누적</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserX className="size-4 text-blue-500" />
              해결완료
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats ? stats.resolvedCount : '-'}건
            </div>
            <p className="text-xs text-gray-500 mt-1">{selectedYear}년 {selectedMonth}월 누적</p>
          </CardContent>
        </Card>
      </div>

      {/* 실종자 관리 */}
      <Tabs defaultValue="monitoring" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monitoring">
            <TrendingUp className="size-4 mr-2" />
            실종자 모니터링
          </TabsTrigger>
          <TabsTrigger value="detections">
            <Bell className="size-4 mr-2" />
            탐지 알림
          </TabsTrigger>
        </TabsList>

        {/* 실종자 모니터링 탭 */}
        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>실종자 현황 대시보드</CardTitle>
              <CardDescription>PowerBI 대시보드 - 실종자 탐지 통계 분석</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {POLICE_MISSING_PERSON_URL ? (
                <div className="w-full">
                  <PowerBIEmbedView reportUrl={POLICE_MISSING_PERSON_URL} height="800px" />
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center m-6">
                  <div className="text-gray-500 mb-2">PowerBI 대시보드 연동 영역</div>
                  <p className="text-sm text-gray-400">PowerBI URL을 설정해주세요</p>
                  <div className="mt-4 h-64 bg-white rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <UserX className="size-12 text-gray-300" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 탐지 알림 탭 */}
        <TabsContent value="detections" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="size-5 text-red-500" />
                    실종자 탐지 알림
                  </CardTitle>
                  <CardDescription>탐지 시 알림 기능 및 탐지 결과 수정 기능</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      placeholder="실종자 ID 검색"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch();
                        }
                      }}
                    />
                  </div>
                  <Button onClick={handleSearch} className="h-10">검색</Button>
                  {searchTerm && (
                    <Button variant="outline" onClick={handleClearSearch} className="h-10">초기화</Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 카테고리 선택 탭 */}
              <div className="mb-6">
                <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all">전체</TabsTrigger>
                    <TabsTrigger value="success">탐지 성공</TabsTrigger>
                    <TabsTrigger value="failure">오탐지</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            {loading && !searchTerm && currentPage === 1 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-600">데이터를 불러오는 중...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="text-red-600 mb-2 font-medium">오류 발생</div>
                <div className="text-sm text-gray-500 mb-4">{error}</div>
                <Button onClick={fetchData}>다시 시도</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-700 font-medium">실종자</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-medium">탐지 위치</th>
                      <th className="text-center py-3 px-4 text-gray-700 font-medium">탐지 시간</th>
                      <th className="text-center py-3 px-4 text-gray-700 font-medium">탐지 결과</th>
                      <th className="text-center py-3 px-4 text-gray-700 font-medium">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detections.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          {searchTerm ? '검색 결과가 없습니다.' : '실종자 탐지 알림이 없습니다.'}
                        </td>
                      </tr>
                    ) : (
                      detections.map((detection) => (
                        <tr key={detection.detectionId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 font-medium">{detection.missingName}</span>
                              {detection.missingAge && (
                                <Badge variant="outline">{detection.missingAge}세</Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">ID: {detection.missingId}</div>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            <div className="flex items-center gap-2">
                              <MapPin className="size-4 text-gray-400" />
                              <span>{detection.location}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-gray-700">
                            <div className="flex items-center justify-center gap-2">
                              <Clock className="size-4 text-gray-400" />
                              <span>{formatDateTime(detection.detectedTime)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getDetectionStatusBadge(detection.detectionSuccess)}
                              {detection.isResolved && (
                                <Badge className="bg-blue-500 text-white">해결완료</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleEditClick(detection)}
                                disabled={detection.isResolved}
                              >
                                <Edit className="size-4 mr-1" />
                                수정
                              </Button>
                              {detection.detectionSuccess === true && !detection.isResolved && (
                                <Button 
                                  size="sm" 
                                  className="bg-blue-500 text-white hover:bg-blue-600"
                                  onClick={() => handleResolve(detection)}
                                  disabled={updating}
                                >
                                  해결완료
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                
                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex flex-col items-center gap-4 mt-6 pt-4 border-t">
                    <div className="text-sm text-gray-600">
                      총 {totalCount.toLocaleString()}건 중 {((currentPage - 1) * ITEMS_PER_PAGE + 1).toLocaleString()}-
                      {Math.min(currentPage * ITEMS_PER_PAGE, totalCount).toLocaleString()}건 표시
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {getPageNumbers().map((pageNum) => (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="min-w-[40px]"
                          >
                            {pageNum}
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
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>

      {/* 탐지 결과 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>탐지 결과 수정</DialogTitle>
            <DialogDescription>
              실종자: {selectedDetection?.missingName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>실종자 ID</Label>
              <p className="text-sm text-gray-600">{selectedDetection?.missingId}</p>
            </div>
            <div className="space-y-2">
              <Label>탐지 위치</Label>
              <p className="text-sm text-gray-600">{selectedDetection?.location}</p>
            </div>
            <div className="space-y-2">
              <Label>탐지 시간</Label>
              <p className="text-sm text-gray-600">{formatDateTime(selectedDetection?.detectedTime ?? null)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="detection-success">탐지 결과</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="success"
                    name="detection-success"
                    checked={editSuccess === true}
                    onChange={() => setEditSuccess(true)}
                    className="size-4"
                  />
                  <span>탐지 성공</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="failure"
                    name="detection-success"
                    checked={editSuccess === false}
                    onChange={() => setEditSuccess(false)}
                    className="size-4"
                  />
                  <span>오탐지</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updating}>
              취소
            </Button>
            <Button onClick={handleUpdateDetection} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  수정 중...
                </>
              ) : (
                '수정'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
