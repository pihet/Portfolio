import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Calendar, TrendingUp, AlertTriangle, Eye, Gauge, ChevronRight, ChevronLeft } from 'lucide-react';
import { Progress } from '../../components/ui/progress';
import { getMonthlySafetyScores, getSessionSafetyDetail, type MonthlySafetyScore, type SessionSafetyDetail } from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import { useVehicle } from '../../hooks/useVehicle';

export default function UserSafetyScorePage() {
  const { vehicles, fetchVehicles } = useVehicle();
  const [scores, setScores] = useState<MonthlySafetyScore[]>([]);
  const [filteredScores, setFilteredScores] = useState<MonthlySafetyScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    fetchSafetyScores();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    const now = new Date();
    
    // 현재 날짜보다 미래인 데이터 필터링
    const validScores = scores.filter((score) => {
      if (!score.endTime && !score.startTime) return false;
      const scoreDate = score.endTime ? new Date(score.endTime) : (score.startTime ? new Date(score.startTime) : null);
      if (!scoreDate) return false;
      // 현재 날짜보다 미래인 데이터는 제외
      return scoreDate <= now;
    });
    
    // 선택한 차량으로 필터링
    let filtered = validScores;
    if (selectedVehicleId !== 'all') {
      const selectedVehicle = vehicles.find(v => v.id.toString() === selectedVehicleId);
      if (selectedVehicle?.carId) {
        filtered = validScores.filter(score => score.carId === selectedVehicle.carId);
      }
    }
    
    setFilteredScores(filtered);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 리셋
  }, [scores, selectedVehicleId, vehicles]);

  const fetchSafetyScores = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMonthlySafetyScores(selectedYear, selectedMonth);
      setScores(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
      console.error('Error fetching safety scores:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (sessionId: string) => {
    navigate(`/user/safety-detail/${sessionId}`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500 text-white">우수</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-500 text-white">양호</Badge>;
    return <Badge variant="destructive">주의</Badge>;
  };

  const months = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // 월별 평균 점수 계산 (필터링된 점수 기준)
  const averageScore = filteredScores.length > 0
    ? Math.round(filteredScores.reduce((sum, s) => sum + s.safetyScore, 0) / filteredScores.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">월별 안전운전 점수</h1>
          <p className="text-gray-600">주행별 안전운전 점수 및 상세 정보</p>
        </div>
        {vehicles.length > 0 && (
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="차량 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 차량</SelectItem>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                  {vehicle.licensePlate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 월 선택 컨트롤 */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Calendar className="size-5 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">기간 선택</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">연도:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">월:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                >
                  {months.map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 월별 평균 점수 */}
      {filteredScores.length > 0 && (
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-blue-50/50 to-white shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <TrendingUp className="size-6 text-blue-600" />
              {selectedYear}년 {selectedMonth}월 평균 안전운전 점수
            </CardTitle>
            <CardDescription className="text-base">
              총 {filteredScores.length}개 주행 세션의 평균 점수
              {selectedVehicleId !== 'all' && ` (선택한 차량만)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="relative">
                <div className={`text-7xl font-bold ${getScoreColor(averageScore)}`}>
                  {averageScore}
                </div>
                <div className="absolute -top-2 -right-2">
                  {getScoreBadge(averageScore)}
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">평균 점수 진행률</span>
                  <span className="text-lg font-bold text-gray-900">{averageScore}/100</span>
                </div>
                <Progress value={averageScore} className="h-4" />
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>• 총 세션: {filteredScores.length}개</span>
                  <span>• 평균 점수: {averageScore}점</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 로딩 및 에러 상태 */}
      {loading && (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <div className="text-gray-600 font-medium">데이터를 불러오는 중...</div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-2 border-red-200 bg-red-50 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <AlertTriangle className="size-12 text-red-500" />
              <div className="text-red-700 font-medium text-lg">{error}</div>
              <Button 
                onClick={fetchSafetyScores} 
                className="mt-2 bg-red-600 hover:bg-red-700 text-white"
                size="lg"
              >
                다시 시도
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 주행별 점수 목록 */}
      {!loading && !error && (
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">주행별 안전운전 점수</CardTitle>
            <CardDescription className="text-base">
              {selectedYear}년 {selectedMonth}월 주행 세션별 점수 및 상세 정보
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredScores.length === 0 ? (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <Calendar className="size-16 text-gray-300" />
                  <div className="text-gray-500 text-lg font-medium">
                    {selectedVehicleId !== 'all' 
                      ? '선택한 차량의 데이터가 없습니다.'
                      : `${selectedYear}년 ${selectedMonth}월 데이터가 없습니다.`}
                  </div>
                  <p className="text-sm text-gray-400">
                    {selectedVehicleId !== 'all' 
                      ? '다른 차량을 선택하거나 전체 차량을 선택해주세요.'
                      : '다른 기간을 선택해주세요.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {(() => {
                    // 페이지네이션 계산
                    const totalPages = Math.ceil(filteredScores.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const currentPageScores = filteredScores.slice(startIndex, endIndex);
                    
                    return currentPageScores.map((score) => (
                  <Card
                    key={score.sessionId}
                    className="border-2 border-gray-200 hover:border-blue-400 hover:shadow-md transition-all duration-200"
                  >
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1">
                          {/* 점수 및 기본 정보 */}
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`text-5xl font-bold ${getScoreColor(score.safetyScore)}`}>
                              {score.safetyScore}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <div className="font-semibold text-gray-900 text-lg break-all">
                                  세션 ID: {score.sessionId}
                                </div>
                                {getScoreBadge(score.safetyScore)}
                              </div>
                              <div className="text-sm text-gray-600 mb-1">
                                차량 ID: {score.carId}
                              </div>
                              {score.endTime && (
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                  <Calendar className="size-3" />
                                  종료 시간: {new Date(score.endTime).toLocaleString('ko-KR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 통계 정보 */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                              <Eye className="size-5 text-yellow-600 mt-0.5" />
                              <div>
                                <div className="text-xs font-medium text-gray-600 mb-1">졸음운전 감점</div>
                                <div className="text-xl font-bold text-yellow-700">
                                  {score.drowsyPenalty}점
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                              <Gauge className="size-5 text-red-600 mt-0.5" />
                              <div>
                                <div className="text-xs font-medium text-gray-600 mb-1">급가속/급감속 감점</div>
                                <div className="text-xl font-bold text-red-700">
                                  {score.rapidPenalty}점
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                              <AlertTriangle className="size-5 text-orange-600 mt-0.5" />
                              <div>
                                <div className="text-xs font-medium text-gray-600 mb-1">총 감점</div>
                                <div className="text-xl font-bold text-orange-700">
                                  {score.totalPenalty}점
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                              <TrendingUp className="size-5 text-blue-600 mt-0.5" />
                              <div>
                                <div className="text-xs font-medium text-gray-600 mb-1">상세 통계</div>
                                <div className="text-xs text-gray-700 space-y-0.5">
                                  <div>눈감음: {score.gazeClosureCount}</div>
                                  <div>고개떨림: {score.headDropCount}</div>
                                  <div>하품: {score.yawnFlagCount}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleViewDetail(score.sessionId)}
                          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                          size="lg"
                        >
                          상세보기
                          <ChevronRight className="size-4 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                    ));
                  })()}
                </div>
                
                {/* 페이지네이션 */}
                {filteredScores.length > 0 && (() => {
                  const totalPages = Math.ceil(filteredScores.length / itemsPerPage);
                  const maxVisiblePages = 5;
                  
                  // 표시할 페이지 번호 계산
                  const getPageNumbers = () => {
                    const pages: (number | string)[] = [];
                    
                    if (totalPages <= maxVisiblePages) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      if (currentPage <= 3) {
                        for (let i = 1; i <= 5; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      } else if (currentPage >= totalPages - 2) {
                        pages.push(1);
                        pages.push('...');
                        for (let i = totalPages - 4; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        pages.push(1);
                        pages.push('...');
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      }
                    }
                    
                    return pages;
                  };
                  
                  const pageNumbers = getPageNumbers();
                  
                  return (
                    <div className="flex flex-col items-center gap-4 mt-6 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        전체 {filteredScores.length}개 중 {((currentPage - 1) * itemsPerPage) + 1}-
                        {Math.min(currentPage * itemsPerPage, filteredScores.length)}개 표시
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1"
                        >
                          <ChevronLeft className="size-4" />
                          이전
                        </Button>
                        
                        <div className="flex items-center gap-1">
                          {pageNumbers.map((page, index) => {
                            if (page === '...') {
                              return (
                                <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                                  ...
                                </span>
                              );
                            }
                            
                            const pageNum = page as number;
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className={`min-w-[40px] ${
                                  currentPage === pageNum
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "hover:bg-gray-100"
                                }`}
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
                          className="flex items-center gap-1"
                        >
                          다음
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

