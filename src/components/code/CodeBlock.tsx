import { memo, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { displayCode, languageLabel, lineCount, stageFontSize, tokenize, type CodeBlock as Code, type CodeToken } from '@/lib/code';
import { copyText } from '@/utils/clipboard';
import '@/styles/code.css';

export type CodeBlockSize = 'phone' | 'stage' | 'panel' | 'editor';

/**
 * A question's code, highlighted, with the language at the top and line numbers. Long lines
 * scroll sideways instead of wrapping or shrinking, so indentation always stays readable.
 *
 * `stage` (projector) picks its font size from the number of lines so that up to ~25 lines fit
 * beside the answers; `phone` keeps a fixed 14 px and scrolls.
 */
export const CodeBlock = memo(function CodeBlock({
  code,
  size = 'phone',
  tone = 'night',
  copyable = false,
  className,
}: {
  code: Code;
  size?: CodeBlockSize;
  tone?: 'night' | 'paper';
  /** Show a copy button (teacher screens). */
  copyable?: boolean;
  className?: string;
}) {
  const content = displayCode(code.content);
  const tokens = useMemo(() => tokenize(content, code.language), [content, code.language]);
  const lines = lineCount(content);
  const label = languageLabel(code.language);
  const stage = size === 'stage';

  return (
    <figure
      className={cn('code-block flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border', tone === 'paper' ? 'code-paper' : 'code-night', className)}
      aria-label={`${label} code, ${lines} ${lines === 1 ? 'line' : 'lines'}`}
    >
      <figcaption className={cn('code-head flex shrink-0 items-center justify-between gap-3 border-b px-3', stage ? 'py-[0.6vh]' : 'py-1.5')}>
        <span className={cn('font-mono font-bold tracking-[0.04em] uppercase', stage ? 'text-[clamp(0.875rem,1.9vh,1.25rem)]' : 'text-caption')}>{label}</span>
        {copyable && <CopyCode content={content} />}
      </figcaption>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain" tabIndex={0} role="region" aria-label={`${label} code`}>
        <pre
          className={cn('code-pre m-0 grid w-max min-w-full grid-cols-[auto_1fr] font-mono leading-[1.55]', !stage && SIZE_TEXT[size])}
          style={stage ? { fontSize: stageFontSize(lines) } : undefined}
        >
          <span aria-hidden className="code-gutter py-2 pr-3 pl-3 text-right select-none">
            {Array.from({ length: lines }, (_, i) => (
              <span key={i} className="block">
                {i + 1}
              </span>
            ))}
          </span>
          <code className="block py-2 pr-4 pl-1 whitespace-pre">
            <CodeTokens tokens={tokens} />
          </code>
        </pre>
      </div>
    </figure>
  );
});

const SIZE_TEXT: Record<Exclude<CodeBlockSize, 'stage'>, string> = {
  phone: 'text-[0.875rem]',
  panel: 'text-[0.875rem]',
  editor: 'text-[0.875rem]',
};

/** Highlighted code as React text (never HTML). */
export function CodeTokens({ tokens }: { tokens: CodeToken[] }) {
  return (
    <>
      {tokens.map((t, i) =>
        'children' in t ? (
          <span key={i} className={tokenClass(t.kind)}>
            <CodeTokens tokens={t.children} />
          </span>
        ) : t.kind ? (
          <span key={i} className={tokenClass(t.kind)}>
            {t.text}
          </span>
        ) : (
          t.text
        ),
      )}
    </>
  );
}

function tokenClass(kind: string): string {
  return kind
    .split(' ')
    .filter(Boolean)
    .map((k) => `tok-${k}`)
    .join(' ');
}

function CopyCode({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void copyText(content).then((ok) => {
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        })
      }
      className="code-copy -mr-1.5 inline-flex h-8 items-center gap-1.5 rounded-xs px-2 text-caption font-semibold"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
