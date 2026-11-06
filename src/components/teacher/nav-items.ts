import { BookOpenText, History, LayoutDashboard, Radio, Share2, UserRound, type LucideIcon } from 'lucide-react';

export type TeacherNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Development phase in which the page becomes functional (omitted = available now). */
  availableInPhase?: number;
};

export const TEACHER_NAV: TeacherNavItem[] = [
  { to: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/teacher/quizzes', label: 'My Quizzes', icon: BookOpenText, availableInPhase: 2 },
  { to: '/teacher/shared', label: 'Shared with Me', icon: Share2, availableInPhase: 2 },
  { to: '/teacher/sessions', label: 'Live Sessions', icon: Radio, availableInPhase: 3 },
  { to: '/teacher/analytics', label: 'Quiz History', icon: History, availableInPhase: 5 },
  { to: '/teacher/profile', label: 'Profile', icon: UserRound },
];
