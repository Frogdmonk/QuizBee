import { useState } from 'react';
import { LifeBuoy, Lightbulb, SkipForward, Undo2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { setRecoverySkipped } from '@/services/sessions';
import { friendlyError } from '@/utils/errors';
import { answerStyle } from '@/components/quiz/answer-styles';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { GameQuestion, LearningState, Misconception } from '@/types/game';

/* Learning screens: levels, the review before a recovery question, the most common mix-up, the
 * mastery check and the end-of-game report. Class-level numbers only: nobody is ever named. */

const LEVEL_TITLE: Record<number, [string, string]> = {
  1: ['Level 1', 'Foundations'],
  2: ['Level 2', 'Application'],
  3: ['Level 3', 'Deeper reasoning'],
  4: ['Final challenge', 'Everything together'],
};

/** "Level 2 · Application" before the first question of a level (in the 3 s the server holds it back). */
export function LevelAnnounce({
  level,
  weakObjectives,
  remainingMs,
  size = 'stage',
}: {
  level: number;
  weakObjectives: string[];
  remainingMs: number;
  size?: 'stage' | 'phone';
}) {
  const [kicker, title] = LEVEL_TITLE[level] ?? ['Next level', ''];
  const stage = size === 'stage';
  const final = level === 4;
  return (
    <div className={cn('bx-announce flex flex-1 flex-col justify-center', stage ? 'items-start gap-[2vh]' : 'items-center gap-3 text-center')} role="status">
      <p className={cn('type-kicker', final ? 'text-rank-gold' : 'text-night-muted', stage && 'text-stage-label')}>{kicker}</p>
      <h2 className={cn('type-display', stage ? 'text-[clamp(3rem,10vh,7rem)]' : 'text-[2.5rem]', 'leading-[1.02]')}>{title}</h2>
      {final && weakObjectives.length > 0 && (
        <p className={cn('max-w-4xl', stage ? 'text-[clamp(1.1rem,3vh,2rem)]' : 'text-body')}>
          The monster aims at what the class found hard: <span className="font-bold">{weakObjectives.join(' · ')}</span>
        </p>
      )}
      {final && weakObjectives.length === 0 && (
        <p className={cn('text-night-muted', stage ? 'text-stage-name' : 'text-body')}>Mixed questions from every level.</p>
      )}
      <p className={cn('type-score', stage ? 'text-[clamp(2rem,6vh,4rem)]' : 'text-[2rem]')} aria-label="Question starts in">
        {Math.max(1, Math.ceil(remainingMs / 1000))}
      </p>
    </div>
  );
}

/**
 * Before a recovery question: what the class found tricky (the most-picked wrong answer and its
 * note), the right answer and why, and that a new question on the same idea is coming.
 */
export function ReviewScreen({ question, remainingMs, size = 'stage' }: { question: GameQuestion; remainingMs: number; size?: 'stage' | 'phone' }) {
  const review = question.review;
  if (!review) return null;
  const stage = size === 'stage';
  const m = review.misconception;
  return (
    <div className={cn('bx-announce flex flex-1 flex-col justify-center', stage ? 'gap-[2.2vh]' : 'gap-3')} role="status">
      <p className={cn('type-kicker inline-flex items-center gap-2 text-sun-400', stage && 'text-stage-label')}>
        <LifeBuoy className="size-[1.1em]" aria-hidden /> Let’s fix this together
      </p>
      <h2 className={cn('type-display', stage ? 'text-[clamp(2rem,6vh,4.25rem)]' : 'text-[1.75rem]', 'leading-[1.05]')}>
        {review.accuracy !== null ? `${Math.round(review.accuracy)}% got it right last time.` : 'That one was tricky.'}
      </h2>
      <p className={cn('text-night-muted', stage ? 'text-stage-name' : 'text-body-sm')}>“{review.corePrompt}”</p>
      {m && (
        <div className={cn('rounded-md bg-night-900', stage ? 'p-[2vh]' : 'p-3')}>
          <p className={stage ? 'text-[clamp(1rem,2.6vh,1.75rem)]' : 'text-body'}>
            The most common pick was <span className="font-bold">{answerStyle(m.position).letter}: {m.label}</span> ({m.count} of {m.answered}).
          </p>
          {m.note && (
            <p className={cn('mt-1 inline-flex gap-2 font-semibold text-sun-400', stage ? 'text-[clamp(1rem,2.6vh,1.75rem)]' : 'text-body')}>
              <Lightbulb className="mt-[0.2em] size-[1em] shrink-0" aria-hidden /> {m.note}
            </p>
          )}
        </div>
      )}
      <p className={stage ? 'text-[clamp(1rem,2.6vh,1.75rem)]' : 'text-body'}>
        Right answer: <span className="font-bold text-success-400">{review.correctLabel}</span>
        {review.explanation && <span className="text-night-muted"> · {review.explanation}</span>}
      </p>
      <p className={cn('font-bold', stage ? 'text-[clamp(1.1rem,3vh,2rem)]' : 'text-body')}>
        Now a new question on the same idea. <span className="type-score">{Math.max(1, Math.ceil(remainingMs / 1000))}</span>
      </p>
    </div>
  );
}

/** The most common wrong answer after a question, with its note. Hidden when it is not meaningful. */
export function MisconceptionNote({ misconception, size = 'stage', className }: { misconception: Misconception | null; size?: 'stage' | 'phone'; className?: string }) {
  if (!misconception || (!misconception.note && misconception.count < 2)) return null;
  const stage = size === 'stage';
  return (
    <p className={cn('inline-flex items-start gap-2', stage ? 'text-stage-name' : 'text-body-sm', className)}>
      <Lightbulb className="mt-[0.2em] size-[1em] shrink-0 text-sun-400" aria-hidden />
      <span>
        <span className="font-bold">Common mix-up:</span> {answerStyle(misconception.position).letter} ({misconception.count} of {misconception.answered})
        {misconception.note ? ` · ${misconception.note}` : ''}
      </span>
    </p>
  );
}

/** After a core question: the mastery check, and (for the teacher) skipping the recovery question. */
export function MasteryBanner({
  question,
  masteryPct,
  host,
  size = 'stage',
}: {
  question: GameQuestion;
  masteryPct: number;
  host?: { client: AppSupabaseClient; sessionId: string; onChanged: () => void } | null;
  size?: 'stage' | 'panel';
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const m = question.mastery;
  if (!m || m.passed || m.accuracy === null) return null;
  const pct = Math.round(m.accuracy);
  const text = !m.hasRecovery
    ? `Mastery check: ${pct}% (${masteryPct}% needed). No recovery question was written for this one.`
    : m.skipped
      ? `Mastery check: ${pct}% (${masteryPct}% needed). Recovery question skipped by the teacher.`
      : `Mastery check: ${pct}% (${masteryPct}% needed). A recovery question on the same idea comes next.`;
  const toggle = async () => {
    if (!host) return;
    setBusy(true);
    try {
      await setRecoverySkipped(host.client, host.sessionId, !m.skipped);
      host.onChanged();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not change it', description: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-md border border-sun-400/60 bg-night-900 text-night-text', size === 'stage' ? 'px-[1.5vw] py-[1.2vh]' : 'px-3 py-2')} role="status">
      <LifeBuoy className="size-5 shrink-0 text-sun-400" aria-hidden />
      <p className={cn('min-w-0 flex-1', size === 'stage' ? 'text-stage-name' : 'text-body-sm')}>{text}</p>
      {host && m.hasRecovery && (
        <Button size="sm" variant="night-ghost" loading={busy} onClick={() => void toggle()} leftIcon={m.skipped ? <Undo2 className="size-4" /> : <SkipForward className="size-4" />}>
          {m.skipped ? 'Play the recovery question' : 'Skip the recovery question'}
        </Button>
      )}
    </div>
  );
}

/** End of the game: class accuracy per objective, weakest first. */
export function LearningReport({ learning, tone = 'paper', className }: { learning: LearningState | null; tone?: 'paper' | 'night'; className?: string }) {
  const rows = learning?.report;
  if (!rows || rows.length === 0 || (rows.length === 1 && rows[0].objective === 'Other questions')) return null;
  const night = tone === 'night';
  return (
    <section className={cn('space-y-2', className)} aria-label="Learning report">
      <p className="type-kicker">What the class learned</p>
      <table className="w-full text-left text-body-sm">
        <thead className={night ? 'text-night-muted' : 'text-ink-500'}>
          <tr>
            <th className="py-1 font-semibold">Objective</th>
            <th className="py-1 text-right font-semibold">Questions</th>
            <th className="py-1 text-right font-semibold">Class correct</th>
            <th className="py-1 text-right font-semibold">After review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.objective} className={cn('border-t', night ? 'border-night-rule' : 'border-line')}>
              <td className="py-1.5 pr-3">
                {r.objective}
                {r.topic && <span className={night ? 'text-night-muted' : 'text-ink-500'}> · {r.topic}</span>}
              </td>
              <td className="py-1.5 text-right tabular-nums">{r.questions}</td>
              <td className="py-1.5 text-right tabular-nums">{r.accuracy === null ? '–' : `${Math.round(r.accuracy)}%`}</td>
              <td className="py-1.5 text-right tabular-nums">{r.recoveryAccuracy === null ? '–' : `${Math.round(r.recoveryAccuracy)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
