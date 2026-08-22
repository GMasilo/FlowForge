import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { HomeRedirect } from '@/features/auth/HomeRedirect'
import { ProfilePage } from '@/features/auth/ProfilePage'
import { AppShell } from '@/app/AppShell'
import { InstancesPage } from '@/features/instances/InstancesPage'
import { InstanceProvider } from '@/features/instances/InstanceContext'
import { MembersPage } from '@/features/instances/MembersPage'
import { AuditLogPage } from '@/features/instances/AuditLogPage'
import { WebhooksPage } from '@/features/instances/WebhooksPage'
import { UsagePage } from '@/features/instances/UsagePage'
import { ConversationsPage } from '@/features/instances/ConversationsPage'
import { ConversationDetailPage } from '@/features/instances/ConversationDetailPage'
import { AnalyticsPage } from '@/features/instances/AnalyticsPage'
import { ChatbotsPage } from '@/features/chatbots/ChatbotsPage'
import { ChatbotSettingsPage } from '@/features/chatbots/ChatbotSettingsPage'
import { ChatbotDataPage } from '@/features/chatbots/ChatbotDataPage'
import { TemplatesPage } from '@/features/templates/TemplatesPage'
import { ConnectionsPage } from '@/features/connections/ConnectionsPage'
import { DesignerPage } from '@/features/designer/DesignerPage'
import { PublicChatPage } from '@/features/chat/PublicChatPage'
import { PublicShell } from '@/features/docs/PublicShell'
import { DocsPage } from '@/features/docs/DocsPage'
import { FaqPage } from '@/features/docs/FaqPage'
import { HelpPage } from '@/features/docs/HelpPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/c/:publicSlug" element={<PublicChatPage />} />
              <Route path="/embed/:publicSlug" element={<PublicChatPage embed />} />
              <Route element={<PublicShell />}>
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/help" element={<HelpPage />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomeRedirect />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/instances" element={<InstancesPage />} />
                </Route>
                <Route path="/instances/:instanceId" element={<InstanceProvider />}>
                  <Route element={<AppShell />}>
                    <Route index element={<ChatbotsPage />} />
                    <Route path="connections" element={<ConnectionsPage />} />
                    <Route path="members" element={<MembersPage />} />
                    <Route path="audit" element={<AuditLogPage />} />
                    <Route path="webhooks" element={<WebhooksPage />} />
                    <Route path="usage" element={<UsagePage />} />
                    <Route path="conversations" element={<ConversationsPage />} />
                    <Route path="conversations/:sessionId" element={<ConversationDetailPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="chatbots/:chatbotId" element={<ChatbotSettingsPage />} />
                    <Route path="chatbots/:chatbotId/design" element={<DesignerPage />} />
                    <Route path="chatbots/:chatbotId/templates" element={<TemplatesPage />} />
                    <Route path="chatbots/:chatbotId/data" element={<ChatbotDataPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
