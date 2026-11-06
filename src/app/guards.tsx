import type { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { FullPageLoader } from '@/components/ui/FullPageLoader';
import { safeNextPath } from '@/lib/redirect';

/**
 * Client-side gate for teacher pages. This is a UX convenience only — every
 * teacher table is independently protected by Row Level Security.
 */
export function RequireTeacher({ children }: { children: ReactNode }) {
  const { state } = useTeacherAuth();
  const location = useLocation();

  if (state.status === 'loading') return <FullPageLoader label="Checking your session" />;
  if (state.status === 'signed_out') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/** Login/register pages redirect away when a teacher is already signed in. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { state } = useTeacherAuth();
  const [params] = useSearchParams();

  if (state.status === 'loading') return <FullPageLoader />;
  if (state.status === 'signed_in') return <Navigate to={safeNextPath(params.get('next'))} replace />;
  return <>{children}</>;
}
