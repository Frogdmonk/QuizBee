import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { displayCode, languageLabel, normaliseLanguage, stageFontSize, tokenize, type CodeToken } from '@/lib/code';
import { CodeBlock } from '@/components/code/CodeBlock';
import { CodeEditor } from '@/components/code/CodeEditor';
import { QuestionStage } from '@/components/game/QuestionStage';
import { checkImport, importErrorLines, importReady } from '@/lib/quiz-import';
import { emptyQuiz, newQuestion, questionIssues, quizIssues, toSavePayload } from '@/lib/quiz-rules';
import type { GameQuestion } from '@/types/game';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const PY = 'numbers = [10, 20, 30]\nresult = 0\n\nfor num in numbers:\n    result += num  # add it\n\nprint(result)';
const C = '#include <stdio.h>\n\nint main() {\n    int x = 5;\n    printf("%d\\n", x * 2);\n    return 0;\n}';

/** All the token kinds in a highlighted piece of code. */
function kinds(tokens: CodeToken[]): Set<string> {
  const out = new Set<string>();
  const walk = (ts: CodeToken[]) =>
    ts.forEach((t) => {
      t.kind.split(' ').forEach((k) => k && out.add(k));
      if ('children' in t) walk(t.children);
    });
  walk(tokens);
  return out;
}
const flat = (tokens: CodeToken[]): string => tokens.map((t) => ('children' in t ? flat(t.children) : t.text)).join('');

describe('languages and highlighting', () => {
  it('knows Python, C, C++ and Java by id or common name; unknown ones are kept as written', () => {
    expect(['Python', 'py', 'c', 'C++', 'cpp', 'JAVA', 'text'].map(normaliseLanguage)).toEqual(['python', 'python', 'c', 'cpp', 'cpp', 'java', 'text']);
    expect(normaliseLanguage('rust')).toBeNull();
    expect(languageLabel('cpp')).toBe('C++');
    expect(languageLabel('rust')).toBe('rust');
  });

  it('highlights keywords, strings, comments, numbers, operators and functions per language, losing no character', () => {
    const py = tokenize(PY, 'python');
    expect(flat(py)).toBe(PY);
    for (const k of ['keyword', 'comment', 'number', 'operator', 'punctuation']) expect(kinds(py).has(k), k).toBe(true);
    const def = kinds(tokenize('def total(xs):\n    return sum(xs) + len("ab")', 'python'));
    for (const k of ['function', 'builtin', 'string']) expect(def.has(k), k).toBe(true);
    const c = tokenize(C, 'c');
    expect(flat(c)).toBe(C);
    for (const k of ['macro', 'keyword', 'string', 'function', 'number']) expect(kinds(c).has(k), k).toBe(true);
    const java = tokenize('public class Main {\n    public static void main(String[] args) {\n        System.out.println(4 * 4);\n    }\n}', 'java');
    for (const k of ['keyword', 'class-name', 'function', 'number']) expect(kinds(java).has(k), k).toBe(true);
    expect(kinds(tokenize('cout << a % b;', 'cpp')).has('operator')).toBe(true);
    // Unknown language or plain text: one plain token, unchanged.
    expect(tokenize(PY, 'rust')).toEqual([{ kind: '', text: PY }]);
  });

  it('shows the code exactly as written: indentation, blank lines, quotes and backslashes', () => {
    expect(displayCode('x = 1\n\n\n')).toBe('x = 1');
    expect(displayCode('  indented\n')).toBe('  indented');
    const { container } = render(<CodeBlock code={{ language: 'c', content: C }} />);
    expect(container.querySelector('code')!.textContent).toBe(C);
    expect(screen.getByRole('figure', { name: 'C code, 7 lines' })).toBeInTheDocument();
    expect(container.querySelectorAll('.code-gutter span')).toHaveLength(7);
  });

  it('never interprets code as HTML', () => {
    const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const { container } = render(<CodeBlock code={{ language: 'python', content: evil }} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('code')!.textContent).toBe(evil);
  });

  it('the projector font shrinks with longer code, within limits', () => {
    expect(stageFontSize(5)).toContain('3.00vh');
    expect(stageFontSize(20)).toContain('1.55vh');
    expect(stageFontSize(60)).toContain('1.55vh');
  });

  it('nothing in the code feature runs code or calls out', () => {
    const files = ['src/lib/code.ts', ...readdirSync('src/components/code').map((f) => join('src/components/code', f))];
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\beval\(|new Function\(|fetch\(|XMLHttpRequest|new Worker|dangerouslySetInnerHTML|innerHTML/);
    }
  });
});

describe('the code editor', () => {
  function Harness({ initial = '' }: { initial?: string }) {
    const [content, setContent] = useState(initial);
    const [language, setLanguage] = useState('python');
    return <CodeEditor language={language} content={content} onChange={setContent} onLanguageChange={setLanguage} />;
  }

  it('edits code as text, Tab indents by four spaces, and the language can change', () => {
    render(<Harness initial="if x:" />);
    const box = screen.getByLabelText('Code') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'if x:\n' } });
    box.setSelectionRange(6, 6);
    fireEvent.keyDown(box, { key: 'Tab' });
    expect(box.value).toBe('if x:\n    ');
    fireEvent.change(screen.getByLabelText('Code language'), { target: { value: 'java' } });
    expect((screen.getByLabelText('Code language') as HTMLSelectElement).value).toBe('java');
  });
});

describe('questions with code in the quiz', () => {
  it('saves the code untouched (no trimming) and needs code before publishing', () => {
    const q = { ...newQuestion(), prompt: 'What prints?', code: { language: 'python', content: '    x = 1\nprint(x)\n' } };
    q.options = q.options.slice(0, 2).map((o, i) => ({ ...o, label: String(i), isCorrect: i === 1, isCode: i === 0 }));
    const payload = toSavePayload({ ...emptyQuiz(), title: 't', questions: [q] });
    expect(payload.questions[0].code).toEqual({ language: 'python', content: '    x = 1\nprint(x)\n' });
    expect(payload.questions[0].options.map((o) => o.is_code)).toEqual([true, false]);
    expect(questionIssues(q)).toEqual([]);
    expect(questionIssues({ ...q, code: { language: 'python', content: '  ' } })).toContain('Add the code, or remove the code block.');
    expect(quizIssues({ ...emptyQuiz(), title: 't', questions: [q] }).count).toBe(0);
  });

  it('the projector shows code beside the answers; the host panel above them; code answers in monospace', () => {
    const question = {
      id: 'q1', position: 0, type: 'multiple_choice', prompt: 'What will be printed?', imagePath: null, status: 'open',
      code: { language: 'python', content: PY },
      options: [
        { id: 'a', position: 0, label: 'print(60)', imagePath: null, isCode: true },
        { id: 'b', position: 1, label: '50', imagePath: null },
      ],
      distribution: null, correctOptionId: null, explanation: null,
    } as unknown as GameQuestion;
    const { container, rerender } = render(<QuestionStage question={question} />);
    expect(container.querySelector('.grid-cols-\\[minmax\\(0\\,1\\.45fr\\)_minmax\\(0\\,1fr\\)\\]')).not.toBeNull();
    expect(container.querySelector('figure code')!.textContent).toBe(PY);
    expect(container.querySelectorAll('code.font-mono')).toHaveLength(1);
    rerender(<QuestionStage question={question} size="panel" />);
    expect(container.querySelector('figure')).not.toBeNull();
    rerender(<QuestionStage question={{ ...question, code: null }} />);
    expect(container.querySelector('figure')).toBeNull();
  });
});

describe('importing code questions', () => {
  const opts = (texts: string[]) => texts.map((text, i) => ({ id: 'ABCD'[i], text }));
  const python = {
    question_text: 'What will be the output of the following Python program?',
    question_type: 'multiple_choice',
    code: { language: 'python', content: 'numbers = [10, 20, 30]\nresult = 0\n\nfor num in numbers:\n    result += num\n\nprint(result)' },
    options: opts(['30', '50', '60', '100']),
    correct_answer: 'C',
    explanation: 'The loop adds all three elements: 10 + 20 + 30, producing 60.',
    difficulty: 'medium',
    topic: 'Loops and Lists',
  };
  const c = { ...python, question_text: 'What is printed when the following C program executes?', code: { language: 'c', content: C }, options: opts(['5', '10', '15', '25']), correct_answer: 'B', explanation: '5 * 2 is 10.' };
  const cpp = { ...python, question_text: 'What is the output of this C++ program?', code: { language: 'cpp', content: '#include <iostream>\nusing namespace std;\n\nint main() {\n    int a = 10;\n    int b = 3;\n    cout << a % b;\n    return 0;\n}' }, options: opts(['1', '2', '3', '0']), correct_answer: 'A', explanation: '10 % 3 leaves 1.' };
  const java = { ...python, question_text: 'What will this Java program display?', code: { language: 'java', content: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println(4 * 4);\n    }\n}' }, options: opts(['8', '12', '16', '20']), correct_answer: 'C', explanation: '4 × 4 = 16.' };
  const plain = { question_text: 'Which keyword starts a loop in Python?', question_type: 'multiple_choice', options: opts(['for', 'def', 'class', 'import']), correct_answer: 'A', explanation: 'for loops over items.' };
  const tf = { question_text: 'Python uses indentation to group statements.', question_type: 'true_false', options: opts(['True', 'False']), correct_answer: 'A', explanation: 'Blocks are indented.' };
  const quiz = (...questions: unknown[]) => JSON.stringify({ quiz_title: 'Programming', questions });

  it('imports Python, C, C++ and Java questions next to ordinary and true/false ones, code exactly as sent', () => {
    const check = checkImport(quiz(python, c, cpp, java, plain, tf));
    expect(importErrorLines(check)).toEqual([]);
    expect(importReady(check)).toBe(true);
    const drafts = check.items.map((i) => i.draft!);
    expect(drafts.map((d) => d.code?.language ?? null)).toEqual(['python', 'c', 'cpp', 'java', null, null]);
    expect(drafts[0].code!.content).toBe(python.code.content);
    expect(drafts[0].code!.content.split('\n')[4]).toBe('    result += num');
    expect(drafts[1].code!.content).toContain('printf("%d\\n", x * 2);'); // quotes and the backslash survive
    expect(drafts[0].prompt).not.toContain('result'); // question and code stay apart
    expect(drafts[2].options.find((o) => o.isCorrect)!.label).toBe('1');
  });

  it('reports code problems with the question number', () => {
    const lines = importErrorLines(
      checkImport(
        quiz(
          plain,
          { ...python, question_text: 'Q2?', code: { language: 'python' } },
          { ...python, question_text: 'Q3?', code: { language: 'python', content: '   ' } },
          { ...python, question_text: 'Q4?', code: { language: 'rust', content: 'fn main() {}' } },
          { ...python, question_text: 'Q5?', code: 'print(1)' },
          { ...python, question_text: 'Look:\n```python\nprint(1)\n```' },
          { ...python, question_text: 'Q7?', correct_answer: 'E' },
          { ...python, question_text: 'Q8?', code: { language: 'python', content: 'x'.repeat(2001) } },
        ),
      ),
    );
    expect(lines).toContain('Question 2: Code content is missing.');
    expect(lines).toContain('Question 3: Code content is missing.');
    expect(lines).toContain('Question 4: Code: unsupported language identifier "rust". Use "python", "c", "cpp" or "java".');
    expect(lines).toContain('Question 5: Code must be an object with "language" and "content".');
    expect(lines).toContain('Question 6: The question text contains a code fence (```). Put the code in the "code" object instead.');
    expect(lines).toContain('Question 7: The correct answer does not match any of the provided options.');
    expect(lines).toContain('Question 8: Code is 2001 characters; the limit is 2000.');
  });

  it('answers can be code snippets; the same question text with different code is not a duplicate', () => {
    const snippets = {
      ...plain,
      question_text: 'Which line prints hello?',
      options: [
        { id: 'A', code: { language: 'python', content: 'print("hello")' } },
        { id: 'B', code: { language: 'python', content: 'echo("hello")' } },
      ],
    };
    const check = checkImport(quiz(snippets, python, { ...python, code: { language: 'python', content: 'print(1)' } }));
    expect(importErrorLines(check)).toEqual([]);
    const [a, b] = check.items[0].draft!.options;
    expect([a.label, a.isCode, b.isCode]).toEqual(['print("hello")', true, true]);
    expect(importErrorLines(checkImport(quiz(python, python)))).toContain('Question 2: Same question as question 1.');
    const both = { ...snippets, options: [{ id: 'A', text: 'x', code: { language: 'python', content: 'y' } }, { id: 'B', text: 'z' }] };
    expect(importErrorLines(checkImport(quiz(both)))).toContain('Question 1: Option 1 has both "text" and "code". Give one of them.');
  });
});
