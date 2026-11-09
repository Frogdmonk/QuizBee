import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { recoveryIssues, newRecovery, SUGGESTED_SECONDS } from '@/lib/learning';
import { newQuestion, questionIssues, toSavePayload, emptyQuiz } from '@/lib/quiz-rules';
import { toGameState, type RawState } from '@/services/game';
import { LearningEditor } from '@/components/quiz/LearningEditor';
import { LevelAnnounce, LearningReport, MasteryBanner, MisconceptionNote, ReviewScreen } from '@/components/learning/LearningScreens';
import type { GameQuestion } from '@/types/game';

vi.mock('@/services/sessions', () => ({ setRecoverySkipped: vi.fn(async () => 9) }));
import { setRecoverySkipped } from '@/services/sessions';
import type { AppSupabaseClient } from '@/lib/supabase';
import { ToastProvider } from '@/contexts/ToastProvider';

describe('learning metadata in the editor', () => {
  it('a recovery question must be complete to publish (mirrors private.quiz_issues)', () => {
    const r = newRecovery();
    expect(recoveryIssues(r)).toEqual(['Write the recovery question text.', 'Fill in every recovery answer.', 'Mark the recovery question’s correct answer.']);
    const done = { ...r, prompt: 'P', options: r.options.slice(0, 2).map((o, i) => ({ ...o, label: `A${i}`, isCorrect: i === 0 })) };
    expect(recoveryIssues(done)).toEqual([]);
    expect(questionIssues({ ...newQuestion(), recovery: r })).toContain('Write the recovery question text.');
  });

  it('the save payload carries level, objective, kind, misconceptions and the recovery question', () => {
    const q = { ...newQuestion(), level: 2 as const, objective: ' Compare ', kind: 'predict' as const, recovery: { ...newRecovery(15), prompt: ' Again ' } };
    q.options[1] = { ...q.options[1], misconception: ' Mix-up ' };
    const payload = toSavePayload({ ...emptyQuiz(), title: 'T', questions: [q] }).questions[0];
    expect(payload).toMatchObject({ level: 2, objective: 'Compare', kind: 'predict', recovery: { prompt: 'Again', time_limit_seconds: 15 } });
    expect(payload.options[1].misconception).toBe('Mix-up');
    expect(payload.recovery!.options).toHaveLength(4);
  });

  it('suggests a timer per kind, which the teacher can apply (and a recovery question can be added)', () => {
    const dispatch = vi.fn();
    const q = { ...newQuestion(), kind: 'bug' as const, timeLimitSeconds: 20 };
    render(<LearningEditor question={q} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole('button', { name: `Use ${SUGGESTED_SECONDS.bug} s` }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'updateQuestion', key: q.key, patch: { timeLimitSeconds: 35 } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a recovery question' }));
    expect(dispatch.mock.calls.at(-1)![0]).toMatchObject({ type: 'updateQuestion', patch: { recovery: { prompt: '', timeLimitSeconds: 20 } } });
  });
});

const question = (over: Partial<GameQuestion> = {}): GameQuestion => ({
  id: 'q1', position: 0, type: 'multiple_choice', prompt: 'Which is bigger?', imagePath: null, timeLimitSeconds: 20, points: 1000, status: 'closed',
  startsAt: null, openedAt: null, deadlineAt: null, closedAt: null, boardAt: null, answerCount: 30, eligibleCount: 30,
  options: [], correctOptionId: null, explanation: null, distribution: null,
  role: 'core', corePosition: 0, level: 1, levelStart: false, objective: 'Compare fractions', topic: 'Fractions', kind: 'concept', difficulty: 'easy',
  misconception: { optionId: 'o2', position: 1, label: '1/8', count: 12, answered: 30, note: 'Thinks a bigger denominator means a bigger fraction' },
  mastery: { accuracy: 55, passed: false, hasRecovery: true, skipped: false },
  review: null,
  ...over,
});

describe('learning in the game', () => {
  it('parses the learning parts of the payload (older servers: sensible defaults)', () => {
    const raw = {
      role: 'player', server_now: 'x',
      session: { id: 's', quiz_title: 'T', pin: null, status: 'in_progress', phase: 'question', state_version: 1, question_count: 3, current_position: 1000, is_locked: false, participant_count: 3, speed_scoring: true, mastery_enabled: true, mastery_pct: 80, review_ms: 6000 },
      question: {
        id: 'q', position: 1000, type: 'multiple_choice', prompt: 'P', image_path: null, time_limit_seconds: 15, points: 1000, status: 'open', starts_at: null, opened_at: null, deadline_at: null,
        answer_count: 0, options: [], correct_option_id: null, explanation: null, distribution: null,
        role: 'recovery', core_position: 2, level: 3, level_start: false, objective: 'O', topic: null, kind: 'bug', difficulty: 'hard', misconception: null, mastery: null,
        review: { core_prompt: 'Core', accuracy: '40.00', misconception: { option_id: 'o', position: 2, label: 'C', count: 3, answered: 5, note: null }, explanation: 'E', correct_label: 'A' },
      },
      learning: { weak_objectives: ['O'], report: null },
      me: null, leaderboard: [], ranked_count: 0, leaderboard_version: null,
    } as unknown as RawState;
    const s = toGameState(raw);
    expect(s.session).toMatchObject({ masteryEnabled: true, masteryPct: 80, reviewMs: 6000 });
    expect(s.question).toMatchObject({ role: 'recovery', corePosition: 2, level: 3, review: { corePrompt: 'Core', accuracy: 40, misconception: { label: 'C', count: 3 } } });
    expect(s.learning).toEqual({ weakObjectives: ['O'], report: null });
    const old = toGameState({ ...raw, session: { ...raw.session, mastery_enabled: undefined }, question: { ...raw.question!, role: undefined }, learning: undefined } as unknown as RawState);
    expect(old.session.masteryEnabled).toBe(false);
    expect(old.question!.role).toBe('core');
    expect(old.learning).toBeNull();
  });

  it('the review before a recovery question: the common pick, the note, the right answer — no names', () => {
    render(
      <ReviewScreen
        question={question({ role: 'recovery', review: { corePrompt: 'Which is bigger?', accuracy: 40, misconception: question().misconception, explanation: 'Fewer, bigger pieces.', correctLabel: '1/2' } })}
        remainingMs={6400}
      />,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('40% got it right last time.');
    expect(screen.getByText(/most common pick was/)).toHaveTextContent('B: 1/8 (12 of 30)');
    expect(screen.getByText('Thinks a bigger denominator means a bigger fraction')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('the common mix-up is only shown when it says something', () => {
    const { rerender, container } = render(<MisconceptionNote misconception={question().misconception} />);
    expect(container).toHaveTextContent('Common mix-up: B (12 of 30) · Thinks a bigger denominator');
    rerender(<MisconceptionNote misconception={{ ...question().misconception!, count: 1, note: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('the mastery check explains what comes next; the teacher can skip the recovery question', () => {
    const onChanged = vi.fn();
    const client = {} as AppSupabaseClient;
    const { rerender } = render(<MasteryBanner question={question()} masteryPct={75} host={{ client, sessionId: 's', onChanged }} />, { wrapper: ToastProvider });
    expect(screen.getByRole('status')).toHaveTextContent('Mastery check: 55% (75% needed). A recovery question on the same idea comes next.');
    fireEvent.click(screen.getByRole('button', { name: 'Skip the recovery question' }));
    expect(setRecoverySkipped).toHaveBeenCalledWith(client, 's', true);
    rerender(<MasteryBanner question={question({ mastery: { accuracy: 55, passed: false, hasRecovery: false, skipped: false } })} masteryPct={75} />);
    expect(screen.getByRole('status')).toHaveTextContent('No recovery question was written for this one.');
    rerender(<MasteryBanner question={question({ mastery: { accuracy: 90, passed: true, hasRecovery: true, skipped: false } })} masteryPct={75} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('the final challenge names the weak objectives; the report lists accuracy per objective', () => {
    render(<LevelAnnounce level={4} weakObjectives={['Compare fractions', 'Add fractions']} remainingMs={2500} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Everything together');
    expect(screen.getByText('Compare fractions · Add fractions')).toBeInTheDocument();
    render(
      <LearningReport
        learning={{ weakObjectives: [], report: [{ objective: 'Compare fractions', topic: 'Fractions', questions: 2, accuracy: 42.5, recoveryAccuracy: 80 }] }}
      />,
    );
    const row = screen.getByRole('row', { name: /Compare fractions/ });
    expect(row).toHaveTextContent('43%');
    expect(row).toHaveTextContent('80%');
  });
});
