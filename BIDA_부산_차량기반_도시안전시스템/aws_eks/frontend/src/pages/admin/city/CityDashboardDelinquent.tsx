import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { TrendingUp, Car, DollarSign, Calendar, Loader2, MapPin, Clock } from 'lucide-react';
import PowerBIEmbedView from '../../../components/common/powerbi/PowerBIEmbedView';
import { getCityArrearsStats, getTodayArrearsDetections, type CityArrearsStats, type TodayArrearsDetection } from '../../../utils/api';

const DELINQUENT_REPORT_URL = import.meta.env.VITE_POWER_BI_DELINQUENT_URL || "";

export default function CityDashboardDelinquent() {
  const [stats, setStats] = useState<CityArrearsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayDetections, setTodayDetections] = useState<TodayArrearsDetection[]>([]);
  const [loadingDetections, setLoadingDetections] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchTodayDetections();
  }, []);

  // 주기적 자동 새로고침 (30초마다) - 국세청에서 수정한 내용 반영
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hasFocus() && !loading && !loadingDetections) {
        fetchStats(true);
        fetchTodayDetections(true);
      }
    }, 30000); // 30초마다

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingDetections]);

  // 페이지 포커스 시 자동 새로고침
  useEffect(() => {
    const handleFocus = () => {
      if (!loading && !loadingDetections) {
        fetchStats(true);
        fetchTodayDetections(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingDetections]);

  const fetchStats = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const data = await getCityArrearsStats();
      setStats(data);
    } catch (err) {
      console.error('체납자 통계 조회 실패:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : '체납자 통계를 불러오는데 실패했습니다.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchTodayDetections = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoadingDetections(true);
      }
      const data = await getTodayArrearsDetections();
      setTodayDetections(data);
    } catch (err) {
      console.error('오늘 탐지된 체납차량 조회 실패:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : '오늘 탐지된 체납차량을 불러오는데 실패했습니다.');
      }
    } finally {
      if (!silent) {
        setLoadingDetections(false);
      }
    }
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

  const getDetectionStatusBadge = (success: boolean | null) => {
    if (success === null) {
      return <Badge variant="secondary">미확인</Badge>;
    }
    if (success) {
      return <Badge className="bg-green-500 text-white">탐지 성공</Badge>;
    }
    return <Badge variant="destructive">오탐지</Badge>;
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-5xl font-bold text-gray-950 mb-4 tracking-tight">체납자 관리</h1>
        <p className="text-xl text-gray-700 leading-relaxed font-medium">체납 차량 탐지 현황 및 통계 (준실시간)</p>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Car className="size-4 text-red-500" />
              오늘 탐지된 체납 차량
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">로딩 중...</span>
              </div>
            ) : error ? (
              <div className="text-sm text-red-600">오류 발생</div>
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600">
                  {stats?.todayDetected || 0}대
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date().toLocaleDateString('ko-KR')} 기준
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4 text-orange-500" />
              이번달 신규 체납자
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">로딩 중...</span>
              </div>
            ) : error ? (
              <div className="text-sm text-red-600">오류 발생</div>
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-900">
                  {stats?.monthlyNew || 0}명
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 신규
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="size-4 text-green-500" />
              총 체납 금액
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">로딩 중...</span>
              </div>
            ) : error ? (
              <div className="text-sm text-red-600">오류 발생</div>
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-900">
                  {stats?.totalAmount
                    ? (stats.totalAmount / 100000000).toFixed(1)
                    : '0.0'}억원
                </div>
                <p className="text-xs text-gray-500 mt-1">부산시 전체</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4 text-blue-500" />
              해결률
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">로딩 중...</span>
              </div>
            ) : error ? (
              <div className="text-sm text-red-600">오류 발생</div>
            ) : (
              <>
                <div className="text-2xl font-bold text-blue-600">
                  {stats?.resolutionRate || 0}%
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.resolvedCount !== undefined
                    ? `해결완료: ${stats.resolvedCount}건`
                    : '데이터 없음'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs defaultValue="monthly-detection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monthly-detection">
            <TrendingUp className="size-4 mr-2" />
            월별 체납자 탐지 추이
          </TabsTrigger>
          <TabsTrigger value="monthly-new">
            <TrendingUp className="size-4 mr-2" />
            월별 추이
          </TabsTrigger>
          <TabsTrigger value="today">
            <Calendar className="size-4 mr-2" />
            오늘 탐지
          </TabsTrigger>
        </TabsList>

        {/* 월별 추이 탭 */}
        <TabsContent value="monthly-new" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5" />
                월별 체납자 추이
              </CardTitle>
              <CardDescription>최근 7개월 통계</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600">데이터를 불러오는 중...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-2 font-medium">오류 발생</div>
                  <div className="text-sm text-gray-500 mb-4">{error}</div>
                  <button
                    onClick={() => fetchStats()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    다시 시도
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-gray-700 font-medium">월</th>
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">신규 체납자</th>
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">탐지 건수</th>
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">해결완료</th>
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">해결률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.monthlyTrend && stats.monthlyTrend.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500">
                            월별 추이 데이터가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        stats?.monthlyTrend.map((item) => (
                          <tr key={item.month} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-gray-900 font-medium">{item.month}</td>
                            <td className="py-3 px-4 text-center text-orange-600 font-medium">{item.newArrears}명</td>
                            <td className="py-3 px-4 text-center text-green-600 font-medium">{item.detected}건</td>
                            <td className="py-3 px-4 text-center text-blue-600 font-medium">{item.resolved}건</td>
                            <td className="py-3 px-4 text-center">
                              <Badge
                                className={
                                  item.resolutionRate >= 80
                                    ? 'bg-green-500 text-white'
                                    : item.resolutionRate >= 70
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-red-500 text-white'
                                }
                              >
                                {item.resolutionRate}%
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 월별 체납자 탐지 추이 탭 (PowerBI) */}
        <TabsContent value="monthly-detection" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>월별 체납자 탐지 추이</CardTitle>
              <CardDescription>PowerBI 대시보드 - 체납자 탐지 분석</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {DELINQUENT_REPORT_URL ? (
                <div className="w-full">
                  <PowerBIEmbedView reportUrl={DELINQUENT_REPORT_URL} height="800px" />
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center m-6">
                  <div className="text-gray-500 mb-2">PowerBI 대시보드 연동 영역</div>
                  <p className="text-sm text-gray-400">PowerBI URL을 설정해주세요</p>
                  <div className="mt-4 h-64 bg-white rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <TrendingUp className="size-12 text-gray-300" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 오늘 탐지 탭 */}
        <TabsContent value="today" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>오늘 탐지된 체납 차량</CardTitle>
              <CardDescription>국세청에서 수정한 탐지 결과가 실시간으로 반영됩니다</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDetections ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600">데이터를 불러오는 중...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-2 font-medium">오류 발생</div>
                  <div className="text-sm text-gray-500 mb-4">{error}</div>
                  <button
                    onClick={() => fetchTodayDetections()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    다시 시도
                  </button>
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
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">체납 금액</th>
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">체납 기간</th>
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">국세청 알림</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayDetections.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-500">
                            오늘 탐지된 체납 차량이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        todayDetections.map((detection) => (
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
                              {getDetectionStatusBadge(detection.detectionSuccess)}
                            </td>
                            <td className="py-3 px-4 text-center text-red-600 font-medium">
                              {detection.totalArrearsAmount
                                ? `${(detection.totalArrearsAmount / 10000).toFixed(0)}만원`
                                : '정보 없음'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {detection.arrearsPeriod ? (
                                <Badge variant="destructive">{detection.arrearsPeriod}</Badge>
                              ) : (
                                <span className="text-gray-400">정보 없음</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {detection.noticeSent ? (
                                <Badge className="bg-green-500 text-white">발송 완료</Badge>
                              ) : (
                                <Badge variant="secondary">대기중</Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

