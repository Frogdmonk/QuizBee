import { useId, useMemo, useRef } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CODE_LIMITS, LANGUAGES, languageLabel, tokenize } from '@/lib/code';
import { CodeTokens } from './CodeBlock';
import '@/styles/code.css';

const INDENT = '    ';

/**
 * Editing a question's code: the teacher types in a textarea whose text is transparent, laid
 * exactly over the highlighted code. Tab indents (Shift+Tab outdents); press Esc, then Tab, to
 * move on. Nothing is run or checked: this only edits text.
 */
export function CodeEditor({
  language,
  content,
  onChange,
  onLanguageChange,
  onRemove,
  label = 'Code',
  error,
}: {
  language: string;
  content: string;
  onChange: (content: string) => void;
  onLanguageChange: (language: string) => void;
  onRemove?: () => void;
  label?: string;
  error?: string;
}) {
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const escaped = useRef(false);
  const tokens = useMemo(() => tokenize(content, language), [content, language]);
  const over = content.length > CODE_LIMITS.contentMax;
  const known = LANGUAGES.some((l) => l.id === language);

  /** Replaces the selection, keeping the browser's undo history where it can. */
  const replace = (start: number, end: number, text: string, select?: [number, number]) => {
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
    if (!ok) {
      onChange(el.value.slice(0, start) + text + el.value.slice(end));
      requestAnimationFrame(() => el.setSelectionRange(start + text.length, start + text.length));
    }
    if (select) requestAnimationFrame(() => el.setSelectionRange(...select));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      // The first Esc only lets the next Tab leave the editor; it must not close a dialog around it.
      if (!escaped.current) {
        escaped.current = true;
        e.stopPropagation();
      }
      return;
    }
    if (e.key !== 'Tab' || escaped.current || e.ctrlKey || e.metaKey || e.altKey) {
      escaped.current = false;
      return;
    }
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: t, value } = el;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    if (!e.shiftKey && s === t) return replace(s, t, INDENT);
    // Several lines (or Shift+Tab): indent or outdent each selected line.
    const block = value.slice(lineStart, t);
    const lines = block.split('\n');
    const changed = e.shiftKey ? lines.map((l) => l.replace(/^ {1,4}|^\t/, '')) : lines.map((l) => INDENT + l);
    const text = changed.join('\n');
    const firstShift = changed[0].length - lines[0].length;
    replace(lineStart, t, text, [Math.max(lineStart, s + firstShift), lineStart + text.length]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label text-ink-900">
          {label}
        </label>
        <span className={cn('text-caption tabular', over ? 'font-semibold text-error-600' : 'text-ink-500')} aria-live="polite">
          {content.length}/{CODE_LIMITS.contentMax}
        </span>
      </div>
      <div className={cn('code-block code-paper overflow-hidden rounded-sm border', (over || error) && 'border-error-600')}>
        <div className="code-head flex items-center gap-2 border-b px-2 py-1">
          <span className="relative">
            <select
              aria-label={`${label} language`}
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="h-8 appearance-none rounded-xs bg-transparent pr-7 pl-2 font-mono text-caption font-bold tracking-[0.04em] text-ink-900 uppercase hover:bg-surface"
            >
              {!known && <option value={language}>{languageLabel(language)}</option>}
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-ink-500" />
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-xs px-2 text-caption font-semibold whitespace-nowrap text-ink-700 hover:bg-surface hover:text-error-600"
            >
              <Trash2 className="size-3.5" /> Remove code
            </button>
          )}
        </div>
        <div className="max-h-80 min-h-28 overflow-auto overscroll-contain">
          <div className="code-editor w-max min-w-full">
            <pre aria-hidden className="code-editor-layer">
              <CodeTokens tokens={tokens} />
              {/* Keeps a final empty line visible (and the box tall enough) after a trailing newline. */}
              {content.endsWith('\n') || content === '' ? ' ' : null}
            </pre>
            <textarea
              ref={area}
              id={id}
              value={content}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              wrap="off"
              aria-invalid={over || error ? true : undefined}
              placeholder="Paste or type the code"
            />
          </div>
        </div>
      </div>
      <p className="text-caption text-ink-500">Tab indents; press Esc, then Tab, to move on. Code is only shown to students, never run.</p>
      {(error || over) && <p className="text-body-sm font-semibold text-error-600">{error ?? `The code can be at most ${CODE_LIMITS.contentMax} characters.`}</p>}
    </div>
  );
}
