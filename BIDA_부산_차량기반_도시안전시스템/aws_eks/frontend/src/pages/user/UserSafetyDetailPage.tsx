import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Eye, Gauge, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { Progress } from '../../components/ui/progress';
import { getSessionSafetyDetail, type SessionSafetyDetail } from '../../utils/api';

export default function UserSafetyDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SessionSafetyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchDetail();
    }
  }, [sessionId]);

  const fetchDetail = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getSessionSafetyDetail(sessionId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
      console.error('Error fetching safety detail:', err);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="size-4 mr-2" />
          돌아가기
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <div className="text-red-600">{error}</div>
            <Button onClick={fetchDetail} className="mt-4" variant="outline">
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="size-4 mr-2" />
          돌아가기
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">주행 상세 정보</h1>
          <p className="text-gray-600">세션 ID: {detail.sessionId}</p>
        </div>
      </div>

      {/* 전체 점수 카드 */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-blue-600" />
            안전운전 점수
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className={`text-6xl font-bold ${getScoreColor(detail.safetyScore)}`}>
              {detail.safetyScore}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">점수</span>
                <span className="text-gray-900 font-medium">{detail.safetyScore}/100</span>
              </div>
              <Progress value={detail.safetyScore} className="h-3" />
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-600">총 감점: </span>
                  <span className="font-medium text-red-600">{detail.totalPenalty}점</span>
                </div>
                {getScoreBadge(detail.safetyScore)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 감점 상세 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 졸음운전 감점 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="size-5 text-yellow-500" />
              졸음운전 감점
            </CardTitle>
            <CardDescription>총 감점: {detail.drowsyPenalty}점</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{detail.gazeClosureCount}</div>
                  <div className="text-xs text-gray-500">눈 감음</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{detail.headDropCount}</div>
                  <div className="text-xs text-gray-500">고개 떨림</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{detail.yawnFlagCount}</div>
                  <div className="text-xs text-gray-500">하품</div>
                </div>
              </div>
              {detail.drowsyDetails.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium text-gray-700">상세 내역:</div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {detail.drowsyDetails.map((drowsy) => (
                      <div
                        key={drowsy.drowsyId}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span>
                              {drowsy.detectedAt
                                ? new Date(drowsy.detectedAt).toLocaleString('ko-KR')
                                : '시간 정보 없음'}
                            </span>
                            <span className="text-xs text-gray-500 font-normal">
                              (지속시간: {drowsy.durationSec}초)
                            </span>
                          </div>
                          <Badge variant="outline" className="text-red-600">
                            감점 {drowsy.penalty}점
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <div>눈감음: {drowsy.gazeClosure || 0}</div>
                          <div>고개떨림: {drowsy.headDrop || 0}</div>
                          <div>하품: {drowsy.yawnFlag || 0}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 급가속/급감속 감점 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5 text-red-500" />
              급가속/급감속 감점
            </CardTitle>
            <CardDescription>총 감점: {detail.rapidPenalty}점</CardDescription>
          </CardHeader>
          <CardContent>
            {detail.rapidDetails.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700 mb-3">10분 단위 상세:</div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {detail.rapidDetails.map((rapid, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Clock className="size-4 text-gray-400" />
                          <span className="font-medium">{rapid.timeGroup}시</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">
                            발생: {rapid.rapidCount}회
                          </span>
                          <Badge variant="outline" className="text-red-600">
                            감점 {rapid.penalty}점
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                급가속/급감속 발생 기록이 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 세션 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>세션 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">차량 ID</div>
              <div className="font-medium">{detail.carId}</div>
            </div>
            {detail.startTime && (
              <div>
                <div className="text-sm text-gray-500">시작 시간</div>
                <div className="font-medium">
                  {new Date(detail.startTime).toLocaleString('ko-KR')}
                </div>
              </div>
            )}
            {detail.endTime && (
              <div>
                <div className="text-sm text-gray-500">종료 시간</div>
                <div className="font-medium">
                  {new Date(detail.endTime).toLocaleString('ko-KR')}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

