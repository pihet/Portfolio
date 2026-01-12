import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { TrendingUp, Car, Edit, Loader2, Search, MapPin, Clock, ChevronLeft, ChevronRight, AlertTriangle, Bell } from 'lucide-react';
import PowerBIEmbedView from '../../../components/common/powerbi/PowerBIEmbedView';
import { getArrearsDetections, updateDetectionResult, getArrearsStats, getRecentArrearsDetections, resolveArrears, type ArrearsDetection, type ArrearsStats } from '../../../utils/api';
import { useToast } from '../../../components/ui/toast';

const NTS_MONITORING_REPORT_URL = import.meta.env.VITE_POWER_BI_NTS_MONITORING_URL || "";

const ITEMS_PER_PAGE = 100;

export default function NTSDashboard() {
  const [detections, setDetections] = useState<ArrearsDetection[]>([]);
  const [stats, setStats] = useState<ArrearsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState<ArrearsDetection | null>(null);
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
  const [shownDetections, setShownDetections] = useState<Set<string>>(new Set()); // 이미 표시한 탐지 ID 저장
  const { addToast } = useToast();
  
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
    // 페이지 변경 시 데이터 새로고침
    if (!loading) {
      fetchDetections(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // 카테고리 변경 시 데이터 새로고침
  useEffect(() => {
    setCurrentPage(1);
    fetchDetections(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // 주기적 자동 새로고침 (30초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      // 페이지가 포커스되어 있고 로딩 중이 아닐 때만 새로고침
      if (document.hasFocus() && !loading) {
        fetchDetections(true); // silent 모드로 새로고침 (로딩 스피너 없음)
      }
    }, 30000); // 30초마다

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentPage, searchTerm]);

  // 페이지 포커스 시 자동 새로고침
  useEffect(() => {
    const handleFocus = () => {
      if (!loading) {
        fetchDetections(true); // silent 모드로 새로고침
        getArrearsStats().then(setStats).catch(console.error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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
        const newDetections = await getRecentArrearsDetections(since);
        
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
            getArrearsStats().then(setStats).catch(console.error);
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
  }, [lastCheckTime, loading, currentPage, shownDetections]);

  const showDetectionNotification = (detection: ArrearsDetection) => {
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
      title: '🚨 체납 차량 탐지 알림',
      message: `차량번호: ${detection.carPlateNumber}\n📍 위치: ${location}\n🕐 시간: ${time}`,
      duration: 8000, // 8초간 표시
    });

    // 브라우저 알림 표시 (권한이 있는 경우)
    if ('Notification' in window && notificationPermission === 'granted') {
      new Notification('체납 차량 탐지 알림', {
        body: `차량번호: ${detection.carPlateNumber}\n위치: ${location}\n시간: ${time}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: detection.detectionId, // 같은 탐지는 한 번만 알림
        requireInteraction: false,
      });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const statsData = await getArrearsStats();
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
      
      // 카테고리에 따른 탐지 결과 필터링
      let detectionSuccess: boolean | undefined = undefined;
      if (selectedCategory === 'success') {
        detectionSuccess = true;
      } else if (selectedCategory === 'failure') {
        detectionSuccess = false;
      }
      // 'all'인 경우 detectionSuccess는 undefined로 유지
      
      const response = await getArrearsDetections({
        car_plate_number: searchTerm || undefined,
        detection_success: detectionSuccess,
        page: currentPage,
        limit: ITEMS_PER_PAGE
      });
      setDetections(response.items);
      setTotalPages(response.totalPages);
      setTotalCount(response.total);
    } catch (err) {
      console.error('체납 차량 탐지 조회 실패:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : '체납 차량 탐지를 불러오는데 실패했습니다.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleEditClick = (detection: ArrearsDetection) => {
    setSelectedDetection(detection);
    setEditSuccess(detection.detectionSuccess ?? false);
    setEditDialogOpen(true);
  };

  const handleUpdateDetection = async () => {
    if (!selectedDetection) return;
    
    try {
      setUpdating(true);
      await updateDetectionResult(selectedDetection.detectionId, {
        detection_success: editSuccess
      });
      
      // 목록 및 통계 새로고침
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

  const handleResolve = async (detection: ArrearsDetection) => {
    if (!confirm(`${detection.carPlateNumber} 차량의 체납 사건을 해결완료 처리하시겠습니까?`)) {
      return;
    }
    
    try {
      setUpdating(true);
      await resolveArrears(detection.detectionId);
      
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

  // 검색어 변경 시 첫 페이지로 리셋하고 검색 실행
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchDetections(false);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">국세청 체납자 관리 대시보드</h1>
        <p className="text-gray-600">체납 차량 탐지 및 알림 관리 (준실시간)</p>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Car className="size-4 text-red-500" />
              전체 체납자 수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats ? stats.totalArrears : '-'}건
            </div>
            <p className="text-xs text-gray-500 mt-1">arrears_info 테이블 총 개수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4 text-green-500" />
              탐지 성공
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats ? stats.detectionSuccess : '-'}건
            </div>
            <p className="text-xs text-gray-500 mt-1">확인된 탐지</p>
            {stats && (
              <p className="text-xs text-gray-400 mt-1">
                미탐지: {stats.undetected}건
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="size-4 text-orange-500" />
              오탐지
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats ? stats.falsePositiveCount : '-'}건
            </div>
            <p className="text-xs text-gray-500 mt-1">오탐지로 수정한 횟수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Car className="size-4 text-blue-500" />
              해결완료
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats ? stats.resolvedCount : '-'}건
            </div>
            <p className="text-xs text-gray-500 mt-1">이번달 누적</p>
          </CardContent>
        </Card>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs defaultValue="monitoring" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monitoring">
            <TrendingUp className="size-4 mr-2" />
            체납자 모니터링
          </TabsTrigger>
          <TabsTrigger value="detections">
            <Car className="size-4 mr-2" />
            탐지 알림
          </TabsTrigger>
        </TabsList>

        {/* 체납자 모니터링 탭 */}
        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>체납자 모니터링</CardTitle>
              <CardDescription>PowerBI 대시보드 - 체납자 현황 및 분석</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full">
                <PowerBIEmbedView reportUrl={NTS_MONITORING_REPORT_URL} height="800px" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 탐지 알림 탭 */}
        <TabsContent value="detections" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>체납 차량 탐지 알림</CardTitle>
                  <CardDescription>위치, 시간, 탐지 결과 수정 기능</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      placeholder="차량번호 검색"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setCurrentPage(1);
                          fetchDetections();
                        }
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage(1);
                      fetchDetections();
                    }}
                  >
                    검색
                  </Button>
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setCurrentPage(1);
                      }}
                    >
                      초기화
                    </Button>
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
              {loading ? (
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
                        <th className="text-left py-3 px-4 text-gray-700 font-medium">차량번호</th>
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
                            {searchTerm ? '검색 결과가 없습니다.' : '체납 차량 탐지 알림이 없습니다.'}
                          </td>
                        </tr>
                      ) : (
                        detections.map((detection) => (
                          <tr key={detection.detectionId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-gray-900 font-medium">{detection.carPlateNumber}</td>
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
                          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 10) {
                              pageNum = i + 1;
                            } else if (currentPage <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 4) {
                              pageNum = totalPages - 9 + i;
                            } else {
                              pageNum = currentPage - 5 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className="min-w-[40px]"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
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
              차량번호: {selectedDetection?.carPlateNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
