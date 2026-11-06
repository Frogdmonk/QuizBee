import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { Lock, Maximize, Minimize, Users } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/avatar/Avatar';
import { QrCode } from '@/components/live/QrCode';
import { ConnectionPill } from '@/components/live/ConnectionPill';
import { useLobby } from '@/hooks/useLobby';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { getPlayerClient, getTeacherClient, type AppSupabaseClient } from '@/lib/supabase';
import { formatPin, joinHost, joinUrl } from '@/lib/session-rules';
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

  if (access.kind === 'needs_link' || access.kind === 'error' || load === 'not_found' || (load === 'error' && !lobby)) {
    const message =
      access.kind === 'error'
        ? access.message
        : 'Open the projector view from the host screen, or use a projector link created there.';
    return (
      <Shell>
        <div className="mx-auto max-w-lg py-24 text-center">
          <h1 className="text-3xl font-extrabold">Can’t show this session</h1>
          <p className="mt-3 text-lg text-white/70">{load === 'error' ? 'Check the internet connection, then reload.' : message}</p>
        </div>
      </Shell>
    );
  }

  if (!lobby) {
    return (
      <Shell>
        <div className="grid flex-1 place-items-center">
          <Spinner className="size-8" label="Connecting to the session" />
        </div>
      </Shell>
    );
  }

  const isOpen = lobby.status === 'lobby' || lobby.status === 'in_progress';
  if (!isOpen) {
    return (
      <Shell>
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="text-lg font-bold text-white/60">{lobby.quizTitle}</p>
            <h1 className="mt-2 text-5xl font-extrabold">This session has ended</h1>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={lobby.quizTitle} right={<ConnectionPill status={channel} dark />}>
      <div className="grid flex-1 gap-8 py-6 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] xl:gap-12">
        <section aria-label="How to join" className="flex flex-col gap-6">
          <div className="rounded-3xl bg-white/6 p-6 ring-1 ring-white/10">
            <p className="text-xl text-white/70 xl:text-2xl">
              Join at <span className="font-extrabold text-white">{joinHost()}/join</span>
            </p>
            <p className="mt-4 text-sm font-bold tracking-[0.3em] text-white/50 uppercase">Game PIN</p>
            <p className="font-display text-[clamp(3rem,4.6vw,6.5rem)] leading-none font-extrabold tracking-wider whitespace-nowrap tabular">
              {formatPin(lobby.pin)}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <QrCode value={joinUrl(lobby.pin)} label={`QR code to join with PIN ${lobby.pin}`} className="w-44 rounded-2xl p-2 xl:w-56" />
            <p className="text-lg text-white/70">Scan to join with the PIN filled in.</p>
          </div>
          <AnimatePresence>
            {lobby.isLocked && (
              <m.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-2 self-start rounded-full bg-sun-400 px-4 py-2 text-lg font-extrabold text-night-900"
              >
                <Lock className="size-5" /> Lobby locked
              </m.p>
            )}
          </AnimatePresence>
        </section>

        <section aria-labelledby="presenter-players" className="flex min-w-0 flex-col">
          <div className="flex items-end justify-between gap-4">
            <h2 id="presenter-players" className="flex items-center gap-3 text-2xl font-extrabold xl:text-3xl">
              <Users className="size-7 text-white/50" /> Players
            </h2>
            <m.span
              key={lobby.participantCount}
              initial={{ scale: 1.25 }}
              animate={{ scale: 1 }}
              className="font-display text-5xl font-extrabold tabular"
              aria-live="polite"
            >
              {lobby.participantCount}
            </m.span>
          </div>

          {lobby.participants.length === 0 ? (
            <div className="grid flex-1 place-items-center py-16 text-center">
              <div>
                <p className="animate-pulse text-3xl font-extrabold text-white/80">Waiting for players…</p>
                <p className="mt-3 text-lg text-white/50">Their avatars appear here as they join.</p>
              </div>
            </div>
          ) : (
            <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] content-start gap-3">
              <AnimatePresence initial={false}>
                {lobby.participants.map((p) => (
                  <m.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.4, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
                    transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-white/6 p-3 text-center"
                  >
                    <Avatar code={p.avatar} className="size-[4.5rem] rounded-full" />
                    <span className="w-full truncate text-base font-bold">{p.nickname}</span>
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          {lobby.status === 'in_progress' && (
            <p className="mt-6 text-lg text-white/60">The game screens for the projector arrive in Phase 4.</p>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children, title, right }: { children: ReactNode; title?: string; right?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-night-950 px-6 text-white xl:px-10">
      <header className="flex items-center justify-between gap-4 pt-5">
        <div className="flex min-w-0 items-center gap-4">
          <Logo inverted />
          {title && <p className="truncate text-lg font-bold text-white/70">{title}</p>}
        </div>
        <div className="flex items-center gap-3">
          {right}
          <FullscreenButton />
        </div>
      </header>
      {children}
    </main>
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
      className="grid size-10 place-items-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white"
      aria-label={full ? 'Exit full screen' : 'Full screen'}
    >
      {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
    </button>
  );
}
