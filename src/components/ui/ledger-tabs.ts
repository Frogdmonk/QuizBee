/** Left status tab colours for Ledger rows. Status is also always given as text. */
export const LEDGER_TABS = {
  published: 'bg-success-600',
  draft: 'bg-line-strong',
  archived: 'bg-ink-500',
  live: 'bg-signal-600',
  neutral: 'bg-line',
  'answer-a': 'bg-answer-a',
  'answer-b': 'bg-answer-b',
  'answer-c': 'bg-answer-c',
  'answer-d': 'bg-answer-d',
} as const;

export type LedgerTab = keyof typeof LEDGER_TABS;

export const ANSWER_TABS: LedgerTab[] = ['answer-a', 'answer-b', 'answer-c', 'answer-d'];
