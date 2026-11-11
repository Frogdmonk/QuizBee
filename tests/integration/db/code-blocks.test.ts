import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, createAuthUser, createTestDb, type Actor } from './harness';

/*
 * Code blocks in questions: stored exactly as written, validated by save_quiz, copied with the
 * quiz, snapshotted by start_game and sent to every screen by get_game_state. Never run.
 */

type Json = Record<string, unknown>;
let db: PGlite;
let host: string;
const teacher = (id: string): Actor => ({ kind: 'user', id });

async function rpc<T = unknown>(actor: Actor, sql: string, params: unknown[] = []): Promise<T> {
  return as(db, actor, async (tx: Transaction) => {
    const { rows } = await tx.query<{ r: T }>(`select ${sql} as r`, params);
    return rows[0]?.r as T;
  });
}

async function errorMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

// Indentation, a blank line, quotes, a backslash escape and a tab: all must survive untouched.
const CODE = '#include <stdio.h>\n\nint main() {\n    char *s = "a\\tb";\n\tprintf("%s\\n", s);\n    return 0;\n}\n';

const QUIZ: Json = {
  title: 'C basics',
  questions: [
    {
      type: 'multiple_choice',
      prompt: 'What does this program print?',
      code: { language: 'c', content: CODE },
      explanation: 'printf prints the string.',
      options: [
        { label: 'a\tb', is_correct: true },
        { label: 'printf("%s", s);', is_correct: false, is_code: true },
      ],
    },
    { type: 'true_false', prompt: 'C has a main function.', options: [{ label: 'True', is_correct: true }, { label: 'False' }] },
  ],
};

const save = (quiz: Json) => rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quiz)]);
const withCode = (code: unknown) => ({ ...QUIZ, questions: [{ ...(QUIZ.questions as Json[])[0], code }] });

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
});

describe('code blocks', () => {
  it('stores the code and code answers exactly, and copies them with the quiz', async () => {
    const id = await save(QUIZ);
    const { rows } = await db.query<Json>('select code_language, code_content from public.quiz_questions where quiz_id = $1 order by position', [id]);
    expect(rows).toEqual([{ code_language: 'c', code_content: CODE }, { code_language: null, code_content: null }]);
    const options = await db.query<Json>(
      `select o.label, o.label_is_code from public.question_options o join public.quiz_questions q on q.id = o.question_id
        where q.quiz_id = $1 and q.position = 0 order by o.position`,
      [id],
    );
    expect(options.rows).toEqual([{ label: 'a\tb', label_is_code: false }, { label: 'printf("%s", s);', label_is_code: true }]);

    const copy = await rpc<string>(teacher(host), 'public.duplicate_quiz($1)', [id]);
    const copied = await db.query<Json>('select code_language, code_content from public.quiz_questions where quiz_id = $1 and position = 0', [copy]);
    expect(copied.rows[0]).toEqual({ code_language: 'c', code_content: CODE });
  });

  it('refuses a missing language, a bad identifier, non-text content and code over 2000 characters', async () => {
    expect(await errorMessage(save(withCode({ content: 'x' })))).toMatch(/Question 1: choose the programming language/);
    expect(await errorMessage(save(withCode({ language: 'c; drop table', content: 'x' })))).toMatch(/choose the programming language/);
    expect(await errorMessage(save(withCode({ language: 'c', content: 5 })))).toMatch(/invalid code block/);
    expect(await errorMessage(save(withCode({ language: 'c', content: 'x'.repeat(2001) })))).toMatch(/at most 2000 characters/);
    // A language Rally may support later is stored as written; the screens show it as plain text.
    const id = await save(withCode({ language: 'Rust', content: 'fn main() {}' }));
    expect((await db.query<Json>('select code_language from public.quiz_questions where quiz_id = $1 and position = 0', [id])).rows[0]).toEqual({ code_language: 'rust' });
  });

  it('a code block without code can be saved as a draft but not published', async () => {
    const id = await save(withCode({ language: 'python', content: '  \n' }));
    expect(await errorMessage(rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [id]))).toMatch(/add the code, or remove the code block/);
  });

  it('the game sends the code and which answers are code to the players', async () => {
    const id = await save(QUIZ);
    await rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [id]);
    const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [id]);
    const student: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
    await rpc(student, 'public.join_session($1, $2, $3)', [sessionId, 'Ada', '000000000']);
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    const state = await rpc<{ question: { code: Json | null; options: { label: string; is_code: boolean }[] } }>(student, 'public.get_game_state($1)', [sessionId]);
    expect(state.question.code).toEqual({ language: 'c', content: CODE });
    expect(state.question.options.map((o) => o.is_code)).toEqual([false, true]);

    // Editing the quiz later does not change the running game's snapshot.
    await db.query(`update public.quiz_questions set code_content = 'changed' where quiz_id = $1 and position = 0`, [id]);
    const again = await rpc<{ question: { code: Json } }>(student, 'public.get_game_state($1)', [sessionId]);
    expect(again.question.code).toEqual({ language: 'c', content: CODE });
  });
});
