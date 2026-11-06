/**
 * Pages whose functionality is scheduled for a later development phase.
 * They render an explicit "not built yet" notice instead of fake UI.
 */
export const UPCOMING = {
  sessions: {
    title: 'Live Sessions',
    phase: 3,
    summary: 'Host a quiz live with your class.',
    items: [
      'Six-digit game PIN and QR code',
      'Waiting room with lock / unlock and participant removal',
      'Projector view for the classroom screen',
    ],
  },
  history: {
    title: 'Quiz History',
    phase: 5,
    summary: 'Results of the sessions you have hosted.',
    items: ['Final rankings and podium', 'Per-student scores and correct-answer counts', 'Per-question answer breakdown'],
  },
} as const;

export type UpcomingKey = keyof typeof UPCOMING;
