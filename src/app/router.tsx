import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { RouteErrorPage } from './RouteErrorPage';
import { GuestOnly, RequireTeacher } from './guards';
import { RootLayout, TeacherAuthBranch } from '@/layouts/RootLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { TeacherLayout } from '@/layouts/TeacherLayout';
import type { UpcomingKey } from '@/pages/upcoming-features';

/* Every page is lazy-loaded: students joining from a phone never download
 * teacher dashboard code, and vice versa. */
const page = (loader: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await loader()).default,
});

/** Route props for a page that is scheduled for a later phase. */
const upcoming = (key: UpcomingKey) => ({
  handle: { upcoming: key },
  lazy: page(() => import('@/pages/UpcomingFeaturePage')),
});

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <TeacherAuthBranch />,
        children: [
          {
            element: <PublicLayout />,
            children: [{ index: true, lazy: page(() => import('@/pages/LandingPage')) }],
          },
          {
            element: (
              <GuestOnly>
                <AuthLayout />
              </GuestOnly>
            ),
            children: [
              { path: 'login', lazy: page(() => import('@/pages/auth/LoginPage')) },
              { path: 'register', lazy: page(() => import('@/pages/auth/RegisterPage')) },
              { path: 'forgot-password', lazy: page(() => import('@/pages/auth/ForgotPasswordPage')) },
            ],
          },
          {
            // Not guest-only: a recovery link signs the user in before they set a new password.
            element: <AuthLayout />,
            children: [{ path: 'reset-password', lazy: page(() => import('@/pages/auth/ResetPasswordPage')) }],
          },
          {
            path: 'teacher',
            element: (
              <RequireTeacher>
                <TeacherLayout />
              </RequireTeacher>
            ),
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', lazy: page(() => import('@/pages/teacher/DashboardPage')) },
              { path: 'quizzes', lazy: page(() => import('@/pages/teacher/QuizzesPage')) },
              {
                path: 'quizzes/create',
                handle: { wide: true },
                lazy: page(() => import('@/pages/teacher/QuizEditorPage')),
              },
              {
                path: 'quizzes/:quizId/edit',
                handle: { wide: true },
                lazy: page(() => import('@/pages/teacher/QuizEditorPage')),
              },
              { path: 'shared', lazy: page(() => import('@/pages/teacher/SharedWithMePage')) },
              { path: 'workspaces', lazy: page(() => import('@/pages/teacher/WorkspacesPage')) },
              { path: 'workspaces/:workspaceId', lazy: page(() => import('@/pages/teacher/WorkspaceDetailPage')) },
              { path: 'sessions', ...upcoming('sessions') },
              { path: 'analytics', ...upcoming('history') },
              { path: 'profile', lazy: page(() => import('@/pages/teacher/ProfilePage')) },
            ],
          },
          {
            // Workspace invite links. Signed-out teachers go through /login?next=… and come back here.
            path: 'invite/:token',
            element: (
              <RequireTeacher>
                <TeacherLayout />
              </RequireTeacher>
            ),
            children: [{ index: true, lazy: page(() => import('@/pages/teacher/JoinWorkspacePage')) }],
          },
          {
            // Full-screen, outside the dashboard chrome.
            path: 'teacher/quizzes/:quizId/preview',
            element: (
              <RequireTeacher>
                <Outlet />
              </RequireTeacher>
            ),
            children: [{ index: true, lazy: page(() => import('@/pages/teacher/QuizPreviewPage')) }],
          },
        ],
      },
      // Student + projector branches do not load teacher auth at all.
      { path: 'join', lazy: page(() => import('@/pages/student/LiveComingSoonPage')) },
      { path: 'join/:pin', lazy: page(() => import('@/pages/student/LiveComingSoonPage')) },
      { path: 'game/:sessionId', lazy: page(() => import('@/pages/student/LiveComingSoonPage')) },
      { path: 'presenter/:sessionId', lazy: page(() => import('@/pages/student/LiveComingSoonPage')) },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
]);
