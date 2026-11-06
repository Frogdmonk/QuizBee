import { useLayoutEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { TeacherAuthProvider } from '@/contexts/TeacherAuthProvider';
import { isNightPath, THEME_COLORS } from '@/lib/ground';

/** Keeps <html data-ground> and the browser theme-color in step with the route (paper or night). */
function useGround() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const ground = isNightPath(pathname) ? 'night' : 'paper';
    document.documentElement.dataset.ground = ground;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[ground]);
  }, [pathname]);
}

export function RootLayout() {
  useGround();
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
