import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, broadcasts, canUseTopic, createAuthUser, createTestDb, errorCode, type Actor } from './harness';

type Json = Record<string, unknown>;
type Lobby = {
  id: string;
  role: string;
  pin: string;
  status: string;
  is_locked: boolean;
  participant_count: number;
  max_participants: number;
  has_presenter_link: boolean;
  participants: { id: string; nickname: string; avatar: string }[];
};
type Lookup = {
  found: boolean;
  session_id?: string;
  is_locked?: boolean;
  is_full?: boolean;
  me?: { id: string; status: string; nickname: string } | null;
};
type Participant = { id: string; nickname: string; avatar: string; status: string };

const AVATAR = '012345678'.replace(/./g, '0');
const AVATAR_2 = '791555957';

let db: PGlite;
let host: string;
let otherTeacher: string;
let editor: string;

const teacher = (id: string): Actor => ({ kind: 'user', id });
const anonUser = (id: string): Actor => ({ kind: 'user', id, anonymous: true });

async function errorMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

async function rpc<T = unknown>(actor: Actor, sql: string, params: unknown[] = []): Promise<T> {
  return as(db, actor, async (tx: Transaction) => {
    const { rows } = await tx.query<{ r: T }>(`select ${sql} as r`, params);
    return rows[0]?.r as T;
  });
}

const quizBody = (title = 'Planets'): Json => ({
  title,
  questions: [
    {
      type: 'multiple_choice',
      prompt: 'Which planet is largest?',
      options: [
        { label: 'Jupiter', is_correct: true },
        { label: 'Mars', is_correct: false },
      ],
    },
  ],
});

async function publishedQuiz(owner: string, title?: string): Promise<string> {
  const id = await rpc<string>(teacher(owner), 'public.save_quiz($1::jsonb)', [JSON.stringify(quizBody(title))]);
  await rpc(teacher(owner), `public.set_quiz_status($1, 'published')`, [id]);
  return id;
}

const createSession = (actor: Actor, quizId: string, settings: Json = {}) =>
  rpc<string>(actor, 'public.create_session($1, $2::jsonb)', [quizId, JSON.stringify(settings)]);
const lobby = (actor: Actor, sessionId: string) => rpc<Lobby>(actor, 'public.get_session_lobby($1)', [sessionId]);
const lookup = (actor: Actor, pin: string) => rpc<Lookup>(actor, 'public.lookup_session($1)', [pin]);
const join = (actor: Actor, sessionId: string, nickname: string, avatar = AVATAR) =>
  rpc<Participant>(actor, 'public.join_session($1, $2, $3)', [sessionId, nickname, avatar]);
const lock = (actor: Actor, sessionId: string, locked: boolean) =>
  rpc<boolean>(actor, 'public.set_session_locked($1, $2)', [sessionId, locked]);
const remove = (actor: Actor, sessionId: string, participantId: string) =>
  rpc(actor, 'public.remove_participant($1, $2)', [sessionId, participantId]);
const playerState = (actor: Actor, sessionId: string) =>
  rpc<{ session: Json; me: Participant }>(actor, 'public.get_player_state($1)', [sessionId]);

async function newStudent(): Promise<Actor> {
  return anonUser(await createAuthUser(db, { anonymous: true }));
}

async function hostedSession(settings: Json = {}) {
  const quizId = await publishedQuiz(host);
  const sessionId = await createSession(teacher(host), quizId, settings);
  const { pin } = await lobby(teacher(host), sessionId);
  return { quizId, sessionId, pin };
}

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
  otherTeacher = await createAuthUser(db);
  editor = await createAuthUser(db);
});

describe('create_session', () => {
  it('creates a lobby with a 6-digit PIN for a published quiz', async () => {
    const { sessionId } = await hostedSession({ max_participants: 30 });
    const view = await lobby(teacher(host), sessionId);
    expect(view.role).toBe('host');
    expect(view.pin).toMatch(/^[1-9][0-9]{5}$/);
    expect(view.status).toBe('lobby');
    expect(view.max_participants).toBe(30);
    expect(view.participants).toEqual([]);
    expect(view.has_presenter_link).toBe(false);
  });

  it('refuses drafts, other teachers, students and the anon role', async () => {
    const draft = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quizBody())]);
    expect(await errorMessage(createSession(teacher(host), draft))).toMatch(/Publish the quiz/);

    const quizId = await publishedQuiz(host);
    expect(await errorMessage(createSession(teacher(otherTeacher), quizId))).toBe('Quiz not found.');
    const student = await newStudent();
    expect(await errorCode(createSession(student, quizId))).toBe('42501');
    expect(await errorCode(rpc({ kind: 'anon' }, `public.create_session($1, '{}'::jsonb)`, [quizId]))).toBe('42501');
  });

  it('lets a teacher with edit access host a shared quiz, but not view-only', async () => {
    const quizId = await publishedQuiz(host);
    const ws = await rpc<string>(teacher(host), 'public.create_workspace($1)', ['Science']);
    const invite = await rpc<{ token: string }>(teacher(host), 'public.create_workspace_invite($1)', [ws]);
    await rpc(teacher(editor), 'public.accept_workspace_invite($1)', [invite.token]);
    await rpc(teacher(otherTeacher), 'public.accept_workspace_invite($1)', [invite.token]);
    await rpc(teacher(host), 'public.set_quiz_sharing($1, $2, $3::jsonb)', [
      quizId,
      ws,
      JSON.stringify({
        everyone: { access: 'view', can_publish: false },
        members: [{ teacher_id: editor, access: 'edit', can_publish: false }],
      }),
    ]);

    const sessionId = await createSession(teacher(editor), quizId);
    expect((await lobby(teacher(editor), sessionId)).role).toBe('host');
    expect(await errorMessage(createSession(teacher(otherTeacher), quizId))).toBe('Quiz not found.');
  });

  it('validates the player limit and caps open sessions at 5', async () => {
    const quizId = await publishedQuiz(host);
    expect(await errorMessage(createSession(teacher(host), quizId, { max_participants: 1 }))).toMatch(/between 2 and 100/);
    expect(await errorMessage(createSession(teacher(host), quizId, { max_participants: 101 }))).toMatch(/between 2 and 100/);
    expect(await errorMessage(createSession(teacher(host), quizId, { max_participants: 'lots' }))).toMatch(/whole number/);

    for (let i = 0; i < 5; i++) await createSession(teacher(host), quizId);
    expect(await errorMessage(createSession(teacher(host), quizId))).toMatch(/5 open sessions/);
  });

  it('cancels lobbies older than 12 hours and frees their PIN', async () => {
    const { sessionId, quizId } = await hostedSession();
    await db.query(`update public.game_sessions set created_at = now() - interval '13 hours' where id = $1`, [sessionId]);
    const student = await newStudent();
    const { pin } = await lobby(teacher(host), sessionId);
    expect((await lookup(student, pin)).found).toBe(false);

    await createSession(teacher(host), quizId);
    expect((await lobby(teacher(host), sessionId)).status).toBe('cancelled');
  });
});

describe('joining', () => {
  it('finds a session by PIN, joins, and is idempotent per device', async () => {
    const { sessionId, pin } = await hostedSession();
    const student = await newStudent();

    const found = await lookup(student, pin);
    expect(found).toMatchObject({ found: true, session_id: sessionId, is_locked: false, is_full: false, me: null });

    const me = await join(student, sessionId, '  Ada   Lovelace ');
    expect(me).toMatchObject({ nickname: 'Ada Lovelace', avatar: AVATAR, status: 'active' });

    // Joining again from the same device returns the same player and can change the look.
    const again = await join(student, sessionId, 'Ada Lovelace', AVATAR_2);
    expect(again.id).toBe(me.id);
    expect(again.avatar).toBe(AVATAR_2);
    expect((await lookup(student, pin)).me).toMatchObject({ id: me.id, status: 'active' });

    const view = await lobby(teacher(host), sessionId);
    expect(view.participant_count).toBe(1);
    expect(view.participants.map((p) => p.nickname)).toEqual(['Ada Lovelace']);
  });

  it('rejects duplicate nicknames regardless of case, spacing and punctuation', async () => {
    const { sessionId } = await hostedSession();
    await join(await newStudent(), sessionId, 'Sam Lee');
    expect(await errorMessage(join(await newStudent(), sessionId, 'sam-lee!'))).toMatch(/already uses that nickname/);
    expect(await errorMessage(join(await newStudent(), sessionId, 'SAMLEE'))).toMatch(/already uses that nickname/);
    await join(await newStudent(), sessionId, 'Sam Leo');
  });

  it.each([
    ['A', /at least 2/],
    ['Seventeen chars!!', /up to 16/],
    ['<script>', /simple punctuation/],
    ['hi@there', /simple punctuation/],
    ['ab\u200Bcd', /simple punctuation/],
    ['...', /at least one letter/],
    ['Sh1tty', /different nickname/],
    ['fuuuuck', /different nickname/],
    ['B.i.t.c.h', /different nickname/],
  ])('rejects the nickname %j', async (nickname, message) => {
    const { sessionId } = await hostedSession();
    expect(await errorMessage(join(await newStudent(), sessionId, nickname))).toMatch(message);
  });

  it('accepts names in other scripts and does not block innocent words', async () => {
    const { sessionId } = await hostedSession();
    await join(await newStudent(), sessionId, 'Zoë');
    await join(await newStudent(), sessionId, '李小龙');
    await join(await newStudent(), sessionId, 'Classic Cass');
    await join(await newStudent(), sessionId, "O'Brien");
  });

  it('validates avatar codes', async () => {
    const { sessionId } = await hostedSession();
    for (const bad of ['', '12345678', '0000000000', '800000000', '00000600a']) {
      expect(await errorMessage(join(await newStudent(), sessionId, 'Robin', bad))).toBe('Pick an avatar.');
    }
  });

  it('enforces lock and the player limit, but lets existing players update', async () => {
    const { sessionId, pin } = await hostedSession({ max_participants: 2 });
    const a = await newStudent();
    await join(a, sessionId, 'Alpha');

    await lock(teacher(host), sessionId, true);
    expect((await lookup(await newStudent(), pin)).is_locked).toBe(true);
    expect(await errorMessage(join(await newStudent(), sessionId, 'Bravo'))).toMatch(/locked this game/);
    await join(a, sessionId, 'Alpha', AVATAR_2); // already in: still allowed

    await lock(teacher(host), sessionId, false);
    await join(await newStudent(), sessionId, 'Bravo');
    expect((await lookup(await newStudent(), pin)).is_full).toBe(true);
    expect(await errorMessage(join(await newStudent(), sessionId, 'Charlie'))).toBe('This game is full.');
  });

  it('refuses teachers (non-anonymous), the anon role, and ended sessions', async () => {
    const { sessionId } = await hostedSession();
    expect(await errorCode(join(teacher(otherTeacher), sessionId, 'Teach'))).toBe('42501');
    expect(await errorCode(rpc({ kind: 'anon' }, 'public.join_session($1, $2, $3)', [sessionId, 'Anon', AVATAR]))).toBe(
      '42501',
    );
    await rpc(teacher(host), 'public.cancel_session($1)', [sessionId]);
    expect(await errorMessage(join(await newStudent(), sessionId, 'Late'))).toBe('This game has ended.');
  });

  it('throttles wrong PIN guesses per user', async () => {
    await hostedSession();
    const student = await newStudent();
    for (let i = 0; i < 10; i++) {
      expect((await lookup(student, '000000')).found).toBe(false);
    }
    expect(await errorMessage(lookup(student, '000000'))).toMatch(/Too many wrong PINs/);

    // The window resets after 10 minutes.
    const id = (student as { id: string }).id;
    await db.query(`update public.pin_attempts set window_start = now() - interval '11 minutes' where user_id = $1`, [id]);
    expect((await lookup(student, '000000')).found).toBe(false);
  });

  it('lets a player leave and come back, freeing their nickname meanwhile', async () => {
    const { sessionId } = await hostedSession();
    const a = await newStudent();
    const me = await join(a, sessionId, 'Robin');
    await rpc(a, 'public.leave_session($1)', [sessionId]);
    expect((await lobby(teacher(host), sessionId)).participant_count).toBe(0);
    expect((await playerState(a, sessionId)).me.status).toBe('left');

    await join(await newStudent(), sessionId, 'Robin');
    expect(await errorMessage(join(a, sessionId, 'Robin'))).toMatch(/already uses that nickname/);
    const back = await join(a, sessionId, 'Robin 2');
    expect(back.id).toBe(me.id);
    expect((await lobby(teacher(host), sessionId)).participant_count).toBe(2);
  });
});

describe('host controls', () => {
  it('removes a player, who cannot rejoin from that device', async () => {
    const { sessionId } = await hostedSession();
    const a = await newStudent();
    const me = await join(a, sessionId, 'Mallory');
    await remove(teacher(host), sessionId, me.id);
    await remove(teacher(host), sessionId, me.id); // idempotent

    const view = await lobby(teacher(host), sessionId);
    expect(view.participant_count).toBe(0);
    expect(view.participants).toEqual([]);
    expect((await playerState(a, sessionId)).me.status).toBe('removed');
    expect(await errorMessage(join(a, sessionId, 'Mallory'))).toBe('The host removed you from this game.');
    // Their nickname is free for someone else.
    await join(await newStudent(), sessionId, 'Mallory');
  });

  it('only the host can lock, remove, cancel, or read the lobby', async () => {
    const { sessionId } = await hostedSession();
    const a = await newStudent();
    const me = await join(a, sessionId, 'Robin');
    for (const actor of [teacher(otherTeacher), a]) {
      expect(await errorMessage(lock(actor, sessionId, true))).toBe('Session not found.');
      expect(await errorMessage(remove(actor, sessionId, me.id))).toBe('Session not found.');
      expect(await errorMessage(rpc(actor, 'public.cancel_session($1)', [sessionId]))).toBe('Session not found.');
      expect(await errorMessage(lobby(actor, sessionId))).toBe('Session not found.');
      expect(await errorMessage(rpc(actor, 'public.create_presenter_link($1)', [sessionId]))).toBe('Session not found.');
    }
  });

  it('cancel ends the session for everyone', async () => {
    const { sessionId, pin } = await hostedSession();
    const a = await newStudent();
    await join(a, sessionId, 'Robin');
    await rpc(teacher(host), 'public.cancel_session($1)', [sessionId]);
    expect((await playerState(a, sessionId)).session.status).toBe('cancelled');
    expect((await lookup(await newStudent(), pin)).found).toBe(false);
    expect(await errorMessage(lock(teacher(host), sessionId, true))).toMatch(/already ended/);
  });
});

describe('table access', () => {
  it('hosts read their own sessions and rosters, without secrets; students read nothing', async () => {
    const { sessionId } = await hostedSession();
    const a = await newStudent();
    await join(a, sessionId, 'Robin');
    await rpc(teacher(host), 'public.create_presenter_link($1)', [sessionId]);

    await as(db, teacher(host), async (tx) => {
      expect((await tx.query('select id, pin from public.game_sessions')).rows).toHaveLength(1);
      expect((await tx.query('select nickname from public.participants')).rows).toHaveLength(1);
    });
    expect(
      await errorCode(as(db, teacher(host), (tx) => tx.query('select presenter_key_hash from public.game_sessions'))),
    ).toBe('42501');
    expect(await errorCode(as(db, teacher(host), (tx) => tx.query('select user_id from public.participants')))).toBe(
      '42501',
    );

    for (const actor of [teacher(otherTeacher), a]) {
      await as(db, actor, async (tx) => {
        expect((await tx.query('select id from public.game_sessions')).rows).toHaveLength(0);
        expect((await tx.query('select id from public.participants')).rows).toHaveLength(0);
      });
    }
    expect(await errorCode(as(db, a, (tx) => tx.query('select * from public.session_viewers')))).toBe('42501');
    expect(await errorCode(as(db, a, (tx) => tx.query('select * from public.pin_attempts')))).toBe('42501');
    expect(await errorCode(as(db, { kind: 'anon' }, (tx) => tx.query('select id from public.game_sessions')))).toBe(
      '42501',
    );
  });

  it('nobody can write the tables directly', async () => {
    const { sessionId } = await hostedSession();
    const a = await newStudent();
    await join(a, sessionId, 'Robin');
    expect(
      await errorCode(as(db, teacher(host), (tx) => tx.query('update public.game_sessions set is_locked = true'))),
    ).toBe('42501');
    expect(await errorCode(as(db, a, (tx) => tx.query(`update public.participants set nickname = 'Hacker'`)))).toBe(
      '42501',
    );
    expect(await errorCode(as(db, teacher(host), (tx) => tx.query('delete from public.participants')))).toBe('42501');
  });
});

describe('projector', () => {
  it('a presenter link lets another device view the lobby read-only', async () => {
    const { sessionId } = await hostedSession();
    const key = await rpc<string>(teacher(host), 'public.create_presenter_link($1)', [sessionId]);
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await lobby(teacher(host), sessionId)).has_presenter_link).toBe(true);

    const projector = await newStudent();
    expect(await errorMessage(lobby(projector, sessionId))).toBe('Session not found.');
    expect(await errorMessage(rpc(projector, 'public.claim_presenter($1, $2)', [sessionId, 'wrong']))).toMatch(
      /not valid any more/,
    );
    await rpc(projector, 'public.claim_presenter($1, $2)', [sessionId, key]);
    await rpc(projector, 'public.claim_presenter($1, $2)', [sessionId, key]); // idempotent
    expect((await lobby(projector, sessionId)).role).toBe('presenter');

    // No host power.
    expect(await errorMessage(lock(projector, sessionId, true))).toBe('Session not found.');

    // A new link disconnects old projectors.
    await rpc(teacher(host), 'public.create_presenter_link($1)', [sessionId]);
    expect(await errorMessage(lobby(projector, sessionId))).toBe('Session not found.');
    expect(await errorMessage(rpc(projector, 'public.claim_presenter($1, $2)', [sessionId, key]))).toMatch(
      /not valid any more/,
    );
  });
});

describe('realtime', () => {
  it('broadcasts joins, removals, locks and cancellation on the right topics', async () => {
    const { sessionId } = await hostedSession();
    const hostTopic = `session:${sessionId}:host`;
    const gameTopic = `session:${sessionId}:game`;
    const lobbyTopic = `session:${sessionId}:lobby`;

    const a = await newStudent();
    const me = await join(a, sessionId, 'Robin');
    await join(a, sessionId, 'Robin', AVATAR_2);
    await join(await newStudent(), sessionId, 'Kim'); // within 5 s: no second lobby count
    await lock(teacher(host), sessionId, true);
    await remove(teacher(host), sessionId, me.id);
    await rpc(teacher(host), 'public.cancel_session($1)', [sessionId]);

    const hostEvents = await broadcasts(db, hostTopic);
    expect(hostEvents.map((e) => e.event)).toEqual([
      'participant_joined',
      'participant_updated',
      'participant_joined',
      'session',
      'participant_removed',
      'session',
    ]);
    expect(hostEvents[0].payload).toMatchObject({ participant: { nickname: 'Robin' }, participant_count: 1 });
    expect(hostEvents[5].payload).toMatchObject({ status: 'cancelled' });

    const gameEvents = await broadcasts(db, gameTopic);
    expect(gameEvents.map((e) => e.event)).toEqual(['session', 'removed', 'session']);
    expect(gameEvents[1].payload).toEqual({ participant_id: me.id });
    // Nothing on the game topic reveals who is behind a participant.
    expect(JSON.stringify(gameEvents)).not.toContain((a as { id: string }).id);

    const lobbyEvents = await broadcasts(db, lobbyTopic);
    expect(lobbyEvents).toEqual([{ event: 'count', payload: { participant_count: 1 } }]);
  });

  it('authorises receiving by role and never allows sending', async () => {
    const { sessionId } = await hostedSession();
    const topics = {
      host: `session:${sessionId}:host`,
      game: `session:${sessionId}:game`,
      lobby: `session:${sessionId}:lobby`,
    };
    for (const topic of Object.values(topics)) {
      await db.query(
        `insert into realtime.messages (topic, extension, event, payload, private) values ($1, 'broadcast', 'seed', '{}', true)`,
        [topic],
      );
    }
    const player = await newStudent();
    await join(player, sessionId, 'Robin');
    const removed = await newStudent();
    const removedMe = await join(removed, sessionId, 'Gone');
    await remove(teacher(host), sessionId, removedMe.id);
    const projector = await newStudent();
    await rpc(projector, 'public.claim_presenter($1, $2)', [
      sessionId,
      await rpc<string>(teacher(host), 'public.create_presenter_link($1)', [sessionId]),
    ]);
    const stranger = await newStudent();

    const can = async (actor: Actor) => ({
      host: await canUseTopic(db, actor, topics.host),
      game: await canUseTopic(db, actor, topics.game),
      lobby: await canUseTopic(db, actor, topics.lobby),
    });
    expect(await can(teacher(host))).toEqual({ host: true, game: true, lobby: true });
    expect(await can(player)).toEqual({ host: false, game: true, lobby: true });
    expect(await can(projector)).toEqual({ host: true, game: true, lobby: false });
    expect(await can(removed)).toEqual({ host: false, game: false, lobby: false });
    expect(await can(stranger)).toEqual({ host: false, game: false, lobby: false });
    expect(await can(teacher(otherTeacher))).toEqual({ host: false, game: false, lobby: false });
    expect(await canUseTopic(db, teacher(host), `session:${sessionId}:other`)).toBe(false);
    expect(await canUseTopic(db, teacher(host), 'other-topic')).toBe(false);

    for (const actor of [teacher(host), player, projector]) {
      expect(await canUseTopic(db, actor, topics.game, 'send')).toBe(false);
    }
  });
});

describe('player state', () => {
  it('returns the session and the player, and refuses non-participants', async () => {
    const { sessionId } = await hostedSession();
    const a = await newStudent();
    await join(a, sessionId, 'Robin');
    const state = await playerState(a, sessionId);
    expect(state.session).toMatchObject({ id: sessionId, status: 'lobby', participant_count: 1, quiz_title: 'Planets' });
    expect(state.me).toMatchObject({ nickname: 'Robin', status: 'active' });
    // Players never see the PIN owner's identity or other players' details here.
    expect(Object.keys(state.session)).not.toContain('host_id');

    expect(await errorMessage(playerState(await newStudent(), sessionId))).toBe('You are not in this game.');
  });
});
