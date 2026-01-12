import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { UserX, Users, TrendingDown, Calendar, Loader2, MapPin, Clock } from 'lucide-react';
import PowerBIEmbedView from '../../../components/common/powerbi/PowerBIEmbedView';
import { getCityMissingPersonStats, getTodayMissingPersonDetections, type CityMissingPersonStats, type TodayMissingPersonDetection } from '../../../utils/api';

const MISSING_PERSON_REPORT_URL = import.meta.env.VITE_POWER_BI_MISSING_PERSON_URL || "";

export default function CityDashboardMissingPerson() {
  const [stats, setStats] = useState<CityMissingPersonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayDetections, setTodayDetections] = useState<TodayMissingPersonDetection[]>([]);
  const [loadingDetections, setLoadingDetections] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchTodayDetections();
  }, []);

  // 주기적 자동 새로고침 (30초마다) - 경찰청에서 수정한 내용 반영
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
      const data = await getCityMissingPersonStats();
      setStats(data);
    } catch (err) {
      console.error('실종자 통계 조회 실패:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : '실종자 통계를 불러오는데 실패했습니다.');
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
      const data = await getTodayMissingPersonDetections();
      setTodayDetections(data);
    } catch (err) {
      console.error('오늘 탐지된 실종자 조회 실패:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : '오늘 탐지된 실종자를 불러오는데 실패했습니다.');
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
        <h1 className="text-5xl font-bold text-gray-950 mb-4 tracking-tight">실종자 관리</h1>
        <p className="text-xl text-gray-700 leading-relaxed font-medium">실종자 신고 및 발견 현황 분석 (준실시간)</p>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserX className="size-4 text-orange-500" />
              이번달 실종 신고
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
                <div className="text-2xl font-bold text-orange-600">
                  {stats?.monthlyReports || 0}건
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="size-4 text-green-500" />
              이번달 실종자 탐지
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
                <div className="text-2xl font-bold text-green-600">
                  {stats?.monthlyFound || 0}건
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="size-4 text-blue-500" />
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
                  {stats?.monthlyReports && stats.monthlyReports > 0
                    ? `해결완료: ${stats.resolvedCount || 0}건 / 신고: ${stats.monthlyReports}건`
                    : '데이터 없음'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs defaultValue="trend" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="powerbi">
            <Calendar className="size-4 mr-2" />
            월별 부산 실종자 발생 추이
          </TabsTrigger>
          <TabsTrigger value="trend">
            <Calendar className="size-4 mr-2" />
            월별 추이
          </TabsTrigger>
          <TabsTrigger value="today">
            <Calendar className="size-4 mr-2" />
            오늘 탐지
          </TabsTrigger>
        </TabsList>

        {/* PowerBI 대시보드 탭 */}
        <TabsContent value="powerbi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>월별 부산 실종자 발생 추이</CardTitle>
              <CardDescription>PowerBI 대시보드 - 신고 및 발견 추이 분석</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {MISSING_PERSON_REPORT_URL ? (
                <div className="w-full">
                  <PowerBIEmbedView reportUrl={MISSING_PERSON_REPORT_URL} height="800px" />
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center m-6">
                  <div className="text-gray-500 mb-2">PowerBI 대시보드 연동 영역</div>
                  <p className="text-sm text-gray-400">PowerBI URL을 설정해주세요</p>
                  <div className="mt-4 h-64 bg-white rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <TrendingDown className="size-12 text-gray-300" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 월별 추이 탭 */}
        <TabsContent value="trend" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5" />
                월별 부산 실종자 발생 추이
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
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">신고 건수</th>
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
                            <td className="py-3 px-4 text-center text-orange-600 font-medium">{item.reports}건</td>
                            <td className="py-3 px-4 text-center text-green-600 font-medium">{item.found}건</td>
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

        {/* 오늘 탐지 탭 */}
        <TabsContent value="today" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>오늘 탐지된 실종자</CardTitle>
              <CardDescription>경찰청에서 수정한 탐지 결과가 실시간으로 반영됩니다</CardDescription>
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
                        <th className="text-left py-3 px-4 text-gray-700 font-medium">실종자 ID</th>
                        <th className="text-left py-3 px-4 text-gray-700 font-medium">이름</th>
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">나이</th>
                        <th className="text-left py-3 px-4 text-gray-700 font-medium">탐지 위치</th>
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">탐지 시간</th>
                        <th className="text-center py-3 px-4 text-gray-700 font-medium">탐지 결과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayDetections.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500">
                            오늘 탐지된 실종자가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        todayDetections.map((detection) => (
                          <tr key={detection.detectionId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-gray-900 font-medium">{detection.missingId}</td>
                            <td className="py-3 px-4 text-gray-900 font-medium">{detection.missingName}</td>
                            <td className="py-3 px-4 text-center text-gray-700">
                              {detection.missingAge !== null ? `${detection.missingAge}세` : '-'}
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
                              {getDetectionStatusBadge(detection.detectionSuccess)}
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

