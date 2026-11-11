import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ToastProvider } from '@/contexts/ToastProvider';
import {
  SAMPLE_IMPORT,
  SAMPLE_JSON,
  buildChatGptPrompt,
  checkImport,
  importErrorLines,
  importReady,
  mixCounts,
  reviewIssues,
  roomError,
} from '@/lib/quiz-import';
import { editorReducer, initEditor } from '@/lib/quiz-editor-reducer';
import { emptyQuiz, newQuestion, quizIssues, toSavePayload } from '@/lib/quiz-rules';
import { ImportQuestionsDialog } from '@/components/quiz/ImportQuestionsDialog';

const clone = () => JSON.parse(SAMPLE_JSON) as { quiz_title: string; questions: Record<string, unknown>[] };
const withQuestions = (...questions: unknown[]) => JSON.stringify({ quiz_title: 'Test', questions });
const mc = (patch: Record<string, unknown> = {}) => ({ ...SAMPLE_IMPORT.questions[0], ...patch });
const tf = (patch: Record<string, unknown> = {}) => ({ ...SAMPLE_IMPORT.questions[1], ...patch });

describe('the ChatGPT prompt', () => {
  it('asks for the chosen number and mix, grounded in the slides, JSON only, with the schema', () => {
    expect(mixCounts(10, 'mostly_mc')).toEqual({ mc: 7, tf: 3 });
    expect(mixCounts(10, 'tf_only')).toEqual({ mc: 0, tf: 10 });
    const prompt = buildChatGptPrompt({ count: 20, mix: 'balanced', audience: 'Grade 8 science' });
    expect(prompt).toContain('set of 20 questions');
    expect(prompt).toContain('10 multiple-choice and 10 true/false');
    expect(prompt).toContain('The students are: Grade 8 science.');
    expect(prompt).toContain('Do not invent facts');
    expect(prompt).toContain('Do not include Markdown code fences.');
    expect(prompt).toContain('"quiz_title": "Python Dictionaries"');
    expect(buildChatGptPrompt({ count: 5, mix: 'mc_only', audience: '' })).toContain('Generate only multiple-choice questions (5).');
  });
});

describe('checking pasted JSON', () => {
  it('accepts the canonical sample and converts it into native questions', () => {
    const check = checkImport(SAMPLE_JSON);
    expect(importReady(check)).toBe(true);
    expect(check.title).toBe('Python Dictionaries');
    const [a, b] = check.items.map((i) => i.draft!);
    expect(a.type).toBe('multiple_choice');
    expect(a.options.map((o) => o.label)).toEqual(['keys()', 'values()', 'items()', 'get()']);
    expect(a.options.findIndex((o) => o.isCorrect)).toBe(2);
    expect(a).toMatchObject({ difficulty: 'medium', topic: 'Dictionary Methods', timeLimitSeconds: 20, points: 1000 });
    expect(b.type).toBe('true_false');
    expect(b.options.map((o) => [o.label, o.isCorrect])).toEqual([['True', true], ['False', false]]);
    // They are complete quiz questions: publishable, and the same save payload as hand-made ones.
    const draft = { ...emptyQuiz(), title: 'x', questions: [a, b] };
    expect(quizIssues(draft).count).toBe(0);
    expect(toSavePayload(draft).questions[0]).toMatchObject({ type: 'multiple_choice', prompt: a.prompt, explanation: a.explanation });
  });

  it('true/false keeps the right answer when ChatGPT lists False first', () => {
    const check = checkImport(withQuestions(tf({ options: [{ id: 'A', text: 'False' }, { id: 'B', text: 'True' }], correct_answer: 'A' })));
    expect(check.items[0].draft!.options.map((o) => [o.label, o.isCorrect])).toEqual([['True', false], ['False', true]]);
  });

  it('reports each problem with the question number and field, and drops nothing', () => {
    const check = checkImport(
      withQuestions(
        mc(),
        mc({ question_text: 'Q2?', correct_answer: 'E' }),
        mc({ question_text: 'Q3?', explanation: undefined }),
        mc({ question_text: 'Q4?', question_type: 'short_answer' }),
        mc({ question_text: 'Q5?', correct_answer: 'items()' }),
        mc({ question_text: '' }),
        mc(), // the same as question 1
        tf({ question_text: 'Q8?', options: [{ id: 'A', text: 'Yes' }, { id: 'B', text: 'No' }] }),
        mc({ question_text: 'Q9?', options: [...SAMPLE_IMPORT.questions[0].options, { id: 'E', text: 'pop()' }] }),
        mc({ question_text: 'Q10?', difficulty: 'impossible' }),
      ),
    );
    expect(check.items).toHaveLength(10);
    expect(importReady(check)).toBe(false);
    const lines = importErrorLines(check);
    expect(lines).toContain('Question 2: The correct answer does not match any of the provided options.');
    expect(lines).toContain('Question 3: Explanation is missing.');
    expect(lines).toContain('Question 4: Unsupported question type "short_answer". Use "multiple_choice" or "true_false".');
    expect(lines).toContain('Question 5: The correct answer must be an option\'s id. "items()" is the text of option C; use "C".');
    expect(lines).toContain('Question 6: The question text is empty.');
    expect(lines).toContain('Question 7: Same question as question 1.');
    expect(lines).toContain('Question 8: A true/false question needs exactly two options: "True" and "False".');
    expect(lines).toContain('Question 9: Rally questions can have at most 4 options; this one has 5.');
    expect(lines).toContain('Question 10: Difficulty "impossible" is not supported. Use "easy", "medium" or "hard".');
    expect(check.items[0].errors).toEqual([]);
    expect(check.items[0].draft).not.toBeNull();
  });

  it('explains broken JSON, a missing quiz title and a wrong shape', () => {
    expect(checkImport('{"quiz_title": "x", "questions": [').fatal[0]).toMatch(/probably cut off/);
    expect(checkImport('{\n  "quiz_title": "x",\n  "questions": [1,, 2]\n}').fatal[0]).toMatch(/not valid JSON.*missing comma/);
    expect(checkImport('{“quiz_title”: “x”}').fatal[0]).toMatch(/curly quotes/);
    expect(checkImport('').fatal[0]).toMatch(/Paste the JSON/);
    expect(checkImport('[]').fatal[0]).toMatch(/is a list/);
    expect(checkImport('{"questions": []}').fatal[0]).toMatch(/empty/);
    const noTitle = clone() as Record<string, unknown>;
    delete noTitle.quiz_title;
    expect(checkImport(JSON.stringify(noTitle)).quizErrors).toEqual(['Quiz: "quiz_title" is missing.']);
    expect(checkImport('x'.repeat(300_001)).fatal[0]).toMatch(/too long/);
  });

  it('removes a code fence or chat text around the JSON, and says so', () => {
    const fenced = checkImport('```json\n' + SAMPLE_JSON + '\n```');
    expect(importReady(fenced)).toBe(true);
    expect(fenced.notes[0]).toMatch(/code fence/);
    const chatty = checkImport('Here is your quiz:\n' + SAMPLE_JSON + '\nGood luck!');
    expect(importReady(chatty)).toBe(true);
    expect(chatty.notes[0]).toMatch(/Ignored the text/);
  });

  it('catches questions already in the quiz and the 100-question limit', () => {
    const check = checkImport(SAMPLE_JSON, { existing: [{ prompt: 'which method returns all key-value pairs in a dictionary' }] });
    expect(check.items[0].errors).toEqual(['This question is already in your quiz.']);
    expect(roomError(2, 98)).toBeNull();
    expect(roomError(3, 98)).toMatch(/room for 2 more/);
  });

  it('the review step still checks questions after the teacher edits them', () => {
    const q = checkImport(SAMPLE_JSON).items[0].draft!;
    expect(reviewIssues(q)).toEqual([]);
    expect(reviewIssues({ ...q, explanation: '' })).toContain('Add an explanation.');
    expect(reviewIssues({ ...q, options: q.options.map((o) => ({ ...o, isCorrect: false })) })).toContain('Mark the correct answer.');
  });
});

describe('adding imported questions to the editor', () => {
  const imported = checkImport(SAMPLE_JSON).items.map((i) => i.draft!);

  it('replaces the blank starter question, fills an empty title, and ignores a repeated import', () => {
    const start = initEditor(emptyQuiz(), false);
    const action = { type: 'importQuestions', questions: imported, title: 'Python Dictionaries', description: 'From slides' } as const;
    const once = editorReducer(start, action);
    expect(once.draft.questions.map((q) => q.prompt)).toEqual(imported.map((q) => q.prompt));
    expect(once.draft.title).toBe('Python Dictionaries');
    expect(editorReducer(once, action)).toBe(once); // a double submit adds nothing
  });

  it('keeps the teacher’s own questions and title', () => {
    const own = { ...newQuestion(), prompt: 'Mine?' };
    const start = initEditor({ ...emptyQuiz(), title: 'My quiz', questions: [own] }, false);
    const next = editorReducer(start, { type: 'importQuestions', questions: imported, title: 'Other' });
    expect(next.draft.title).toBe('My quiz');
    expect(next.draft.questions.map((q) => q.prompt)).toEqual(['Mine?', ...imported.map((q) => q.prompt)]);
  });
});

describe('dialogs', () => {
  it('keep focus where the teacher is typing when the parent re-renders with a new onClose', async () => {
    const { Dialog } = await import('@/components/ui/Dialog');
    const view = (n: number) => (
      <Dialog open onClose={() => n} title="Typing">
        <input aria-label="first" />
        <textarea aria-label="typing here" />
      </Dialog>
    );
    const { rerender } = render(view(1));
    await new Promise((r) => requestAnimationFrame(r));
    const box = screen.getByLabelText('typing here');
    box.focus();
    rerender(view(2));
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.activeElement).toBe(box);
  });
});

describe('the import dialog', () => {
  const wrap = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

  it('copy prompt → paste → validate → review → add, with edits and deletes applied', () => {
    const onImport = vi.fn();
    render(<ImportQuestionsDialog open onClose={() => {}} existing={emptyQuiz().questions} onImport={onImport} />, { wrapper: wrap });
    expect(screen.getByRole('button', { name: 'Copy ChatGPT prompt' })).toBeInTheDocument();
    expect(screen.getByLabelText('Prompt for ChatGPT')).toHaveTextContent('educational assessment specialist');
    fireEvent.click(screen.getByRole('button', { name: /Next: paste the JSON/ }));

    const review = screen.getByRole('button', { name: /Review questions/ });
    expect(review).toBeDisabled();
    fireEvent.change(screen.getByLabelText('JSON from ChatGPT'), { target: { value: '{"quiz_title": "x"' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validate JSON' }));
    expect(screen.getByText(/probably cut off/)).toBeInTheDocument();
    expect(review).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Use sample JSON/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Validate JSON' }));
    expect(screen.getByText('All 3 questions are valid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Review questions/ }));

    const first = screen.getByRole('listitem', { name: 'Question 1' });
    fireEvent.change(within(first).getByLabelText('Question'), { target: { value: 'Which method gives key-value pairs?' } });
    fireEvent.click(within(first).getByRole('radio', { name: 'Mark answer A as correct' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete question 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 questions to the quiz' }));

    expect(onImport).toHaveBeenCalledTimes(1);
    const { questions, title } = onImport.mock.calls[0][0];
    expect(title).toBe('Python Dictionaries');
    expect(questions).toHaveLength(2);
    expect(questions[0].prompt).toBe('Which method gives key-value pairs?');
    expect(questions[1].code).toEqual({ language: 'python', content: SAMPLE_IMPORT.questions[2].code.content });
    expect(questions[0].options[0].isCorrect).toBe(true);
  });

  it('makes no network or AI calls: the feature has no fetch and no API key', () => {
    for (const file of ['src/lib/quiz-import.ts', 'src/components/quiz/ImportQuestionsDialog.tsx']) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/fetch\(|XMLHttpRequest|api[_-]?key|openai|supabase/i);
    }
  });
});
