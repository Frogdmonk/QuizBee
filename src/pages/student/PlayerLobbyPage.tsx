import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { m } from 'motion/react';
import { Lock, LogOut, Palette, WifiOff } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { NightCanvas } from '@/components/ui/NightCanvas';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { LowerThird } from '@/components/ui/LowerThird';
import { CountRoll } from '@/components/ui/CountRoll';
import { BreathingLine } from '@/components/ui/BreathingLine';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { Avatar } from '@/components/avatar/Avatar';
import { AvatarBuilder } from '@/components/avatar/AvatarBuilder';
import { AvatarHero } from '@/components/avatar/AvatarHero';
import { ConnectionPill } from '@/components/live/ConnectionPill';
import { useSessionChannel } from '@/hooks/useSessionChannel';
import { getPlayerClient } from '@/lib/supabase';
import { sessionTopic } from '@/lib/session-rules';
import { NICKNAME_MAX, cleanNickname, nicknameIssue } from '@/lib/nickname-rules';
import { dur, ease, spring } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { getPlayerState, joinSession, leaveSession, savePlayerProfile } from '@/services/player';
import { toSessionUpdate } from '@/services/live';
import { friendlyError } from '@/utils/errors';
import type { PlayerState } from '@/types/session';

const GAME_EVENTS = ['session', 'removed'] as const;
const LOBBY_EVENTS = ['count'] as const;

/** Heartbeat every 10–15 s (jittered so 100 phones don't call at once). */
const heartbeatDelay = () => 10_000 + Math.random() * 5_000;

type Load = 'loading' | 'ready' | 'not_in_game' | 'error';

/** "YOU'RE IN" plays once per session on this device (pure read; the flag is written in an effect). */
const arrivalKey = (sessionId: string) => `rally.arrived.${sessionId}`;
function firstArrival(sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  try {
    return !sessionStorage.getItem(arrivalKey(sessionId));
  } catch {
    return false;
  }
}

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
  const [celebrate] = useState(() => firstArrival(sessionId));
  const client = getPlayerClient();
  const inFlight = useRef(false);
  const arrived = load === 'ready' && state?.me.status === 'active';

  useEffect(() => {
    if (!arrived || !sessionId) return;
    try {
      sessionStorage.setItem(arrivalKey(sessionId), '1');
    } catch {
      // Storage unavailable: the celebration may simply play again.
    }
  }, [arrived, sessionId]);

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
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center" role="status" aria-label="Joining">
          <span aria-hidden className="block size-40 rounded-full bg-night-800" />
          <p className="text-body text-night-muted">Joining the game…</p>
          <BreathingLine />
        </div>
      </Screen>
    );
  }

  if (load === 'error' && !state) {
    return (
      <Screen>
        <div className="flex flex-1 items-center">
          <StatusBlock
            surface="night"
            tone="warning"
            icon={<WifiOff />}
            title="Can’t reach the game"
            actions={
              <Button variant="night" size="lg" onClick={() => void refresh()}>
                Try again
              </Button>
            }
          >
            Check your internet connection. We’ll keep trying in the background.
          </StatusBlock>
        </div>
      </Screen>
    );
  }

  if (load === 'not_in_game' || !state || !sessionId) {
    return (
      <Screen>
        <Message
          title="You’re not in this game"
          body="Join with the PIN on the big screen."
          action={
            <ButtonLink to="/join" size="xl" variant="night" fullWidth>
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
          avatar={me.avatar}
          title="This game has ended"
          body="Thanks for playing. Your teacher closed the session."
          action={
            <ButtonLink to="/join" size="xl" variant="night" fullWidth>
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
          avatar={me.avatar}
          muted
          title="You’re out of this game"
          body="The host removed you. Ask your teacher if you think this was a mistake."
          action={
            <ButtonLink to="/join" size="xl" variant="night" fullWidth>
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
          avatar={me.avatar}
          muted
          title="You left the game"
          body={rejoinError ?? `Want to go back to “${session.quizTitle}”?`}
          action={
            <div className="space-y-3">
              <Button size="xl" variant="night" fullWidth loading={rejoining} onClick={() => void rejoin()}>
                Rejoin as {me.nickname}
              </Button>
              <ButtonLink to="/join" size="lg" fullWidth variant="night-ghost">
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
    <Screen
      bug={
        <ScoreBug className="w-full pr-1" tab="bg-signal-400">
          <span className="min-w-0 flex-1 truncate text-body-sm font-semibold">{session.quizTitle}</span>
          <span className="type-score shrink-0 text-score-md">
            <CountRoll value={session.participantCount} />
            <span className="ml-1 font-sans text-caption font-bold tracking-[0.08em] text-night-muted">IN</span>
          </span>
          <ConnectionPill status={gameStatus} quiet surface="night" />
        </ScoreBug>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <m.div
          initial={celebrate ? { y: 24, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={spring.land}
        >
          <m.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut', delay: celebrate ? 1.6 : 0.4 }}
          >
            <Avatar code={me.avatar} ring="own" className="size-44 sm:size-60" title={`${me.nickname}'s avatar`} />
          </m.div>
        </m.div>

        <div className="relative mt-6 inline-grid px-4 py-1">
          {celebrate && (
            <m.span
              aria-hidden
              className="absolute inset-0 origin-left bg-volt-400"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.35, duration: dur.slow, ease: [...ease.wipe] }}
            />
          )}
          <h1 className={cn('type-display relative text-display-xl', celebrate ? 'text-night-950' : 'text-night-text')}>YOU’RE IN</h1>
        </div>

        <m.div
          className="mt-5 max-w-full"
          initial={celebrate ? { x: -24, opacity: 0 } : false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: celebrate ? 0.75 : 0, duration: dur.base, ease: [...ease.out] }}
        >
          <LowerThird surface="night" tab="bg-volt-400">
            <span className="truncate text-[1.25rem] font-bold">{me.nickname}</span>
          </LowerThird>
        </m.div>

        <p className="mt-6 text-body text-night-muted">
          {session.status === 'in_progress' ? 'Get ready — the game is starting.' : 'Look for your name on the big screen.'}
        </p>
        <BreathingLine className="mt-4" />
        {session.isLocked && (
          <p className="mt-5 inline-flex items-center gap-2 text-body-sm text-night-muted">
            <Lock className="size-4" /> The lobby is locked. You’re still in.
          </p>
        )}
        {rejoinError && (
          <p role="alert" className="mt-4 text-body-sm font-semibold text-error-300">
            {rejoinError}
          </p>
        )}

        <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
          <Button variant="night" size="lg" leftIcon={<Palette className="size-5" />} onClick={() => setEditing(true)}>
            Change look
          </Button>
          <Button variant="night-ghost" size="lg" leftIcon={<LogOut className="size-5" />} onClick={() => setConfirmLeave(true)}>
            Leave
          </Button>
        </div>
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
        surface="night"
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
      tone="night"
      size="lg"
      title="Change your look"
      footer={
        <>
          <Button variant="night-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-player" variant="night" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-player" onSubmit={(e) => void save(e)} className="space-y-6" noValidate>
        <AvatarHero value={avatar} onChange={setAvatar} nickname={nickname} size={128} />
        <TextField
          tone="night"
          label="Nickname"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setError(null);
          }}
          maxLength={NICKNAME_MAX + 8}
          labelAside={<span className="tabular">{[...cleanNickname(nickname)].length}/{NICKNAME_MAX}</span>}
          error={error ?? undefined}
        />
        <AvatarBuilder value={avatar} onChange={setAvatar} />
      </form>
    </Dialog>
  );
}

function Screen({ children, bug }: { children: ReactNode; bug?: ReactNode }) {
  return (
    <NightCanvas className="flex flex-col px-5">
      <div className="mx-auto flex w-full max-w-[35rem] flex-1 flex-col py-4">
        <div className="flex items-center gap-3">
          <LogoMark tone="night" className="size-9" />
          {bug && <div className="min-w-0 flex-1">{bug}</div>}
        </div>
        {children}
      </div>
    </NightCanvas>
  );
}

function Message({
  title,
  body,
  action,
  avatar,
  muted = false,
}: {
  title: string;
  body: string;
  action: ReactNode;
  avatar?: string;
  muted?: boolean;
}) {
  return (
    <m.div
      className="flex flex-1 flex-col justify-center gap-6 py-10"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base }}
    >
      {avatar && <Avatar code={avatar} className={cn('size-28 rounded-full', muted && 'opacity-70 grayscale')} />}
      <div>
        <h1 className="type-display text-display-lg">{title}</h1>
        <p className="mt-3 text-body text-night-muted">{body}</p>
      </div>
      {action}
    </m.div>
  );
}
