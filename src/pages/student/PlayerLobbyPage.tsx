import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { m } from 'motion/react';
import { Lock, LogOut, Palette, Users } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/avatar/Avatar';
import { AvatarBuilder } from '@/components/avatar/AvatarBuilder';
import { ConnectionPill } from '@/components/live/ConnectionPill';
import { useSessionChannel } from '@/hooks/useSessionChannel';
import { getPlayerClient } from '@/lib/supabase';
import { sessionTopic } from '@/lib/session-rules';
import { NICKNAME_MAX, cleanNickname, nicknameIssue } from '@/lib/nickname-rules';
import { getPlayerState, joinSession, leaveSession, savePlayerProfile } from '@/services/player';
import { toSessionUpdate } from '@/services/live';
import { friendlyError } from '@/utils/errors';
import type { PlayerState } from '@/types/session';

const GAME_EVENTS = ['session', 'removed'] as const;
const LOBBY_EVENTS = ['count'] as const;

/** Heartbeat every 10–15 s (jittered so 100 phones don't call at once). */
const heartbeatDelay = () => 10_000 + Math.random() * 5_000;

type Load = 'loading' | 'ready' | 'not_in_game' | 'error';

/** /game/:sessionId: the student's waiting room (game screens arrive in Phase 4). */
export default function PlayerLobbyPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<PlayerState | null>(null);
  const [load, setLoad] = useState<Load>('loading');
  const [editing, setEditing] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [rejoining, setRejoining] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const client = getPlayerClient();
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!sessionId || inFlight.current) return;
    inFlight.current = true;
    try {
      const { data } = await client.auth.getSession();
      if (!data.session) {
        setLoad('not_in_game');
        return;
      }
      setState(await getPlayerState(sessionId));
      setLoad('ready');
    } catch (error) {
      const code = (error as { code?: string }).code;
      setLoad((current) => (code === 'P0002' ? 'not_in_game' : current === 'ready' ? current : 'error'));
    } finally {
      inFlight.current = false;
    }
  }, [client, sessionId]);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      void refresh();
      timer = window.setTimeout(tick, heartbeatDelay());
    };
    tick();
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const active = state?.me.status === 'active' && (state.session.status === 'lobby' || state.session.status === 'in_progress');

  const gameStatus = useSessionChannel({
    client,
    topic: active && sessionId ? sessionTopic(sessionId, 'game') : null,
    events: GAME_EVENTS,
    onEvent: (event, payload) => {
      setState((s) => {
        if (!s) return s;
        if (event === 'removed') {
          const id = (payload as { participant_id?: string }).participant_id;
          return id === s.me.id ? { ...s, me: { ...s.me, status: 'removed' } } : s;
        }
        const u = toSessionUpdate(payload);
        if (u.stateVersion < s.session.stateVersion) return s;
        return {
          ...s,
          session: { ...s.session, status: u.status, phase: u.phase, isLocked: u.isLocked, stateVersion: u.stateVersion, participantCount: u.participantCount },
        };
      });
    },
    onSubscribed: () => void refresh(),
  });

  useSessionChannel({
    client,
    topic: active && sessionId ? sessionTopic(sessionId, 'lobby') : null,
    events: LOBBY_EVENTS,
    onEvent: (_event, payload) => {
      const count = Number((payload as { participant_count?: number }).participant_count);
      if (Number.isFinite(count)) setState((s) => (s ? { ...s, session: { ...s.session, participantCount: count } } : s));
    },
  });

  if (load === 'loading') {
    return (
      <Screen>
        <div className="grid flex-1 place-items-center">
          <Spinner className="size-8" label="Joining" />
        </div>
      </Screen>
    );
  }

  if (load === 'not_in_game' || (load === 'error' && !state) || !state || !sessionId) {
    return (
      <Screen>
        <Message
          title={load === 'error' ? 'Can’t reach the game' : 'You’re not in this game'}
          body={load === 'error' ? 'Check your internet connection. We’ll keep trying.' : 'Join with the PIN on the big screen.'}
          action={
            <ButtonLink to="/join" size="lg" fullWidth>
              Enter a PIN
            </ButtonLink>
          }
        />
      </Screen>
    );
  }

  const { session, me } = state;

  if (session.status === 'ended' || session.status === 'cancelled') {
    return (
      <Screen>
        <Message
          title="This game has ended"
          body="Thanks for playing! Your teacher closed the session."
          action={
            <ButtonLink to="/join" size="lg" fullWidth variant="secondary">
              Join another game
            </ButtonLink>
          }
        />
      </Screen>
    );
  }

  if (me.status === 'removed') {
    return (
      <Screen>
        <Message
          title="You were removed"
          body="The host removed you from this game. Ask your teacher if you think this was a mistake."
          action={
            <ButtonLink to="/join" size="lg" fullWidth variant="secondary">
              Join a different game
            </ButtonLink>
          }
        />
      </Screen>
    );
  }

  if (me.status === 'left') {
    const rejoin = async () => {
      setRejoining(true);
      setRejoinError(null);
      try {
        await joinSession(sessionId, me.nickname, me.avatar);
        await refresh();
      } catch (error) {
        setRejoinError(friendlyError(error));
      } finally {
        setRejoining(false);
      }
    };
    return (
      <Screen>
        <Message
          title="You left the game"
          body={rejoinError ?? `Want to go back to “${session.quizTitle}”?`}
          action={
            <div className="space-y-3">
              <Button size="lg" fullWidth loading={rejoining} onClick={() => void rejoin()}>
                Rejoin as {me.nickname}
              </Button>
              <ButtonLink to="/join" size="lg" fullWidth variant="ghost" className="text-white">
                Enter a different PIN
              </ButtonLink>
            </div>
          }
        />
      </Screen>
    );
  }

  const leave = async () => {
    setLeaving(true);
    try {
      await leaveSession(sessionId);
      navigate('/join', { replace: true });
    } catch (error) {
      setLeaving(false);
      setConfirmLeave(false);
      setRejoinError(friendlyError(error));
    }
  };

  return (
    <Screen status={<ConnectionPill status={gameStatus} dark />}>
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <p className="max-w-full truncate text-sm font-bold tracking-wide text-flame-300 uppercase">{session.quizTitle}</p>
        <m.div
          className="mt-6"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Avatar code={me.avatar} className="size-40 rounded-full ring-4 ring-white/10" title={`${me.nickname}'s avatar`} />
        </m.div>
        <h1 className="mt-5 max-w-full truncate text-4xl font-extrabold">{me.nickname}</h1>
        <p className="mt-3 text-xl font-bold text-mint-400">You’re in!</p>
        <p className="mt-1 text-white/70">Look for your name on the big screen. The game starts when your teacher is ready.</p>

        <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm font-semibold text-white/80" aria-live="polite">
          <Users className="size-4" /> {session.participantCount} {session.participantCount === 1 ? 'player' : 'players'} in the lobby
        </p>
        {session.isLocked && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-white/60">
            <Lock className="size-4" /> The lobby is locked. You’re still in.
          </p>
        )}
        {session.status === 'in_progress' && (
          <p className="mt-4 text-sm text-white/60">The game has started. Game screens arrive in Phase 4.</p>
        )}
        {rejoinError && (
          <p role="alert" className="mt-4 text-sm font-semibold text-rose-300">
            {rejoinError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 pb-2">
        <Button variant="secondary" size="lg" leftIcon={<Palette className="size-5" />} onClick={() => setEditing(true)}>
          Change look
        </Button>
        <Button variant="ghost" size="lg" className="text-white hover:bg-white/10" leftIcon={<LogOut className="size-5" />} onClick={() => setConfirmLeave(true)}>
          Leave
        </Button>
      </div>

      <EditProfileDialog
        open={editing}
        sessionId={sessionId}
        nickname={me.nickname}
        avatar={me.avatar}
        onClose={() => setEditing(false)}
        onSaved={(next) => {
          setState((s) => (s ? { ...s, me: { ...s.me, nickname: next.nickname, avatar: next.avatar } } : s));
          setEditing(false);
        }}
      />
      <ConfirmDialog
        open={confirmLeave}
        title="Leave this game?"
        description="You can rejoin with the same PIN while the lobby is open."
        confirmLabel="Leave game"
        tone="danger"
        busy={leaving}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => void leave()}
      />
    </Screen>
  );
}

function EditProfileDialog({
  open,
  sessionId,
  nickname: initialNickname,
  avatar: initialAvatar,
  onClose,
  onSaved,
}: {
  open: boolean;
  sessionId: string;
  nickname: string;
  avatar: string;
  onClose: () => void;
  onSaved: (profile: { nickname: string; avatar: string }) => void;
}) {
  const [nickname, setNickname] = useState(initialNickname);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the form each time the dialog opens.
  const [openedFor, setOpenedFor] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setNickname(initialNickname);
      setAvatar(initialAvatar);
      setError(null);
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const issue = nicknameIssue(nickname);
    if (issue) {
      setError(issue);
      return;
    }
    setSaving(true);
    try {
      const clean = cleanNickname(nickname);
      const me = await joinSession(sessionId, clean, avatar);
      savePlayerProfile({ nickname: me.nickname, avatar: me.avatar });
      onSaved({ nickname: me.nickname, avatar: me.avatar });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Change your look"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-player" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-player" onSubmit={(e) => void save(e)} className="space-y-4" noValidate>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-800">Nickname</span>
          <input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError(null);
            }}
            maxLength={NICKNAME_MAX + 8}
            className="h-12 w-full rounded-xl border border-ink-200 px-3 text-lg font-bold outline-none focus:border-flame-400 focus:ring-4 focus:ring-flame-100"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-600">
            {error}
          </p>
        )}
        <AvatarBuilder value={avatar} onChange={setAvatar} />
      </form>
    </Dialog>
  );
}

function Screen({ children, status }: { children: ReactNode; status?: ReactNode }) {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col bg-night-900 px-5 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col py-5">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Home">
            <Logo inverted />
          </Link>
          {status}
        </div>
        {children}
      </div>
    </main>
  );
}

function Message({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-10 text-center">
      <div>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="mt-3 text-white/70">{body}</p>
      </div>
      {action}
    </div>
  );
}
