import { Outlet, ScrollRestoration } from 'react-router';
import { TeacherAuthProvider } from '@/contexts/TeacherAuthProvider';

export function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

/** Teacher auth is mounted only for teacher-facing branches, never for students. */
export function TeacherAuthBranch() {
  return (
    <TeacherAuthProvider>
      <Outlet />
    </TeacherAuthProvider>
  );
}
