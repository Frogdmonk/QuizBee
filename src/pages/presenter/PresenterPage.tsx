import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { Lock, Maximize, Minimize, Play, WifiOff } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';
import { NightCanvas } from '@/components/ui/NightCanvas';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { PinDigits } from '@/components/ui/PinDigits';
import { CountRoll } from '@/components/ui/CountRoll';
import { BreathingLine } from '@/components/ui/BreathingLine';
import { LowerThird } from '@/components/ui/LowerThird';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Playground } from '@/components/lobby/Playground';
import { ReactionsToggle } from '@/components/reactions/ReactionsToggle';
import { useReactions } from '@/hooks/useReactions';
import { QrCode } from '@/components/live/QrCode';
import { ConnectionPill } from '@/components/live/ConnectionPill';
import { useJoinTicker } from '@/components/live/useJoinTicker';
import { PresenterGame } from '@/components/game/PresenterGame';
import { useGameState, type GameController } from '@/hooks/useGameState';
import { useStartGame } from '@/hooks/useGameCommands';
import { useLobby } from '@/hooks/useLobby';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { getPlayerClient, getTeacherClient, type AppSupabaseClient } from '@/lib/supabase';
import { joinHost, joinUrl } from '@/lib/session-rules';
import { dur, ease, slideFromLeft } from '@/lib/motion';
import { claimPresenter } from '@/services/live';
import { ensurePlayerSession } from '@/services/player';
import { friendlyError } from '@/utils/errors';

type Access = { kind: 'pending' } | { kind: 'ready'; client: AppSupabaseClient } | { kind: 'needs_link' } | { kind: 'error'; message: string };

function readKeyFromHash(): string | null {
  const match = /(?:^#|&)key=([^&]+)/.exec(window.location.hash);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Classroom screen. Read-only. Uses the teacher's session on the host's own
 * computer, or an anonymous identity that claimed a projector link on any
 * other device (the key arrives in the URL fragment and is removed at once).
 */
export default function PresenterPage() {
  const { sessionId } = useParams();
  const { state: teacher } = useTeacherAuth();
  const [access, setAccess] = useState<Access>({ kind: 'pending' });

  useEffect(() => {
    if (!sessionId || teacher.status === 'loading') return;
    let cancelled = false;
    const key = readKeyFromHash();

    void (async () => {
      try {
        if (key) {
          await ensurePlayerSession();
          await claimPresenter(getPlayerClient(), sessionId, key);
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          if (!cancelled) setAccess({ kind: 'ready', client: getPlayerClient() });
          return;
        }
        if (teacher.status === 'signed_in') {
          setAccess({ kind: 'ready', client: getTeacherClient() });
          return;
        }
        const { data } = await getPlayerClient().auth.getSession();
        if (!cancelled) setAccess(data.session ? { kind: 'ready', client: getPlayerClient() } : { kind: 'needs_link' });
      } catch (error) {
        if (!cancelled) setAccess({ kind: 'error', message: friendlyError(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, teacher.status]);

  const { lobby, load, channel } = useLobby(access.kind === 'ready' ? access.client : null, sessionId);
  const ticker = useJoinTicker(lobby?.participants);
  // Warm in the lobby: clock offset and game state are ready before the game starts.
  const game = useGameState(access.kind === 'ready' ? access.client : null, sessionId, { listenHost: true });
  const { reactions } = useReactions(access.kind === 'ready' ? access.client : null, sessionId, game.offset);

  if (access.kind === 'needs_link' || access.kind === 'error' || load === 'not_found' || (load === 'error' && !lobby)) {
    const message =
      access.kind === 'error'
        ? access.message
        : load === 'error'
          ? 'Check the internet connection, then reload.'
          : 'Open the projector view from the host screen, or use a projector link created there.';
    return (
      <Shell>
        <div className="flex flex-1 items-center">
          <StatusBlock surface="night" tone="warning" icon={<WifiOff />} title="Can’t show this session">
            {message}
          </StatusBlock>
        </div>
      </Shell>
    );
  }

  if (!lobby) {
    return (
      <Shell>
        <div className="grid flex-1 place-items-center text-night-muted">
          <Spinner className="size-10" label="Connecting to the session" />
        </div>
      </Shell>
    );
  }

  if ((lobby.status === 'in_progress' || lobby.phase === 'podium') && access.kind === 'ready' && sessionId) {
    return (
      <Shell title={lobby.quizTitle} right={<ConnectionPill status={channel} quiet surface="night" />}>
        <PresenterGame client={access.client} sessionId={sessionId} game={game} />
      </Shell>
    );
  }

  const isOpen = lobby.status === 'lobby' || lobby.status === 'in_progress';
  if (!isOpen) {
    return (
      <Shell title={lobby.quizTitle}>
        <div className="flex flex-1 flex-col justify-center">
          <p className="type-kicker text-stage-label">Session closed</p>
          <h2 className="type-display mt-3 text-stage-title">This session has ended</h2>
        </div>
      </Shell>
    );
  }

  const empty = lobby.participants.length === 0;

  return (
    <Shell title={lobby.quizTitle} right={<ConnectionPill status={channel} quiet surface="night" />}>
      <div className="grid min-h-0 flex-1 gap-8 py-[3vh] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-14 [@media(max-aspect-ratio:4/3)]:grid-cols-1 [@media(max-aspect-ratio:4/3)]:grid-rows-[auto_minmax(0,1fr)]">
        {/* Join panel */}
        <section
          aria-label="How to join"
          className="flex min-w-0 flex-col justify-center gap-[3vh] [@media(max-aspect-ratio:4/3)]:flex-row [@media(max-aspect-ratio:4/3)]:items-center [@media(max-aspect-ratio:4/3)]:justify-between"
        >
          <div className="@container min-w-0 [@media(max-aspect-ratio:4/3)]:flex-1">
            <p className="type-kicker text-stage-label">Join at</p>
            <p className="mt-2 truncate text-stage-url text-night-text">{joinHost()}/join</p>
            <p className="type-kicker mt-[3vh] text-stage-label">Game PIN</p>
            <PinDigits
              value={lobby.pin}
              size="stage"
              reveal
              label={`Game PIN ${lobby.pin}`}
              className="mt-2 text-[min(17vh,22cqw)] text-night-text [@media(max-aspect-ratio:4/3)]:text-[min(12vh,22cqw)]"
            />
            {empty && <BreathingLine className="mt-5 w-40" />}
          </div>
          <div className="flex items-center gap-5">
            <QrCode
              value={joinUrl(lobby.pin)}
              label={`QR code to join with PIN ${lobby.pin}`}
              className="size-[24vh] max-h-56 min-h-32 min-w-32 rounded-sm p-2 [@media(max-aspect-ratio:4/3)]:size-[18vh]"
            />
            <p className="text-stage-name text-night-muted">Scan to join</p>
          </div>
          {lobby.role === 'host' && lobby.status === 'lobby' && access.kind === 'ready' && sessionId && (
            <ProjectorStart client={access.client} sessionId={sessionId} stateVersion={lobby.stateVersion} playerCount={lobby.participantCount} game={game} />
          )}
          {lobby.role === 'host' && access.kind === 'ready' && sessionId && game.state && (
            <div className="flex flex-wrap items-center gap-3">
              <ReactionsToggle client={access.client} sessionId={sessionId} enabled={game.state.session.reactionsEnabled} onChanged={game.refresh} />
              <span className="text-caption text-night-muted">Players can send emotes from their phones while they wait.</span>
            </div>
          )}
          <AnimatePresence>
            {lobby.isLocked && (
              <m.p
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur.slow, ease: [...ease.wipe] }}
                className="inline-flex origin-left items-center gap-3 self-start rounded-sm bg-night-text px-5 py-3 text-stage-label text-night-950 uppercase"
              >
                <Lock className="size-[1.1em]" /> Locked · no new players
              </m.p>
            )}
          </AnimatePresence>
        </section>

        {/* The crowd */}
        <section aria-labelledby="presenter-players" className="relative flex min-h-0 min-w-0 flex-col">
          <h2 id="presenter-players" className="sr-only">
            Players
          </h2>
          <ScoreBug tab="bg-signal-400" className="self-start py-3 pr-5">
            <span className="type-stage text-score-xl">
              <CountRoll value={lobby.participantCount} />
            </span>
            <span className="text-stage-label text-night-muted uppercase">{lobby.participantCount === 1 ? 'Player' : 'Players'}</span>
          </ScoreBug>

          {empty ? (
            <div className="flex flex-1 flex-col justify-center py-10">
              <p className="type-display text-stage-title">Grab your phone</p>
              <p className="mt-3 text-stage-name text-night-muted">The PIN is on the left. Your avatar appears here when you join.</p>
            </div>
          ) : (
            <Playground
              seed={lobby.id}
              players={lobby.participants}
              offsetMs={game.offset}
              reactions={reactions}
              variant="stage"
              label="Players"
              className="mt-4 min-h-0 flex-1 rounded-lg border border-night-rule bg-[radial-gradient(ellipse_at_50%_110%,rgb(255_255_255/0.06),transparent_60%)]"
            />
          )}

          <div aria-live="polite" className="pointer-events-none absolute bottom-0 left-0">
            <AnimatePresence>
              {ticker && (
                <m.div key={ticker} variants={slideFromLeft} initial="hidden" animate="show" exit="exit">
                  <LowerThird surface="night" tab="bg-signal-400" className="text-stage-label uppercase">
                    {ticker}
                  </LowerThird>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </Shell>
  );
}

/** Start button for the teacher's own projector view. A projector-link device never sees it. */
function ProjectorStart({
  client,
  sessionId,
  stateVersion,
  playerCount,
  game,
}: {
  client: AppSupabaseClient;
  sessionId: string;
  stateVersion: number;
  playerCount: number;
  game: GameController;
}) {
  const { starting, start } = useStartGame(client, sessionId, stateVersion, game.refresh);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button size="xl" variant="primary" leftIcon={<Play className="size-5" />} disabled={playerCount === 0} loading={starting} onClick={() => void start()}>
        Start game
      </Button>
      <p className="text-stage-name text-night-muted">{playerCount === 0 ? 'Waiting for the first player' : `${playerCount} ready`}</p>
    </div>
  );
}

function Shell({ children, title, right }: { children: ReactNode; title?: string; right?: ReactNode }) {
  return (
    <NightCanvas className="flex h-dvh min-h-0 flex-col overflow-hidden px-[4vw]">
      <header className="flex items-start justify-between gap-6 pt-[3vh]">
        <ScoreBug tab="bg-signal-600" className="max-w-[70%] py-3 pr-5">
          <LogoMark tone="night" className="size-10" />
          {title ? (
            <h1 className="type-display line-clamp-2 text-[clamp(1.5rem,3.6vh,2.75rem)] leading-tight">{title}</h1>
          ) : (
            <span className="type-headline text-[1.5rem]">Rally</span>
          )}
        </ScoreBug>
        <div className="flex items-center gap-2">
          {right}
          <FullscreenButton />
        </div>
      </header>
      {children}
    </NightCanvas>
  );
}

function FullscreenButton() {
  const [full, setFull] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null;
  return (
    <button
      type="button"
      onClick={() => void (full ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
      className="grid size-11 place-items-center rounded-sm border border-night-line text-night-muted transition-colors hover:bg-night-900 hover:text-night-text"
      aria-label={full ? 'Exit full screen' : 'Full screen'}
    >
      {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
    </button>
  );
}
