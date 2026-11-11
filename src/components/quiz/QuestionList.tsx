import { m } from 'motion/react';
import { FileJson, Plus, Settings2 } from 'lucide-react';
import { Menu } from '@/components/ui/Menu';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';
import { LIMITS, QUESTION_TYPE_LABELS } from '@/lib/quiz-rules';
import type { QuestionDraft, QuestionType } from '@/types/quiz';
import { QUESTION_TYPE_ICONS } from './question-type-icons';

export type EditorSelection = 'details' | string;

type Props = {
  questions: QuestionDraft[];
  selected: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onAdd: (type: QuestionType) => void;
  /** Opens "Import questions using ChatGPT". */
  onImport?: () => void;
  issueKeys: Set<string>;
  detailsHasIssues: boolean;
};

/** Running order of the quiz: a rail on desktop, a horizontal chip strip on phones. */
export function QuestionList({ questions, selected, onSelect, onAdd, onImport, issueKeys, detailsHasIssues }: Props) {
  const atLimit = questions.length >= LIMITS.maxQuestions;
  const addMenu = (
    <Menu
      label="Add question"
      align="left"
      plainTrigger
      triggerClassName="flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-sm border border-dashed border-line-strong px-3 text-label text-ink-700 hover:bg-surface hover:text-ink-900"
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
    <nav aria-label="Questions" className="min-w-0 lg:rounded-md lg:bg-paper-sunk lg:p-2">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onSelect('details')}
          aria-current={selected === 'details' ? 'true' : undefined}
          className={cn(
            'relative flex h-11 shrink-0 items-center gap-2 rounded-sm px-3 text-label transition-colors duration-[var(--dur-fast)]',
            selected === 'details' ? 'bg-ink-900 text-white' : 'border border-line bg-surface text-ink-700 hover:text-ink-900 lg:border-0 lg:bg-transparent lg:hover:bg-surface',
          )}
        >
          <Settings2 className="size-4" />
          <span>Quiz details</span>
          {detailsHasIssues && <span className="ml-auto size-2 rounded-full bg-answer-d" aria-label="Needs attention" />}
        </button>

        <ol className="contents lg:block lg:space-y-0.5">
          {questions.map((q, i) => {
            const Icon = QUESTION_TYPE_ICONS[q.type];
            const active = q.key === selected;
            const needsWork = issueKeys.has(q.key);
            return (
              <m.li key={q.key} layout="position" transition={spring.layout} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(q.key)}
                  aria-current={active ? 'true' : undefined}
                  aria-label={`Question ${i + 1}${needsWork ? ', needs attention' : ''}`}
                  className={cn(
                    'relative flex h-11 w-full items-center gap-2 rounded-sm px-3 text-left transition-colors duration-[var(--dur-fast)] lg:h-auto lg:min-h-14 lg:items-start lg:py-2.5',
                    active ? 'bg-surface text-ink-900' : 'border border-line bg-surface text-ink-700 hover:text-ink-900 lg:border-0 lg:bg-transparent lg:hover:bg-surface/70',
                  )}
                >
                  {active && <m.span layoutId="question-active" aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] bg-signal-600" transition={spring.layout} />}
                  <span className="type-score w-5 shrink-0 text-score-sm text-ink-500 lg:pt-px">{i + 1}</span>
                  <Icon className="size-4 shrink-0 text-ink-500 lg:mt-0.5" aria-hidden />
                  <span className={cn('hidden min-w-0 flex-1 text-body-sm lg:line-clamp-2', !q.prompt.trim() && 'text-ink-500 italic')}>
                    {q.prompt.trim() || 'Untitled question'}
                  </span>
                  {needsWork && <span className="size-2 shrink-0 rounded-full bg-answer-d lg:mt-1.5" aria-hidden />}
                </button>
              </m.li>
            );
          })}
        </ol>

        <div className="flex shrink-0 gap-2 lg:flex-col lg:pt-2">
          {addMenu}
          {onImport && (
            <button
              type="button"
              onClick={onImport}
              disabled={atLimit}
              aria-label="Import questions using ChatGPT"
              className="flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-sm border border-dashed border-line-strong px-3 text-label text-ink-700 hover:bg-surface hover:text-ink-900 disabled:pointer-events-none disabled:opacity-50"
            >
              <FileJson className="size-4" /> <span className="hidden lg:inline">Import using ChatGPT</span>
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 hidden px-1 text-caption text-ink-500 lg:block">
        <span className="type-score text-score-sm">{questions.length}</span> / {LIMITS.maxQuestions} questions
      </p>
    </nav>
  );
}
