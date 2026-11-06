import type { Dispatch } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowDown, ArrowUp, Check, Copy, Lightbulb, MoreHorizontal, Plus, Timer, Trash2, Trophy, X } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Menu } from '@/components/ui/Menu';
import { SegmentedControl, SelectField, TextAreaField } from '@/components/ui/FormControls';
import { cn } from '@/lib/cn';
import { LIMITS, POINTS_CHOICES, QUESTION_TYPE_LABELS, TIME_LIMIT_CHOICES } from '@/lib/quiz-rules';
import type { EditorAction } from '@/lib/quiz-editor-reducer';
import type { QuestionDraft, QuestionType } from '@/types/quiz';
import { ImagePicker } from './ImagePicker';
import { answerStyle } from './answer-styles';
import { QUESTION_TYPE_ICONS } from './question-type-icons';

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

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3 sm:px-6">
        <h2 className="text-lg font-bold">Question {index + 1}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => dispatch({ type: 'moveQuestion', key: q.key, delta: -1 })}
            disabled={index === 0}
            className="grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30"
            aria-label="Move question up"
            title="Move up"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'moveQuestion', key: q.key, delta: 1 })}
            disabled={index === total - 1}
            className="grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30"
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

      <CardBody className="space-y-6">
        <SegmentedControl
          label="Question type"
          layoutId="question-type"
          value={q.type}
          options={TYPE_OPTIONS}
          onChange={(type) => dispatch({ type: 'changeType', key: q.key, questionType: type })}
        />

        <TextAreaField
          label="Question"
          placeholder={trueFalse ? 'e.g. Water boils at 100 °C at sea level.' : 'e.g. Which planet is closest to the Sun?'}
          value={q.prompt}
          maxChars={LIMITS.promptMax}
          rows={3}
          onChange={(e) => dispatch({ type: 'updateQuestion', key: q.key, patch: { prompt: e.target.value } })}
        />

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink-800">
            Question image <span className="font-normal text-ink-400">(optional)</span>
          </p>
          <ImagePicker
            label="Add question image"
            value={q.imagePath}
            onChange={(path) => dispatch({ type: 'updateQuestion', key: q.key, patch: { imagePath: path } })}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink-800">
            Answers <span className="font-normal text-ink-500">· tap the circle to mark the correct one</span>
          </legend>
          <div role="radiogroup" aria-label="Correct answer" className={cn('grid gap-3', pictureAnswers && 'grid-cols-2')}>
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
                      'rounded-xl border-2 p-2 transition-colors',
                      option.isCorrect ? 'border-mint-500 bg-mint-50' : 'border-ink-100 bg-surface',
                      pictureAnswers ? 'space-y-2' : 'flex items-center gap-2',
                    )}
                  >
                    <div className={cn('flex items-center gap-2', pictureAnswers && 'justify-between')}>
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg font-display font-extrabold text-white', style.bg)}>
                        {style.letter}
                      </span>
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
                        'h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-[15px] font-medium outline-none',
                        'placeholder:text-ink-400 focus:border-ink-200 focus:bg-surface',
                        pictureAnswers && 'w-full border-ink-100 bg-surface text-sm',
                        trueFalse && 'cursor-default',
                        option.label.length > LIMITS.optionLabelMax && 'border-rose-400 text-rose-600',
                      )}
                    />

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
                          'grid size-9 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-rose-600',
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
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            >
              <Plus className="size-4" /> Add answer
            </button>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
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
          label="Explanation (optional)"
          hint="Shown to students after the answer is revealed."
          placeholder="e.g. Mercury orbits closest to the Sun at about 58 million km."
          value={q.explanation}
          maxChars={LIMITS.explanationMax}
          rows={2}
          onChange={(e) => dispatch({ type: 'updateQuestion', key: q.key, patch: { explanation: e.target.value } })}
        />

        {issues.length > 0 && (
          <div className="flex gap-3 rounded-xl bg-sun-300/20 p-3 text-sm text-ink-700">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-sun-500" />
            <div>
              <p className="font-semibold text-ink-900">Before publishing</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function CorrectToggle({ checked, letter, onSelect }: { checked: boolean; letter: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={`Mark answer ${letter} as correct`}
      title={checked ? 'Correct answer' : 'Mark as correct'}
      onClick={onSelect}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors',
        checked ? 'border-mint-500 bg-mint-500 text-white' : 'border-ink-200 text-transparent hover:border-mint-400 hover:text-mint-400',
      )}
    >
      <Check className="size-5" strokeWidth={3} />
    </button>
  );
}
