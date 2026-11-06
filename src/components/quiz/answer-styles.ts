/**
 * Answer tile colours A–D. Always paired with a letter, a kit pattern and a fixed position so
 * colour is never the only cue. D (amber) carries ink text; the others carry white.
 */
export const ANSWER_STYLES = [
  {
    letter: 'A',
    bg: 'bg-answer-a',
    text: 'text-answer-a',
    ring: 'ring-answer-a',
    soft: 'bg-answer-a/10',
    fg: 'text-white',
    press: 'bg-answer-a-press',
    edge: 'border-answer-a-press',
    kit: 'kit-a',
    softBg: 'bg-answer-a-soft',
  },
  {
    letter: 'B',
    bg: 'bg-answer-b',
    text: 'text-answer-b',
    ring: 'ring-answer-b',
    soft: 'bg-answer-b/10',
    fg: 'text-white',
    press: 'bg-answer-b-press',
    edge: 'border-answer-b-press',
    kit: 'kit-b',
    softBg: 'bg-answer-b-soft',
  },
  {
    letter: 'C',
    bg: 'bg-answer-c',
    text: 'text-answer-c',
    ring: 'ring-answer-c',
    soft: 'bg-answer-c/10',
    fg: 'text-white',
    press: 'bg-answer-c-press',
    edge: 'border-answer-c-press',
    kit: 'kit-c',
    softBg: 'bg-answer-c-soft',
  },
  {
    letter: 'D',
    bg: 'bg-answer-d',
    text: 'text-warning-700',
    ring: 'ring-answer-d',
    soft: 'bg-answer-d/10',
    fg: 'text-ink-900',
    press: 'bg-answer-d-press',
    edge: 'border-answer-d-press',
    kit: 'kit-d',
    softBg: 'bg-answer-d-soft',
  },
] as const;

/** Dimmed tile (wrong or not picked, Phase 4): keeps its shape with a night-line edge. */
export const ANSWER_DIM = 'bg-answer-dim border border-night-line text-night-muted';

export function answerStyle(index: number) {
  return ANSWER_STYLES[index % ANSWER_STYLES.length];
}
