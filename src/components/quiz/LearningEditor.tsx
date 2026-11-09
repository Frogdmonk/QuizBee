import type { Dispatch } from 'react';
import { GraduationCap, LifeBuoy, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField } from '@/components/ui/FormControls';
import { TextField } from '@/components/ui/TextField';
import { cn } from '@/lib/cn';
import { LIMITS, OPTION_LETTERS, TIME_LIMIT_CHOICES, newKey } from '@/lib/quiz-rules';
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  KINDS,
  KIND_LABEL,
  LEARNING_LIMITS,
  LEVELS,
  LEVEL_LABEL,
  LEVEL_SHORT,
  SUGGESTED_SECONDS,
  newRecovery,
} from '@/lib/learning';
import type { EditorAction } from '@/lib/quiz-editor-reducer';
import type { QuestionDraft, QuestionDifficulty, QuestionKind, QuestionLevel, RecoveryDraft } from '@/types/quiz';
import { answerStyle } from './answer-styles';

/**
 * The learning side of a question: level, objective, topic, kind (with a suggested timer),
 * difficulty, a note on why students pick each wrong answer, and an optional recovery question
 * for the same objective. All optional; a quiz without any of it plays exactly as before.
 */
export function LearningEditor({ question, dispatch }: { question: QuestionDraft; dispatch: Dispatch<EditorAction> }) {
  const q = question;
  const patch = (p: Parameters<typeof updateQuestion>[2]) => updateQuestion(dispatch, q.key, p);
  const suggested = q.kind ? SUGGESTED_SECONDS[q.kind] : null;
  const filled = q.level !== null || q.objective !== '' || q.kind !== null || q.recovery !== null || q.options.some((o) => o.misconception);
  const wrong = q.options
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => !o.isCorrect && (o.label.trim() !== '' || o.imagePath));

  return (
    <details className="group rounded-sm border border-line" open={filled || undefined}>
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-body-sm font-semibold text-ink-800">
        <GraduationCap className="size-4 text-ink-500" aria-hidden />
        Learning <span className="font-normal text-ink-500">(optional) · level, objective, misconceptions, recovery question</span>
      </summary>
      <div className="space-y-4 border-t border-line p-4">
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Level"
            value={q.level ?? ''}
            onChange={(e) => patch({ level: e.target.value === '' ? null : (Number(e.target.value) as QuestionLevel) })}
          >
            <option value="">No level</option>
            {LEVELS.map((l) => (
              <option key={l} value={l} title={LEVEL_LABEL[l]}>
                {LEVEL_SHORT[l]}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Difficulty"
            value={q.difficulty ?? ''}
            onChange={(e) => patch({ difficulty: e.target.value === '' ? null : (e.target.value as QuestionDifficulty) })}
          >
            <option value="">Not set</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </SelectField>
          <SelectField
            className="col-span-2"
            label="Kind of question"
            value={q.kind ?? ''}
            onChange={(e) => patch({ kind: e.target.value === '' ? null : (e.target.value as QuestionKind) })}
          >
            <option value="">Not set</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]} (~{SUGGESTED_SECONDS[k]} s)
              </option>
            ))}
          </SelectField>
        </div>
        {suggested !== null && suggested !== q.timeLimitSeconds && (
          <p className="flex flex-wrap items-center gap-2 text-caption text-ink-500">
            Suggested time for {KIND_LABEL[q.kind!].toLowerCase()}: {suggested} seconds (yours: {q.timeLimitSeconds}).
            <Button size="sm" variant="secondary" onClick={() => patch({ timeLimitSeconds: suggested })}>
              Use {suggested} s
            </Button>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <TextField
            label="Learning objective"
            placeholder="e.g. Compare fractions with different denominators"
            value={q.objective}
            maxLength={LEARNING_LIMITS.objectiveMax}
            hint="Questions with the same objective are grouped in the end-of-game report; a recovery question tests the same one."
            onChange={(e) => patch({ objective: e.target.value })}
          />
          <TextField label="Topic" placeholder="e.g. Fractions" value={q.topic} maxLength={LEARNING_LIMITS.topicMax} onChange={(e) => patch({ topic: e.target.value })} />
        </div>

        {wrong.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-body-sm font-semibold text-ink-800">Why might someone pick a wrong answer?</legend>
            <p className="text-caption text-ink-500">
              When most of the class picks the same wrong answer, its note is shown to everyone (never who picked it).
            </p>
            {wrong.map(({ o, i }) => (
              <TextField
                key={o.key}
                label={`Answer ${OPTION_LETTERS[i]}${o.label.trim() ? `: ${o.label.trim()}` : ''}`}
                placeholder="e.g. Thinks a bigger denominator means a bigger fraction"
                value={o.misconception}
                maxLength={LEARNING_LIMITS.misconceptionMax}
                onChange={(e) => dispatch({ type: 'updateOption', questionKey: q.key, optionKey: o.key, patch: { misconception: e.target.value } })}
              />
            ))}
          </fieldset>
        )}

        {q.recovery ? (
          <RecoveryEditor recovery={q.recovery} onChange={(recovery) => patch({ recovery })} onRemove={() => patch({ recovery: null })} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="secondary" leftIcon={<LifeBuoy className="size-4" />} onClick={() => patch({ recovery: newRecovery(q.timeLimitSeconds) })}>
              Add a recovery question
            </Button>
            <span className="text-caption text-ink-500">A different question for the same objective, played if the class misses the mastery bar.</span>
          </div>
        )}
      </div>
    </details>
  );
}

function updateQuestion(dispatch: Dispatch<EditorAction>, key: string, patch: Extract<EditorAction, { type: 'updateQuestion' }>['patch']) {
  dispatch({ type: 'updateQuestion', key, patch });
}

function RecoveryEditor({ recovery, onChange, onRemove }: { recovery: RecoveryDraft; onChange: (r: RecoveryDraft) => void; onRemove: () => void }) {
  const r = recovery;
  const setOption = (key: string, p: Partial<RecoveryDraft['options'][number]>) => onChange({ ...r, options: r.options.map((o) => (o.key === key ? { ...o, ...p } : o)) });
  const timeKnown = (TIME_LIMIT_CHOICES as readonly number[]).includes(r.timeLimitSeconds);
  return (
    <fieldset className="space-y-3 rounded-sm border border-line bg-paper-sunk/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <legend className="flex items-center gap-2 text-body-sm font-semibold text-ink-800">
          <LifeBuoy className="size-4 text-ink-500" aria-hidden /> Recovery question
        </legend>
        <Button size="sm" variant="ghost" leftIcon={<Trash2 className="size-4" />} onClick={onRemove}>
          Remove
        </Button>
      </div>
      <TextAreaField
        label="Question"
        placeholder="Same idea, new wording or numbers"
        value={r.prompt}
        maxChars={LIMITS.promptMax}
        rows={2}
        onChange={(e) => onChange({ ...r, prompt: e.target.value })}
      />
      <div className="space-y-2" role="radiogroup" aria-label="Recovery answers">
        {r.options.map((o, i) => {
          const style = answerStyle(i);
          return (
            <div key={o.key} className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
              <button
                type="button"
                role="radio"
                aria-checked={o.isCorrect}
                aria-label={`Mark recovery answer ${style.letter} as correct`}
                onClick={() => onChange({ ...r, options: r.options.map((x) => ({ ...x, isCorrect: x.key === o.key })) })}
                className={cn(
                  'grid size-11 place-items-center rounded-sm text-label font-bold',
                  o.isCorrect ? 'bg-success-600 text-white' : cn(style.softBg, 'text-ink-700'),
                )}
              >
                {style.letter}
              </button>
              <TextField label={`Answer ${style.letter}`} value={o.label} maxLength={LIMITS.optionLabelMax} onChange={(e) => setOption(o.key, { label: e.target.value })} />
              {o.isCorrect ? (
                <p className="self-center text-caption font-semibold text-success-600">Correct answer</p>
              ) : (
                <TextField label="Why pick it? (optional)" value={o.misconception} maxLength={LEARNING_LIMITS.misconceptionMax} onChange={(e) => setOption(o.key, { misconception: e.target.value })} />
              )}
              <button
                type="button"
                disabled={r.options.length <= 2}
                onClick={() => onChange({ ...r, options: r.options.filter((x) => x.key !== o.key) })}
                className="grid size-11 place-items-center rounded-sm text-ink-500 hover:bg-paper-sunk hover:text-ink-900 disabled:opacity-30"
                aria-label={`Remove recovery answer ${style.letter}`}
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
        {r.options.length < 4 && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Plus className="size-4" />}
            onClick={() => onChange({ ...r, options: [...r.options, { key: newKey(), label: '', isCorrect: false, misconception: '' }] })}
          >
            Add answer
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <SelectField label="Time limit" value={r.timeLimitSeconds} onChange={(e) => onChange({ ...r, timeLimitSeconds: Number(e.target.value) })}>
          {!timeKnown && <option value={r.timeLimitSeconds}>{r.timeLimitSeconds} seconds</option>}
          {TIME_LIMIT_CHOICES.map((s) => (
            <option key={s} value={s}>
              {s} seconds
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Explanation"
          optional
          value={r.explanation}
          maxChars={LIMITS.explanationMax}
          rows={2}
          onChange={(e) => onChange({ ...r, explanation: e.target.value })}
        />
      </div>
    </fieldset>
  );
}
