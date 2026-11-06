import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getTeacherClient } from '@/lib/supabase';
import { ensureMyProfile, fetchMyProfile } from '@/services/profile';
import { signOutTeacher } from '@/services/auth';
import type { TeacherProfile } from '@/types/database';
import { TeacherAuthContext, type TeacherAuthContextValue, type TeacherAuthState } from './auth-context';

export function TeacherAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeacherAuthState>({ status: 'loading' });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [profileNonce, setProfileNonce] = useState(0);

  // 1) Track the auth session. INITIAL_SESSION fires once the client has
  //    restored storage and processed any auth tokens in the URL.
  useEffect(() => {
    const client = getTeacherClient();
    let active = true;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      // Never call other Supabase methods synchronously inside this callback
      // (it runs while the auth lock is held), so defer state work.
      window.setTimeout(() => {
        if (!active) return;
        if (!session || session.user.is_anonymous) {
          setState({ status: 'signed_out' });
          return;
        }
        setState((prev) => {
          const sameUser = prev.status === 'signed_in' && prev.user.id === session.user.id;
          return {
            status: 'signed_in',
            session,
            user: session.user,
            profile: sameUser ? prev.profile : null,
            profileStatus: sameUser ? prev.profileStatus : 'loading',
          };
        });
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // 2) Load the teacher profile whenever the signed-in user changes.
  const userId = state.status === 'signed_in' ? state.user.id : null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        // ensureMyProfile covers accounts created before the profile trigger existed.
        const profile = (await fetchMyProfile(userId)) ?? (await ensureMyProfile());
        if (cancelled) return;
        setState((prev) =>
          prev.status === 'signed_in' && prev.user.id === userId ? { ...prev, profile, profileStatus: 'ready' } : prev,
        );
      } catch {
        if (cancelled) return;
        setState((prev) =>
          prev.status === 'signed_in' && prev.user.id === userId ? { ...prev, profileStatus: 'error' } : prev,
        );
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, profileNonce]);

  const setProfile = useCallback((profile: TeacherProfile) => {
    setState((prev) => (prev.status === 'signed_in' ? { ...prev, profile, profileStatus: 'ready' } : prev));
  }, []);

  const reloadProfile = useCallback(() => {
    setState((prev) => (prev.status === 'signed_in' ? { ...prev, profileStatus: 'loading' } : prev));
    setProfileNonce((n) => n + 1);
  }, []);

  const clearPasswordRecovery = useCallback(() => setIsPasswordRecovery(false), []);

  const signOut = useCallback(async () => {
    await signOutTeacher();
    setState({ status: 'signed_out' });
  }, []);

  const value = useMemo<TeacherAuthContextValue>(
    () => ({ state, isPasswordRecovery, clearPasswordRecovery, setProfile, reloadProfile, signOut }),
    [state, isPasswordRecovery, clearPasswordRecovery, setProfile, reloadProfile, signOut],
  );

  return <TeacherAuthContext.Provider value={value}>{children}</TeacherAuthContext.Provider>;
}
