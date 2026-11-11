import type { Dispatch } from 'react';
import { Code } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { EditorAction } from '@/lib/quiz-editor-reducer';
import type { OptionDraft, QuestionDraft } from '@/types/quiz';
import { CodeEditor } from './CodeEditor';

/** "Add code" for a question, then the code editor (language + code). Used by the quiz editor and the importer's review. */
export function QuestionCodeField({ question: q, dispatch, label = 'Code' }: { question: QuestionDraft; dispatch: Dispatch<EditorAction>; label?: string }) {
  const set = (code: QuestionDraft['code']) => dispatch({ type: 'updateQuestion', key: q.key, patch: { code } });
  if (!q.code) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => set({ language: 'python', content: '' })}
          className="inline-flex h-11 items-center gap-2 rounded-sm border border-dashed border-line-strong px-3 text-label text-ink-700 hover:bg-paper hover:text-ink-900"
        >
          <Code className="size-4" /> Add code
        </button>
        <span className="text-caption text-ink-500">For programming questions: Python, C, C++ or Java, shown with highlighting. Never run.</span>
      </div>
    );
  }
  const code = q.code;
  return (
    <CodeEditor
      label={label}
      language={code.language}
      content={code.content}
      onChange={(content) => set({ ...code, content })}
      onLanguageChange={(language) => set({ ...code, language })}
      onRemove={() => set(null)}
    />
  );
}

/** Marks an answer as a code snippet (monospaced). */
export function CodeAnswerToggle({ option, letter, onToggle }: { option: OptionDraft; letter: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={option.isCode}
      aria-label={`Answer ${letter} is code`}
      title={option.isCode ? 'Shown as code' : 'Show as code'}
      onClick={onToggle}
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-sm pointer-coarse:size-11',
        option.isCode ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-surface hover:text-ink-900',
      )}
    >
      <Code className="size-4" />
    </button>
  );
}
