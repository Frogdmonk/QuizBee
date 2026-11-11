import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';

/*
 * Code blocks in questions: which languages Rally knows, and syntax highlighting.
 *
 * Code is only displayed (and edited by the teacher). Rally never compiles, runs or evaluates it.
 * Highlighting uses Prism's tokenizer, which returns plain data; components render the tokens as
 * React text, so imported code is never interpreted as HTML.
 *
 * To support another language: import its Prism component above and add a line to LANGUAGES.
 */

export type CodeBlock = { language: string; content: string };

export const CODE_LIMITS = {
  /** Same limit as the database (quiz_questions.code_content). */
  contentMax: 2000,
  /** Answers can be short code snippets; they share the answer limit (120). */
} as const;

type LanguageInfo = { id: string; label: string; grammar: string | null };

/** Languages offered in the editor and accepted by the importer, in menu order. */
export const LANGUAGES: readonly LanguageInfo[] = [
  { id: 'python', label: 'Python', grammar: 'python' },
  { id: 'c', label: 'C', grammar: 'c' },
  { id: 'cpp', label: 'C++', grammar: 'cpp' },
  { id: 'java', label: 'Java', grammar: 'java' },
  { id: 'text', label: 'Plain text', grammar: null },
];

const BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));
const ALIASES: Record<string, string> = { py: 'python', python3: 'python', 'c++': 'cpp', cplusplus: 'cpp', plaintext: 'text', plain: 'text', pseudocode: 'text' };

/** The language id for what someone typed ("Python", "C++", "py"), or null if Rally does not know it. */
export function normaliseLanguage(raw: string): string | null {
  const id = raw.trim().toLowerCase();
  const resolved = ALIASES[id] ?? id;
  return BY_ID.has(resolved) ? resolved : null;
}

/** Label for the code block header; unknown ids (from a later version) are shown as written. */
export function languageLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

/** Highlighted pieces of code. A token's `kind` is a Prism token type (keyword, string, …), or '' for plain text. */
export type CodeToken = { kind: string; text: string } | { kind: string; children: CodeToken[] };

function convert(stream: Prism.TokenStream, parent = ''): CodeToken[] {
  const items = Array.isArray(stream) ? stream : [stream];
  return items.map((item): CodeToken => {
    if (typeof item === 'string') return { kind: parent, text: item };
    const kind = [item.type, ...(Array.isArray(item.alias) ? item.alias : item.alias ? [item.alias] : [])].join(' ');
    return typeof item.content === 'string' ? { kind, text: item.content } : { kind, children: convert(item.content, kind) };
  });
}

/** Tokens for `content` in `language`. Unknown languages and plain text come back as one plain token. */
export function tokenize(content: string, language: string): CodeToken[] {
  const info = BY_ID.get(language);
  const grammar = info?.grammar ? Prism.languages[info.grammar] : undefined;
  if (!grammar) return [{ kind: '', text: content }];
  return convert(Prism.tokenize(content, grammar));
}

/** Code as it is shown: blank lines at the very end dropped, everything else exactly as written. */
export function displayCode(content: string): string {
  return content.replace(/(?:[ \t]*\r?\n)+[ \t]*$/, '');
}

export function lineCount(content: string): number {
  return displayCode(content).split('\n').length;
}

/**
 * Projector font size for code: large for a few lines, smaller as the code gets longer, so about
 * 48 % of the screen height holds it; never below 1.55 vh (then the block scrolls).
 */
export function stageFontSize(lines: number): string {
  const vh = Math.max(1.55, Math.min(3, 48 / Math.max(lines, 1) / 1.55));
  return `clamp(0.875rem, ${vh.toFixed(2)}vh, 2.25rem)`;
}
