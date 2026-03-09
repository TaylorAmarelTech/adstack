import { Routes, Route, Navigate } from 'react-router';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { NewslettersPage } from './pages/publisher/NewslettersPage';
import { CreateNewsletterPage } from './pages/publisher/CreateNewsletterPage';
import { NewsletterDetailPage } from './pages/publisher/NewsletterDetailPage';
import { ProfilePage } from './pages/settings/ProfilePage';
import { CampaignsPage } from './pages/buyer/CampaignsPage';
import { CreateCampaignPage } from './pages/buyer/CreateCampaignPage';
import { ProtectedRoute } from './components/ProtectedRoute';

export function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Protected dashboard routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/newsletters" element={<NewslettersPage />} />
          <Route path="/newsletters/new" element={<CreateNewsletterPage />} />
          <Route path="/newsletters/:id" element={<NewsletterDetailPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/new" element={<CreateCampaignPage />} />
          <Route path="/settings" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
