import { BookOpenText, History, LayoutDashboard, Radio, Share2, UserRound, Users, type LucideIcon } from 'lucide-react';

export type TeacherNavItem = {
  to: string;
  label: string;
  /** Short label for the phone tab bar. */
  short: string;
  icon: LucideIcon;
  group: 'Teach' | 'Share' | 'Account';
  /** Shown on the phone tab bar (the rest live under "More"). */
  tab?: boolean;
  /** Marks a page that is planned but not built yet. */
  planned?: boolean;
};

export const TEACHER_NAV: TeacherNavItem[] = [
  { to: '/teacher/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, group: 'Teach', tab: true },
  { to: '/teacher/quizzes', label: 'My Quizzes', short: 'Quizzes', icon: BookOpenText, group: 'Teach', tab: true },
  { to: '/teacher/sessions', label: 'Live Sessions', short: 'Live', icon: Radio, group: 'Teach', tab: true },
  { to: '/teacher/analytics', label: 'Quiz History', short: 'History', icon: History, group: 'Teach', planned: true },
  { to: '/teacher/shared', label: 'Shared with Me', short: 'Shared', icon: Share2, group: 'Share', tab: true },
  { to: '/teacher/workspaces', label: 'Workspaces', short: 'Teams', icon: Users, group: 'Share' },
  { to: '/teacher/profile', label: 'Profile', short: 'Profile', icon: UserRound, group: 'Account' },
];

export const NAV_GROUPS: TeacherNavItem['group'][] = ['Teach', 'Share', 'Account'];
