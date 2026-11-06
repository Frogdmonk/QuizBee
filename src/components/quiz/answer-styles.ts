/** Answer tile colours A–D. Always paired with a letter so colour is never the only cue. */
export const ANSWER_STYLES = [
  { letter: 'A', bg: 'bg-answer-a', text: 'text-answer-a', ring: 'ring-answer-a', soft: 'bg-answer-a/10' },
  { letter: 'B', bg: 'bg-answer-b', text: 'text-answer-b', ring: 'ring-answer-b', soft: 'bg-answer-b/10' },
  { letter: 'C', bg: 'bg-answer-c', text: 'text-answer-c', ring: 'ring-answer-c', soft: 'bg-answer-c/10' },
  { letter: 'D', bg: 'bg-answer-d', text: 'text-answer-d', ring: 'ring-answer-d', soft: 'bg-answer-d/10' },
] as const;

export function answerStyle(index: number) {
  return ANSWER_STYLES[index % ANSWER_STYLES.length];
}
