import { m } from 'motion/react';
import { CheckSquare, Plus, Settings2 } from 'lucide-react';
import { Menu } from '@/components/ui/Menu';
import { cn } from '@/lib/cn';
import { LIMITS, QUESTION_TYPE_LABELS } from '@/lib/quiz-rules';
import type { QuestionDraft, QuestionType } from '@/types/quiz';
import { QUESTION_TYPE_ICONS } from './question-type-icons';

export type EditorSelection = 'details' | string;

type Props = {
  questions: QuestionDraft[];
  selected: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onAdd: (type: QuestionType) => void;
  issueKeys: Set<string>;
  detailsHasIssues: boolean;
};

export function QuestionList({ questions, selected, onSelect, onAdd, issueKeys, detailsHasIssues }: Props) {
  const atLimit = questions.length >= LIMITS.maxQuestions;
  const addMenu = (
    <Menu
      label="Add question"
      align="left"
      plainTrigger
      triggerClassName="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-200 px-3 text-sm font-semibold text-ink-600 hover:border-ink-300 hover:bg-surface hover:text-ink-900"
      trigger={
        <>
          <Plus className="size-4" /> <span className="hidden lg:inline">Add question</span>
        </>
      }
      items={(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => {
        const Icon = QUESTION_TYPE_ICONS[type];
        return { label: QUESTION_TYPE_LABELS[type], icon: <Icon />, onSelect: () => onAdd(type), disabled: atLimit };
      })}
    />
  );

  return (
    <nav aria-label="Questions" className="min-w-0">
      <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        <button
          type="button"
          onClick={() => onSelect('details')}
          aria-current={selected === 'details' ? 'true' : undefined}
          className={cn(
            'relative flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors',
            selected === 'details'
              ? 'border-ink-900 bg-ink-900 text-white'
              : 'border-ink-100 bg-surface text-ink-700 hover:border-ink-200',
          )}
        >
          <Settings2 className="size-4" />
          <span>Quiz details</span>
          {detailsHasIssues && <span className="ml-auto size-2 rounded-full bg-sun-500" aria-label="Needs attention" />}
        </button>

        <ol className="contents lg:block lg:space-y-1.5">
          {questions.map((q, i) => {
            const Icon = QUESTION_TYPE_ICONS[q.type];
            const active = q.key === selected;
            const needsWork = issueKeys.has(q.key);
            return (
              <m.li key={q.key} layout="position" transition={{ type: 'spring', stiffness: 500, damping: 40 }} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(q.key)}
                  aria-current={active ? 'true' : undefined}
                  aria-label={`Question ${i + 1}${needsWork ? ', needs attention' : ''}`}
                  className={cn(
                    'relative flex h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-left text-sm transition-colors lg:h-auto lg:min-h-14 lg:py-2',
                    active ? 'border-flame-400 bg-flame-50 text-ink-900' : 'border-ink-100 bg-surface text-ink-700 hover:border-ink-200',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold tabular',
                      active ? 'bg-flame-500 text-white' : 'bg-ink-100 text-ink-600',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="hidden min-w-0 flex-1 lg:block">
                    <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                      <Icon className="size-3" /> {QUESTION_TYPE_LABELS[q.type]}
                    </span>
                    <span className={cn('block truncate', !q.prompt.trim() && 'text-ink-400 italic')}>
                      {q.prompt.trim() || 'Untitled question'}
                    </span>
                  </span>
                  {needsWork && <span className="size-2 shrink-0 rounded-full bg-sun-500" aria-hidden />}
                  {!needsWork && <CheckSquare className="hidden size-4 shrink-0 text-mint-500 lg:block" aria-hidden />}
                </button>
              </m.li>
            );
          })}
        </ol>

        <div className="shrink-0 lg:pt-1">{addMenu}</div>
      </div>
      <p className="mt-2 hidden text-xs text-ink-400 lg:block">
        {questions.length} / {LIMITS.maxQuestions} questions
      </p>
    </nav>
  );
}
