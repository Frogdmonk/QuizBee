/**
 * Pages whose functionality is scheduled for a later development phase.
 * They render an explicit "not built yet" notice instead of fake UI.
 */
export const UPCOMING = {
  history: {
    title: 'Quiz History',
    phase: 5,
    summary: 'Results of the sessions you have hosted.',
    items: ['Final rankings and podium', 'Per-student scores and correct-answer counts', 'Per-question answer breakdown'],
  },
} as const;

export type UpcomingKey = keyof typeof UPCOMING;
