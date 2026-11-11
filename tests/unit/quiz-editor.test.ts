import { describe, expect, it } from 'vitest';
import {
  changeQuestionType,
  draftFingerprint,
  emptyQuiz,
  newOption,
  newQuestion,
  questionIssues,
  quizIssues,
  saveBlockers,
  toSavePayload,
} from '@/lib/quiz-rules';
import { editorReducer, initEditor, type EditorState } from '@/lib/quiz-editor-reducer';
import { fitWithin } from '@/utils/image';
import { relativeTime } from '@/utils/time';
import type { QuestionDraft } from '@/types/quiz';

function completeMc(): QuestionDraft {
  const q = newQuestion('multiple_choice');
  return {
    ...q,
    prompt: 'Capital of France?',
    options: q.options.slice(0, 3).map((o, i) => ({ ...o, label: ['Paris', 'Rome', 'Madrid'][i], isCorrect: i === 0 })),
  };
}

describe('question rules (mirror of private.quiz_issues)', () => {
  it('accepts a complete multiple-choice question', () => {
    expect(questionIssues(completeMc())).toEqual([]);
  });

  it('flags missing prompt, blank answers and no correct answer', () => {
    const issues = questionIssues(newQuestion('multiple_choice'));
    expect(issues).toEqual(['Write the question text.', 'Fill in every answer.', 'Mark the correct answer.']);
  });

  it('requires images for picture answers but not labels', () => {
    const q = { ...newQuestion('image_choice'), prompt: 'Which is a cat?' };
    q.options = q.options.slice(0, 2).map((o, i) => ({ ...o, isCorrect: i === 0 }));
    expect(questionIssues(q)).toEqual(['Add an image to every answer.']);
    q.options = q.options.map((o) => ({ ...o, imagePath: 'uid/x.webp' }));
    expect(questionIssues(q)).toEqual([]);
  });

  it('true/false questions come with fixed True/False answers', () => {
    const q = newQuestion('true_false');
    expect(q.options.map((o) => o.label)).toEqual(['True', 'False']);
    expect(questionIssues({ ...q, prompt: 'x' })).toEqual(['Mark the correct answer.']);
  });

  it('changing type keeps the prompt and preserves the true/false answer', () => {
    let q = { ...newQuestion('true_false'), prompt: 'Sky is blue' };
    q = { ...q, options: q.options.map((o) => ({ ...o, isCorrect: o.label === 'True' })) };
    const mc = changeQuestionType(q, 'multiple_choice');
    expect(mc.prompt).toBe('Sky is blue');
    expect(mc.options).toHaveLength(4);
    const back = changeQuestionType(mc, 'true_false');
    expect(back.options.map((o) => o.label)).toEqual(['True', 'False']);
    // MC → image choice keeps the answers already typed.
    const typed = { ...completeMc() };
    expect(changeQuestionType(typed, 'image_choice').options.map((o) => o.label)).toEqual(['Paris', 'Rome', 'Madrid']);
  });

  it('quizIssues reports quiz-level problems', () => {
    const draft = { ...emptyQuiz(), questions: [] };
    expect(quizIssues(draft).quiz).toEqual(['Give your quiz a title.', 'Add at least one question.']);
  });

  it('saveBlockers only blocks on structural problems, not completeness', () => {
    const draft = { ...emptyQuiz(), title: 'Draft' };
    expect(saveBlockers(draft)).toEqual([]);
    expect(saveBlockers({ ...draft, title: ' ' })[0]).toMatch(/title/);
    expect(saveBlockers({ ...draft, questions: [{ ...completeMc(), prompt: 'x'.repeat(301) }] })[0]).toMatch(/too long/);
  });

  it('toSavePayload trims text and uses snake_case for the RPC', () => {
    const draft = { ...emptyQuiz(), title: '  Quiz  ', questions: [{ ...completeMc(), prompt: '  Q  ' }] };
    const payload = toSavePayload(draft);
    expect(payload.title).toBe('Quiz');
    expect(payload.questions[0]).toMatchObject({ prompt: 'Q', time_limit_seconds: 20, points: 1000 });
    expect(payload.questions[0].options[0]).toEqual({ label: 'Paris', image_path: null, is_correct: true, misconception: '', is_code: false });
    expect(payload.questions[0]).toMatchObject({ level: null, objective: '', kind: null, recovery: null });
  });
});

describe('editor reducer', () => {
  const start = (): EditorState => initEditor({ ...emptyQuiz(), title: 'T', questions: [completeMc(), completeMc()] }, true);

  it('starts clean and becomes dirty after an edit', () => {
    const s = start();
    expect(draftFingerprint(s.draft)).toBe(s.savedFingerprint);
    const next = editorReducer(s, { type: 'details', patch: { title: 'Changed' } });
    expect(draftFingerprint(next.draft)).not.toBe(next.savedFingerprint);
  });

  it('reordering questions counts as a change, and moving out of bounds is a no-op', () => {
    const s = start();
    const [a, b] = s.draft.questions;
    const moved = editorReducer(s, { type: 'moveQuestion', key: b.key, delta: -1 });
    expect(moved.draft.questions.map((q) => q.key)).toEqual([b.key, a.key]);
    expect(editorReducer(s, { type: 'moveQuestion', key: a.key, delta: -1 })).toBe(s);
  });

  it('setCorrect keeps exactly one correct answer', () => {
    const s = start();
    const q = s.draft.questions[0];
    const next = editorReducer(s, { type: 'setCorrect', questionKey: q.key, optionKey: q.options[2].key });
    expect(next.draft.questions[0].options.map((o) => o.isCorrect)).toEqual([false, false, true]);
  });

  it('enforces 2–4 answers and never edits true/false answers', () => {
    let s = start();
    const q = s.draft.questions[0]; // 3 options
    s = editorReducer(s, { type: 'addOption', questionKey: q.key });
    s = editorReducer(s, { type: 'addOption', questionKey: q.key });
    expect(s.draft.questions[0].options).toHaveLength(4);
    const opts = s.draft.questions[0].options;
    s = editorReducer(s, { type: 'removeOption', questionKey: q.key, optionKey: opts[0].key });
    s = editorReducer(s, { type: 'removeOption', questionKey: q.key, optionKey: opts[1].key });
    s = editorReducer(s, { type: 'removeOption', questionKey: q.key, optionKey: opts[2].key });
    expect(s.draft.questions[0].options).toHaveLength(2);

    s = editorReducer(s, { type: 'changeType', key: q.key, questionType: 'true_false' });
    const tf = s.draft.questions[0];
    expect(editorReducer(s, { type: 'addOption', questionKey: q.key }).draft.questions[0].options).toHaveLength(2);
    expect(editorReducer(s, { type: 'removeOption', questionKey: q.key, optionKey: tf.options[0].key }).draft.questions[0].options).toHaveLength(2);
  });

  it('duplicates a question right after the original with fresh option keys', () => {
    const s = start();
    const src = s.draft.questions[0];
    const next = editorReducer(s, { type: 'duplicateQuestion', key: src.key, newKey: 'copy' });
    expect(next.draft.questions.map((q) => q.key)).toEqual([src.key, 'copy', s.draft.questions[1].key]);
    expect(next.draft.questions[1].options[0].key).not.toBe(src.options[0].key);
    expect(next.draft.questions[1].prompt).toBe(src.prompt);
  });

  it('adds a question after the selected one', () => {
    const s = start();
    const next = editorReducer(s, { type: 'addQuestion', questionType: 'true_false', afterKey: s.draft.questions[0].key, key: 'new' });
    expect(next.draft.questions[1].key).toBe('new');
    expect(next.draft.questions[1].type).toBe('true_false');
  });

  it('saved: edits made while saving stay unsaved', () => {
    const s0 = initEditor({ ...emptyQuiz(), title: 'Draft' }, false);
    const sent = s0.draft;
    // The teacher keeps typing while the save request is in flight.
    const typed = editorReducer(s0, { type: 'details', patch: { title: 'Draft v2' } });
    const afterSave = editorReducer(typed, { type: 'saved', id: 'quiz-1', sent });
    expect(afterSave.draft.id).toBe('quiz-1');
    expect(afterSave.draft.title).toBe('Draft v2');
    expect(draftFingerprint(afterSave.draft)).not.toBe(afterSave.savedFingerprint);

    const clean = editorReducer(s0, { type: 'saved', id: 'quiz-1', sent });
    expect(draftFingerprint(clean.draft)).toBe(clean.savedFingerprint);
  });

  it('options created by newOption are independent', () => {
    expect(newOption().key).not.toBe(newOption().key);
  });
});

describe('helpers', () => {
  it('fitWithin scales down without upscaling', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1000, 4000)).toEqual({ width: 320, height: 1280 });
  });

  it('relativeTime formats past times', () => {
    const now = Date.parse('2026-11-07T12:00:00Z');
    expect(relativeTime('2026-11-07T11:59:50Z', now)).toBe('just now');
    expect(relativeTime('2026-11-07T09:00:00Z', now, 'en')).toBe('3 hours ago');
    expect(relativeTime('2026-11-04T12:00:00Z', now, 'en')).toBe('3 days ago');
  });
});
