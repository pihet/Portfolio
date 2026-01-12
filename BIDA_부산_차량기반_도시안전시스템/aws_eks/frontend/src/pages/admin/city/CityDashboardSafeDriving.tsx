import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { MapPin, Award } from 'lucide-react';
import PowerBIEmbedView from '../../../components/common/powerbi/PowerBIEmbedView';

const POWER_BI_REPORT_URL = import.meta.env.VITE_POWER_BI_SAFE_DRIVING_URL || "";
const POWER_BI_BEST_DRIVER_URL = import.meta.env.VITE_POWER_BI_BEST_DRIVER_URL || "";

// 디버깅: 환경 변수 확인
console.log('Power BI URLs:', {
  SAFE_DRIVING: POWER_BI_REPORT_URL || 'NOT SET',
  BEST_DRIVER: POWER_BI_BEST_DRIVER_URL || 'NOT SET'
});

export default function CityDashboardSafeDriving() {
  const [activeTab, setActiveTab] = useState<string>('map-visualization');

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-5xl font-bold text-gray-950 mb-4 tracking-tight">안전운전 관리</h1>
        <p className="text-xl text-gray-700 leading-relaxed font-medium">부산시 전체 안전운전 현황 및 통계 (실시간)</p>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="map-visualization">
            <MapPin className="size-4 mr-2" />
            월별 구별 운전습관 지도 시각화
          </TabsTrigger>
          <TabsTrigger value="best-driver-powerbi">
            <Award className="size-4 mr-2" />
            베스트 드라이버 PowerBI
          </TabsTrigger>
        </TabsList>

        {/* 월별 구별 운전습관 지도 시각화 탭 */}
        <TabsContent value="map-visualization" className="space-y-6">
          {/* PowerBI 대시보드 영역 */}
          <Card>
            <CardHeader>
              <CardTitle>월별 구별 운전습관 지도 시각화</CardTitle>
              <CardDescription>PowerBI 대시보드 - Best/Worst Place 분석</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {POWER_BI_REPORT_URL ? (
                <div className="w-full">
                  <PowerBIEmbedView reportUrl={POWER_BI_REPORT_URL} height="800px" />
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center m-6">
                  <div className="text-gray-500 mb-2">PowerBI 대시보드 연동 영역</div>
                  <p className="text-sm text-gray-400">PowerBI URL을 설정해주세요</p>
                  <div className="mt-4 h-64 bg-white rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <MapPin className="size-12 text-gray-300" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 베스트 드라이버 PowerBI 탭 */}
        <TabsContent value="best-driver-powerbi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>베스트 드라이버 분석</CardTitle>
              <CardDescription>PowerBI 대시보드 - 베스트 드라이버 통계 분석</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {POWER_BI_BEST_DRIVER_URL ? (
                <div className="w-full">
                  <PowerBIEmbedView reportUrl={POWER_BI_BEST_DRIVER_URL} height="800px" />
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center m-6">
                  <div className="text-gray-500 mb-2">PowerBI 대시보드 연동 영역</div>
                  <p className="text-sm text-gray-400">PowerBI URL을 설정해주세요</p>
                  <div className="mt-4 h-64 bg-white rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <Award className="size-12 text-gray-300" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

