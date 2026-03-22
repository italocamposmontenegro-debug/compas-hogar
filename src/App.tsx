// ============================================
// Casa Clara — Main App (Router)
// ============================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { HouseholdProvider } from './hooks/useHousehold';
import { AuthGuard, HouseholdGuard, PlusFeatureGuard, AdminGuard, PublicOnlyGuard } from './components/shared/Guards';
import { AppLayout } from './components/layout/AppLayout';

// Public pages
import { LandingPage } from './features/landing/LandingPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';

// Onboarding
import { OnboardingPage } from './features/onboarding/OnboardingPage';

// App pages
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { CategoriesPage } from './features/categories/CategoriesPage';
import { SplitPage } from './features/split/SplitPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { GoalsPage } from './features/goals/GoalsPage';
import { MonthlySummaryPage } from './features/monthly-review/MonthlySummaryPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { SubscriptionPage } from './features/subscription/SubscriptionPage';

// Plus pages
import { CsvImportPage } from './features/csv-import/CsvImportPage';
import { RecurringPage } from './features/recurring/RecurringPage';
import { ComparisonPage } from './features/comparison/ComparisonPage';
import { GuidedClosePage } from './features/guided-close/GuidedClosePage';

// Admin
import { AdminPage } from './features/admin/AdminPage';

// Invitation
import { InvitationPage } from './features/onboarding/InvitationPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HouseholdProvider>
          <Routes>
            {/* Public routes */}
            <Route element={<PublicOnlyGuard />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/registro" element={<RegisterPage />} />
              <Route path="/recuperar-clave" element={<ForgotPasswordPage />} />
            </Route>

            <Route path="/verificar-email" element={<VerifyEmailPage />} />
            <Route path="/restablecer-clave" element={<ResetPasswordPage />} />

            {/* Authenticated routes */}
            <Route element={<AuthGuard />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/invitacion/:token" element={<InvitationPage />} />

              {/* App routes (require household) */}
              <Route element={<HouseholdGuard />}>
                <Route element={<AppLayout />}>
                  <Route path="/app/dashboard" element={<DashboardPage />} />
                  <Route path="/app/movimientos" element={<TransactionsPage />} />
                  <Route path="/app/categorias" element={<CategoriesPage />} />
                  <Route path="/app/reparto" element={<SplitPage />} />
                  <Route path="/app/calendario" element={<CalendarPage />} />
                  <Route path="/app/metas" element={<GoalsPage />} />
                  <Route path="/app/resumen" element={<MonthlySummaryPage />} />
                  <Route path="/app/configuracion" element={<SettingsPage />} />
                  <Route path="/app/suscripcion" element={<SubscriptionPage />} />

                  {/* Plus routes */}
                  <Route element={<PlusFeatureGuard />}>
                    <Route path="/app/csv" element={<CsvImportPage />} />
                    <Route path="/app/recurrencias" element={<RecurringPage />} />
                    <Route path="/app/comparacion" element={<ComparisonPage />} />
                    <Route path="/app/cierre" element={<GuidedClosePage />} />
                  </Route>
                </Route>
              </Route>

              {/* Admin routes */}
              <Route element={<AdminGuard />}>
                <Route path="/admin/*" element={<AdminPage />} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HouseholdProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
