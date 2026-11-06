import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import type { Session, User } from '@supabase/supabase-js';
import { TeacherAuthContext, type TeacherAuthContextValue, type TeacherAuthState } from '@/contexts/auth-context';
import { GuestOnly, RequireTeacher } from '@/app/guards';

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderWithAuth(state: TeacherAuthState, initialPath: string) {
  const value: TeacherAuthContextValue = {
    state,
    isPasswordRecovery: false,
    clearPasswordRecovery: vi.fn(),
    setProfile: vi.fn(),
    reloadProfile: vi.fn(),
    signOut: vi.fn(),
  };
  const router = createMemoryRouter(
    [
      { path: '/login', element: <GuestOnly><p>login form</p></GuestOnly> },
      { path: '/teacher/dashboard', element: <RequireTeacher><p>secret dashboard</p></RequireTeacher> },
      { path: '/teacher/profile', element: <RequireTeacher><p>profile</p></RequireTeacher> },
      { path: '*', element: <LocationProbe /> },
    ],
    { initialEntries: [initialPath] },
  );
  // Show where we ended up regardless of which element rendered.
  render(
    <TeacherAuthContext.Provider value={value}>
      <RouterProvider router={router} />
    </TeacherAuthContext.Provider>,
  );
  return router;
}

const user = { id: 'u1', email: 't@school.test', is_anonymous: false } as unknown as User;
const signedIn: TeacherAuthState = {
  status: 'signed_in',
  session: { user } as unknown as Session,
  user,
  profile: null,
  profileStatus: 'loading',
};

describe('RequireTeacher', () => {
  it('redirects signed-out visitors to login with a return path', () => {
    const router = renderWithAuth({ status: 'signed_out' }, '/teacher/profile');
    expect(screen.queryByText('profile')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Fteacher%2Fprofile');
  });

  it('shows a loader while the session is being restored', () => {
    renderWithAuth({ status: 'loading' }, '/teacher/dashboard');
    expect(screen.getByRole('status', { name: /checking your session/i })).toBeInTheDocument();
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
  });

  it('renders the page for signed-in teachers', () => {
    renderWithAuth(signedIn, '/teacher/dashboard');
    expect(screen.getByText('secret dashboard')).toBeInTheDocument();
  });
});

describe('GuestOnly', () => {
  it('sends signed-in teachers to their safe "next" destination', () => {
    const router = renderWithAuth(signedIn, '/login?next=%2Fteacher%2Fprofile');
    expect(router.state.location.pathname).toBe('/teacher/profile');
  });

  it('ignores unsafe external "next" values', () => {
    const router = renderWithAuth(signedIn, '/login?next=https%3A%2F%2Fevil.example');
    expect(router.state.location.pathname).toBe('/teacher/dashboard');
  });

  it('shows the login form to signed-out visitors', () => {
    renderWithAuth({ status: 'signed_out' }, '/login');
    expect(screen.getByText('login form')).toBeInTheDocument();
  });
});
