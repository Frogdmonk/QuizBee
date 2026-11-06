import { useState } from 'react';
import { useParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { ArrowLeft, Copy, ExternalLink, Lock, MonitorUp, Rocket, Users, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/FormControls';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/avatar/Avatar';
import { QrCode } from '@/components/live/QrCode';
import { ConnectionPill } from '@/components/live/ConnectionPill';
import { useLobby } from '@/hooks/useLobby';
import { useToast } from '@/hooks/useToast';
import { getTeacherClient } from '@/lib/supabase';
import { formatPin, joinHost, joinUrl, presenterUrl } from '@/lib/session-rules';
import { cancelSession, createPresenterLink, removeParticipant, setSessionLocked } from '@/services/sessions';
import { copyText } from '@/utils/clipboard';
import { friendlyError } from '@/utils/errors';
import type { LobbyParticipant } from '@/types/session';

export default function HostLobbyPage() {
  const { sessionId } = useParams();
  const { toast } = useToast();
  const { lobby, setLobby, load, channel } = useLobby(getTeacherClient(), sessionId);
  const [toRemove, setToRemove] = useState<LobbyParticipant | null>(null);
  const [removing, setRemoving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [projectorLink, setProjectorLink] = useState<string | null>(null);
  const [confirmRelink, setConfirmRelink] = useState(false);
  const [linking, setLinking] = useState(false);

  if (load === 'loading') {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="size-6" label="Loading the lobby" />
      </div>
    );
  }
  if (load === 'not_found' || (load === 'error' && !lobby)) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10">
        <Alert tone="error" title={load === 'not_found' ? 'Session not found' : 'Could not load the lobby'}>
          {load === 'not_found'
            ? 'It may have been closed, or it belongs to another teacher.'
            : 'Check your connection and reload the page.'}
        </Alert>
        <ButtonLink to="/teacher/sessions" variant="secondary" leftIcon={<ArrowLeft className="size-4" />}>
          Live Sessions
        </ButtonLink>
      </div>
    );
  }
  if (!lobby || !sessionId) return null;

  const isOpen = lobby.status === 'lobby' || lobby.status === 'in_progress';
  const link = joinUrl(lobby.pin);

  const toggleLock = async (locked: boolean) => {
    setLocking(true);
    try {
      const value = await setSessionLocked(sessionId, locked);
      setLobby((l) => (l ? { ...l, isLocked: value } : l));
      toast({ tone: 'success', title: value ? 'Lobby locked' : 'Lobby unlocked', description: value ? 'New players cannot join.' : undefined });
    } catch (error) {
      toast({ tone: 'error', title: 'Could not change the lock', description: friendlyError(error) });
    } finally {
      setLocking(false);
    }
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await removeParticipant(sessionId, toRemove.id);
      setLobby((l) =>
        l
          ? {
              ...l,
              participants: l.participants.filter((p) => p.id !== toRemove.id),
              participantCount: Math.max(0, l.participantCount - (l.participants.some((p) => p.id === toRemove.id) ? 1 : 0)),
            }
          : l,
      );
      toast({ tone: 'success', title: `${toRemove.nickname} removed` });
      setToRemove(null);
    } catch (error) {
      toast({ tone: 'error', title: 'Could not remove the player', description: friendlyError(error) });
    } finally {
      setRemoving(false);
    }
  };

  const closeLobby = async () => {
    setClosing(true);
    try {
      await cancelSession(sessionId);
      setLobby((l) => (l ? { ...l, status: 'cancelled' } : l));
      setConfirmClose(false);
      toast({ tone: 'success', title: 'Lobby closed', description: 'Players have been told the session ended.' });
    } catch (error) {
      toast({ tone: 'error', title: 'Could not close the lobby', description: friendlyError(error) });
    } finally {
      setClosing(false);
    }
  };

  const makeProjectorLink = async () => {
    setLinking(true);
    try {
      const key = await createPresenterLink(sessionId);
      setLobby((l) => (l ? { ...l, hasPresenterLink: true } : l));
      setConfirmRelink(false);
      setProjectorLink(presenterUrl(sessionId, key));
    } catch (error) {
      toast({ tone: 'error', title: 'Could not create a projector link', description: friendlyError(error) });
    } finally {
      setLinking(false);
    }
  };

  const copy = async (text: string, what: string) => {
    const ok = await copyText(text);
    toast(ok ? { tone: 'success', title: `${what} copied` } : { tone: 'error', title: 'Copy failed', description: text });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <ButtonLink to="/teacher/sessions" variant="ghost" size="sm" leftIcon={<ArrowLeft className="size-4" />} className="-ml-2">
            Live Sessions
          </ButtonLink>
          <h1 className="mt-1 truncate text-2xl font-extrabold sm:text-3xl">{lobby.quizTitle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isOpen ? <Badge tone="mint">Lobby open</Badge> : <Badge>Closed</Badge>}
            {lobby.isLocked && isOpen && (
              <Badge tone="sun">
                <Lock className="size-3" /> Locked
              </Badge>
            )}
            <span className="text-sm text-ink-500">
              {lobby.questionCount} {lobby.questionCount === 1 ? 'question' : 'questions'}
            </span>
            {isOpen && <ConnectionPill status={channel} />}
          </div>
        </div>
        {isOpen && (
          <ButtonLink
            to={`/presenter/${sessionId}`}
            target="_blank"
            rel="noopener"
            variant="dark"
            leftIcon={<ExternalLink className="size-4" />}
          >
            Open projector view
          </ButtonLink>
        )}
      </header>

      {!isOpen && (
        <Alert tone="info" title="This session is closed">
          Players can no longer join. Host the quiz again from Live Sessions to get a new PIN.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-4">
          {isOpen && (
            <section aria-label="How to join" className="rounded-3xl bg-night-900 p-5 text-white shadow-lift">
              <p className="text-sm text-white/70">
                Join at <span className="font-bold text-white">{joinHost()}/join</span>
              </p>
              <p className="mt-1 text-xs font-bold tracking-widest text-white/50 uppercase">Game PIN</p>
              <p className="font-display text-5xl font-extrabold tracking-wider tabular">{formatPin(lobby.pin)}</p>
              <div className="mt-4 flex items-end gap-4">
                <QrCode value={link} label={`QR code to join with PIN ${lobby.pin}`} className="w-36 rounded-xl p-1.5" />
                <Button variant="secondary" size="sm" leftIcon={<Copy className="size-4" />} onClick={() => void copy(link, 'Join link')}>
                  Copy link
                </Button>
              </div>
            </section>
          )}

          {isOpen && (
            <section aria-label="Lobby controls" className="space-y-4 rounded-2xl border border-ink-100 bg-surface p-5 shadow-card">
              <Switch
                checked={lobby.isLocked}
                onChange={(v) => void toggleLock(v)}
                disabled={locking}
                label="Lock lobby"
                description="Stops new players joining. Players already in stay."
              />
              <div className="border-t border-ink-100 pt-4">
                <p className="text-sm font-semibold text-ink-800">Projector on another device</p>
                <p className="mt-0.5 text-sm text-ink-500">
                  For a classroom PC that is not signed in. The link only shows the screen; it cannot control the game.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  loading={linking}
                  leftIcon={<MonitorUp className="size-4" />}
                  onClick={() => (lobby.hasPresenterLink ? setConfirmRelink(true) : void makeProjectorLink())}
                >
                  {lobby.hasPresenterLink ? 'New projector link' : 'Create projector link'}
                </Button>
              </div>
              <div className="border-t border-ink-100 pt-4">
                <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => setConfirmClose(true)}>
                  Close lobby
                </Button>
              </div>
            </section>
          )}

          {isOpen && (
            <section className="flex gap-3 rounded-2xl border border-dashed border-ink-200 p-4 text-sm text-ink-600">
              <Rocket className="mt-0.5 size-5 shrink-0 text-flame-500" />
              <p>
                <strong className="text-ink-800">Starting the game comes in the next build (Phase 4).</strong> For now
                students can join, pick their avatars and wait here, so you can try the lobby with your class.
              </p>
            </section>
          )}
        </div>

        <section aria-labelledby="players-heading" className="min-w-0 rounded-2xl border border-ink-100 bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 id="players-heading" className="flex items-center gap-2 text-lg font-extrabold">
              <Users className="size-5 text-ink-400" /> Players
            </h2>
            <span className="font-display text-lg font-extrabold tabular" aria-live="polite">
              {lobby.participantCount}
              <span className="text-ink-400">/{lobby.maxParticipants}</span>
            </span>
          </div>

          {lobby.participants.length === 0 ? (
            <div className="grid place-items-center px-4 py-16 text-center">
              <span className="relative grid size-14 place-items-center rounded-full bg-mint-50">
                <span className="absolute inset-0 animate-ping rounded-full bg-mint-400/25" />
                <Users className="size-6 text-mint-600" />
              </span>
              <p className="mt-4 font-bold">{isOpen ? 'Waiting for players…' : 'No players'}</p>
              {isOpen && <p className="mt-1 text-sm text-ink-500">Students join on their phones with the PIN or QR code.</p>}
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
              <AnimatePresence initial={false}>
                {lobby.participants.map((p) => (
                  <m.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    className="group relative flex flex-col items-center gap-2 rounded-2xl bg-paper p-3 text-center"
                  >
                    <Avatar code={p.avatar} className="size-16 rounded-full" />
                    <span className="w-full truncate text-sm font-bold">{p.nickname}</span>
                    {isOpen && (
                      <button
                        type="button"
                        onClick={() => setToRemove(p)}
                        aria-label={`Remove ${p.nickname}`}
                        className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-surface text-ink-500 shadow-card transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={toRemove !== null}
        title={`Remove ${toRemove?.nickname ?? 'this player'}?`}
        description="They leave the lobby and cannot rejoin this session from the same device. Lock the lobby too if they keep coming back."
        confirmLabel="Remove player"
        tone="danger"
        busy={removing}
        onCancel={() => setToRemove(null)}
        onConfirm={() => void confirmRemove()}
      />
      <ConfirmDialog
        open={confirmClose}
        title="Close this lobby?"
        description="Every player is told the session has ended and the PIN stops working. This cannot be undone."
        confirmLabel="Close lobby"
        tone="danger"
        busy={closing}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => void closeLobby()}
      />
      <ConfirmDialog
        open={confirmRelink}
        title="Create a new projector link?"
        description="The previous link stops working and any projector using it is disconnected."
        confirmLabel="Create new link"
        busy={linking}
        onCancel={() => setConfirmRelink(false)}
        onConfirm={() => void makeProjectorLink()}
      />
      <Dialog
        open={projectorLink !== null}
        onClose={() => setProjectorLink(null)}
        title="Projector link"
        description="Open this on the classroom computer. Anyone with the link can watch this session's screen, so don't share it with students."
        footer={
          <>
            <Button variant="secondary" onClick={() => setProjectorLink(null)}>
              Done
            </Button>
            <Button leftIcon={<Copy className="size-4" />} onClick={() => projectorLink && void copy(projectorLink, 'Projector link')} data-autofocus>
              Copy link
            </Button>
          </>
        }
      >
        <p className="rounded-xl bg-ink-50 p-3 font-mono text-xs break-all text-ink-700">{projectorLink}</p>
        <p className="mt-3 text-sm text-ink-500">This link is shown only once. Create a new one any time.</p>
      </Dialog>
    </div>
  );
}

