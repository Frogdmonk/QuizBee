import type { Dispatch } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowDown, ArrowUp, Check, Copy, MoreHorizontal, Plus, Timer, Trash2, Trophy, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { spring } from '@/lib/motion';
import { Menu } from '@/components/ui/Menu';
import { SegmentedControl, SelectField, TextAreaField } from '@/components/ui/FormControls';
import { cn } from '@/lib/cn';
import { LIMITS, POINTS_CHOICES, QUESTION_TYPE_LABELS, TIME_LIMIT_CHOICES } from '@/lib/quiz-rules';
import type { EditorAction } from '@/lib/quiz-editor-reducer';
import type { QuestionDraft, QuestionType } from '@/types/quiz';
import { ImagePicker } from './ImagePicker';
import { answerStyle } from './answer-styles';
import { QUESTION_TYPE_ICONS } from './question-type-icons';
import { LearningEditor } from './LearningEditor';
import { CodeAnswerToggle, QuestionCodeField } from '@/components/code/QuestionCodeField';

type Props = {
  question: QuestionDraft;
  index: number;
  total: number;
  issues: string[];
  dispatch: Dispatch<EditorAction>;
  onDuplicate: () => void;
  onDelete: () => void;
};

const SHORT_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Choice',
  true_false: 'True/False',
  image_choice: 'Pictures',
};

const TYPE_OPTIONS = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((value) => {
  const Icon = QUESTION_TYPE_ICONS[value];
  return { value, label: QUESTION_TYPE_LABELS[value], shortLabel: SHORT_TYPE_LABELS[value], icon: <Icon /> };
});

export function QuestionEditor({ question, index, total, issues, dispatch, onDuplicate, onDelete }: Props) {
  const q = question;
  const pictureAnswers = q.type === 'image_choice';
  const trueFalse = q.type === 'true_false';
  const canAddOption = !trueFalse && q.options.length < LIMITS.maxOptions;
  const canRemoveOption = !trueFalse && q.options.length > LIMITS.minOptions;
  const pointsKnown = POINTS_CHOICES.some((p) => p.value === q.points);
  const timeKnown = (TIME_LIMIT_CHOICES as readonly number[]).includes(q.timeLimitSeconds);

  const moveButton =
    'grid size-10 place-items-center rounded-sm text-ink-500 hover:bg-paper-sunk hover:text-ink-900 disabled:text-line-strong disabled:hover:bg-transparent pointer-coarse:size-11';

  return (
    <div className="rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line py-2 pr-2 pl-5 sm:pl-6">
        <h2 className="flex items-baseline gap-2">
          <span className="type-kicker">Question</span>
          <span className="type-score text-score-md text-ink-900">{index + 1}</span>
          <span className="text-caption text-ink-500">of {total}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => dispatch({ type: 'moveQuestion', key: q.key, delta: -1 })}
            disabled={index === 0}
            className={moveButton}
            aria-label="Move question up"
            title="Move up"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'moveQuestion', key: q.key, delta: 1 })}
            disabled={index === total - 1}
            className={moveButton}
            aria-label="Move question down"
            title="Move down"
          >
            <ArrowDown className="size-4" />
          </button>
          <Menu
            label="Question actions"
            trigger={<MoreHorizontal className="size-5" />}
            items={[
              { label: 'Duplicate question', icon: <Copy />, onSelect: onDuplicate, disabled: total >= LIMITS.maxQuestions },
              { label: 'Delete question', icon: <Trash2 />, onSelect: onDelete, tone: 'danger' },
            ]}
          />
        </div>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-6">
        <SegmentedControl
          label="Question type"
          layoutId="question-type"
          value={q.type}
          options={TYPE_OPTIONS}
          onChange={(type) => dispatch({ type: 'changeType', key: q.key, questionType: type })}
        />

        <TextAreaField
          label="Question"
          className="[&_textarea]:text-[1.125rem]"
          placeholder={trueFalse ? 'e.g. Water boils at 100 °C at sea level.' : 'e.g. Which planet is closest to the Sun?'}
          value={q.prompt}
          maxChars={LIMITS.promptMax}
          rows={3}
          onChange={(e) => dispatch({ type: 'updateQuestion', key: q.key, patch: { prompt: e.target.value } })}
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-label text-ink-900">Question image</p>
            <span className="text-caption text-ink-500">Optional</span>
          </div>
          <ImagePicker
            label="Add question image"
            value={q.imagePath}
            onChange={(path) => dispatch({ type: 'updateQuestion', key: q.key, patch: { imagePath: path } })}
          />
        </div>

        <QuestionCodeField question={q} dispatch={dispatch} />

        <fieldset className="space-y-3">
          <legend className="text-label text-ink-900">
            Answers <span className="font-normal text-ink-500">· tick the correct one</span>
          </legend>
          <div role="radiogroup" aria-label="Correct answer" className={cn('grid grid-cols-[minmax(0,1fr)] gap-2', pictureAnswers && 'grid-cols-2')}>
            <AnimatePresence initial={false}>
              {q.options.map((option, i) => {
                const style = answerStyle(i);
                return (
                  <m.div
                    key={option.key}
                    layout="position"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
                    className={cn(
                      'relative min-w-0 overflow-hidden rounded-sm border py-2 pr-2 pl-5 transition-colors duration-[var(--dur-fast)]',
                      option.isCorrect ? 'border-success-600 bg-success-50' : ['border-line', style.softBg],
                      pictureAnswers ? 'space-y-2' : 'flex items-center gap-2',
                    )}
                  >
                    <span aria-hidden className={cn('absolute inset-y-0 left-0 w-3', style.kit)} />
                    <div className={cn('flex items-center gap-2', pictureAnswers && 'justify-between')}>
                      <span className={cn('type-stage grid size-10 shrink-0 place-items-center rounded-[4px] text-[1.25rem]', style.bg, style.fg)}>
                        {style.letter}
                      </span>
                      {option.isCorrect && (
                        <Badge tone="success" className={pictureAnswers ? '' : 'hidden sm:inline-flex'}>
                          Correct
                        </Badge>
                      )}
                      {pictureAnswers && (
                        <CorrectToggle
                          checked={option.isCorrect}
                          letter={style.letter}
                          onSelect={() => dispatch({ type: 'setCorrect', questionKey: q.key, optionKey: option.key })}
                        />
                      )}
                    </div>

                    {pictureAnswers && (
                      <ImagePicker
                        variant="tile"
                        label={`Image ${style.letter}`}
                        value={option.imagePath}
                        onChange={(path) =>
                          dispatch({ type: 'updateOption', questionKey: q.key, optionKey: option.key, patch: { imagePath: path } })
                        }
                      />
                    )}

                    <input
                      type="text"
                      value={option.label}
                      readOnly={trueFalse}
                      maxLength={LIMITS.optionLabelMax + 20}
                      aria-label={`Answer ${style.letter}${pictureAnswers ? ' caption (optional)' : ''}`}
                      placeholder={pictureAnswers ? 'Caption (optional)' : `Answer ${style.letter}`}
                      onChange={(e) =>
                        dispatch({ type: 'updateOption', questionKey: q.key, optionKey: option.key, patch: { label: e.target.value } })
                      }
                      className={cn(
                        'h-11 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-2 text-body font-semibold text-ink-900 outline-none',
                        option.isCode && !pictureAnswers && 'font-mono text-body-sm',
                        'placeholder:font-normal placeholder:text-ink-500 focus:border-line-strong focus:bg-surface',
                        pictureAnswers && 'w-full border-line-strong bg-surface text-body-sm',
                        trueFalse && 'cursor-default',
                        option.label.length > LIMITS.optionLabelMax && 'border-error-600 text-error-600',
                      )}
                    />

                    {!pictureAnswers && !trueFalse && (
                      <CodeAnswerToggle
                        option={option}
                        letter={style.letter}
                        onToggle={() => dispatch({ type: 'updateOption', questionKey: q.key, optionKey: option.key, patch: { isCode: !option.isCode } })}
                      />
                    )}
                    {!pictureAnswers && (
                      <CorrectToggle
                        checked={option.isCorrect}
                        letter={style.letter}
                        onSelect={() => dispatch({ type: 'setCorrect', questionKey: q.key, optionKey: option.key })}
                      />
                    )}
                    {canRemoveOption && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'removeOption', questionKey: q.key, optionKey: option.key })}
                        className={cn(
                          'grid size-10 shrink-0 place-items-center rounded-sm text-ink-500 hover:bg-surface hover:text-error-600 pointer-coarse:size-11',
                          pictureAnswers && 'w-full',
                        )}
                        aria-label={`Remove answer ${style.letter}`}
                        title="Remove answer"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </m.div>
                );
              })}
            </AnimatePresence>
          </div>
          {canAddOption && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'addOption', questionKey: q.key })}
              className="flex h-11 items-center gap-1.5 rounded-sm px-3 text-label text-ink-700 hover:bg-paper-sunk hover:text-ink-900"
            >
              <Plus className="size-4" /> Add answer
            </button>
          )}
        </fieldset>

        <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <SelectField
            label="Time limit"
            icon={<Timer />}
            value={q.timeLimitSeconds}
            onChange={(e) => dispatch({ type: 'updateQuestion', key: q.key, patch: { timeLimitSeconds: Number(e.target.value) } })}
          >
            {!timeKnown && <option value={q.timeLimitSeconds}>{q.timeLimitSeconds} seconds</option>}
            {TIME_LIMIT_CHOICES.map((s) => (
              <option key={s} value={s}>
                {s} seconds
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Points"
            icon={<Trophy />}
            value={q.points}
            onChange={(e) => dispatch({ type: 'updateQuestion', key: q.key, patch: { points: Number(e.target.value) } })}
          >
            {!pointsKnown && <option value={q.points}>{q.points} points</option>}
            {POINTS_CHOICES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SelectField>
        </div>

        <TextAreaField
          label="Explanation"
          optional
          hint="Shown to students after the answer is revealed."
          placeholder="e.g. Mercury orbits closest to the Sun at about 58 million km."
          value={q.explanation}
          maxChars={LIMITS.explanationMax}
          rows={2}
          onChange={(e) => dispatch({ type: 'updateQuestion', key: q.key, patch: { explanation: e.target.value } })}
        />

        <LearningEditor question={q} dispatch={dispatch} />

        {issues.length > 0 && (
          <Alert tone="warning" title="Before publishing">
            <ul className="list-disc space-y-0.5 pl-4">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Alert>
        )}
      </div>
    </div>
  );
}

export function CorrectToggle({ checked, letter, onSelect }: { checked: boolean; letter: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={`Mark answer ${letter} as correct`}
      title={checked ? 'Correct answer' : 'Mark as correct'}
      onClick={onSelect}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-[var(--dur-fast)]',
        checked ? 'text-white' : 'text-line-strong hover:text-success-600',
      )}
    >
      <m.span
        key={String(checked)}
        initial={checked ? { scale: 0.5 } : false}
        animate={{ scale: 1 }}
        transition={spring.pop}
        className={cn(
          'grid size-8 place-items-center rounded-full border-2',
          checked ? 'border-success-600 bg-success-600' : 'border-line-strong bg-surface',
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </m.span>
    </button>
  );
}
