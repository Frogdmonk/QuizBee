import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { TeacherProfile } from '@/types/database';

export type ProfileStatus = 'loading' | 'ready' | 'error';

export type TeacherAuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | {
      status: 'signed_in';
      session: Session;
      user: User;
      profile: TeacherProfile | null;
      profileStatus: ProfileStatus;
    };

export type TeacherAuthContextValue = {
  state: TeacherAuthState;
  /** True after the user arrives through a password-recovery email link. */
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  setProfile: (profile: TeacherProfile) => void;
  reloadProfile: () => void;
  signOut: () => Promise<void>;
};

export const TeacherAuthContext = createContext<TeacherAuthContextValue | null>(null);
