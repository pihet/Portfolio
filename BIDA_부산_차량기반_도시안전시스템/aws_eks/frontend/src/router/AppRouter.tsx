import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import ErrorBoundary from '../components/common/ErrorBoundary';

// 레이아웃 (자주 사용되므로 일반 import)
import UserLayout from '../layouts/UserLayout';
import AdminLayout from '../layouts/AdminLayout';

// 인증 페이지 (초기 로딩에 필요하므로 일반 import)
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import OAuthCallback from '../pages/auth/OAuthCallback';

// Lazy loading - 일반 사용자
const UserDashboardPage = lazy(() => import('../pages/user/UserDashboardPage'));
const UserMyPage = lazy(() => import('../pages/user/UserMyPage'));
const UserSafetyScorePage = lazy(() => import('../pages/user/UserSafetyScorePage'));
const UserSafetyDetailPage = lazy(() => import('../pages/user/UserSafetyDetailPage'));

// Lazy loading - 부산시 관리자
const CityDashboardSafeDriving = lazy(() => import('../pages/admin/city/CityDashboardSafeDriving'));
const CityDashboardDelinquent = lazy(() => import('../pages/admin/city/CityDashboardDelinquent'));
const CityDashboardMissingPerson = lazy(() => import('../pages/admin/city/CityDashboardMissingPerson'));

// Lazy loading - 국세청 관리자
const NTSDashboard = lazy(() => import('../pages/admin/nts/NTSDashboard'));

// Lazy loading - 경찰청 관리자
const PoliceDashboard = lazy(() => import('../pages/admin/police/PoliceDashboard'));

// Lazy loading - 시스템 관리자
const SystemDashboardPage = lazy(() => import('../pages/admin/system/SystemDashboardPage'));
const SystemUserManagementPage = lazy(() => import('../pages/admin/system/SystemUserManagementPage'));
const SystemLogMonitoringPage = lazy(() => import('../pages/admin/system/SystemLogMonitoringPage'));

// 로딩 컴포넌트
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-gray-600">로딩 중...</div>
  </div>
);

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />

      {/* 일반 사용자 라우트 */}
      <Route
        path="/user/*"
        element={
          <ProtectedRoute allowedRoles={['GENERAL']}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/user/dashboard" replace />} />
        <Route 
          path="dashboard" 
          element={
            <Suspense fallback={<PageLoader />}>
              <UserDashboardPage />
            </Suspense>
          } 
        />
        <Route 
          path="safety-score" 
          element={
            <Suspense fallback={<PageLoader />}>
              <UserSafetyScorePage />
            </Suspense>
          } 
        />
        <Route 
          path="safety-detail/:sessionId" 
          element={
            <Suspense fallback={<PageLoader />}>
              <UserSafetyDetailPage />
            </Suspense>
          } 
        />
        <Route 
          path="mypage" 
          element={
            <Suspense fallback={<PageLoader />}>
              <UserMyPage />
            </Suspense>
          } 
        />
      </Route>

      {/* 부산시 관리자 라우트 */}
      <Route
        path="/admin/city/*"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout type="busan" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/city/safe-driving" replace />} />
        <Route 
          path="safe-driving" 
          element={
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <CityDashboardSafeDriving />
              </Suspense>
            </ErrorBoundary>
          } 
        />
        <Route 
          path="delinquent" 
          element={
            <Suspense fallback={<PageLoader />}>
              <CityDashboardDelinquent />
            </Suspense>
          } 
        />
        <Route 
          path="missing-person" 
          element={
            <Suspense fallback={<PageLoader />}>
              <CityDashboardMissingPerson />
            </Suspense>
          } 
        />
      </Route>

      {/* 국세청 관리자 라우트 */}
      <Route
        path="/admin/nts"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout type="nts" />
          </ProtectedRoute>
        }
      >
        <Route 
          index 
          element={
            <Suspense fallback={<PageLoader />}>
              <NTSDashboard />
            </Suspense>
          } 
        />
      </Route>

      {/* 경찰청 관리자 라우트 */}
      <Route
        path="/admin/police"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout type="police" />
          </ProtectedRoute>
        }
      >
        <Route 
          index 
          element={
            <Suspense fallback={<PageLoader />}>
              <PoliceDashboard />
            </Suspense>
          } 
        />
      </Route>

      {/* 시스템 관리자 라우트 */}
      <Route
        path="/admin/system/*"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout type="system" />
          </ProtectedRoute>
        }
      >
        <Route 
          index 
          element={
            <Suspense fallback={<PageLoader />}>
              <SystemDashboardPage />
            </Suspense>
          } 
        />
        <Route 
          path="users" 
          element={
            <Suspense fallback={<PageLoader />}>
              <SystemUserManagementPage />
            </Suspense>
          } 
        />
        <Route 
          path="logs" 
          element={
            <Suspense fallback={<PageLoader />}>
              <SystemLogMonitoringPage />
            </Suspense>
          } 
        />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}



