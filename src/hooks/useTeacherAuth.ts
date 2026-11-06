import { useContext } from 'react';
import { TeacherAuthContext, type TeacherAuthContextValue } from '@/contexts/auth-context';

export function useTeacherAuth(): TeacherAuthContextValue {
  const ctx = useContext(TeacherAuthContext);
  if (!ctx) throw new Error('useTeacherAuth must be used inside <TeacherAuthProvider>.');
  return ctx;
}

/** Convenience for pages behind <RequireTeacher>, where a session is guaranteed. */
export function useSignedInTeacher() {
  const { state, ...rest } = useTeacherAuth();
  if (state.status !== 'signed_in') {
    throw new Error('useSignedInTeacher used outside a protected teacher route.');
  }
  return { ...state, ...rest };
}
