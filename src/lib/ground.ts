/** Routes drawn on the night canvas (student, projector, full-screen preview). */
export function isNightPath(pathname: string): boolean {
  return /^\/(join|game|presenter)(\/|$)/.test(pathname) || /^\/teacher\/quizzes\/[^/]+\/preview\/?$/.test(pathname);
}

export const THEME_COLORS = { paper: '#F6F4EF', night: '#0E1013' } as const;
