import { useState } from 'react';
import { useParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { ArrowLeft, Check, Copy, ExternalLink, LogOut, MonitorUp, QrCode as QrIcon, UserMinus, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { SegmentedControl, Switch } from '@/components/ui/FormControls';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { SectionHead } from '@/components/ui/SectionHead';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { PinDigits } from '@/components/ui/PinDigits';
import { CountRoll } from '@/components/ui/CountRoll';
import { BreathingLine } from '@/components/ui/BreathingLine';
import { Placeholder } from '@/components/ui/Placeholder';
import { LowerThird } from '@/components/ui/LowerThird';
import { Avatar } from '@/components/avatar/Avatar';
import { QrCode } from '@/components/live/QrCode';
import { ConnectionPill } from '@/components/live/ConnectionPill';
import { useLobby } from '@/hooks/useLobby';
import { useToast } from '@/hooks/useToast';
import { getTeacherClient } from '@/lib/supabase';
import { joinHost, joinUrl, presenterUrl } from '@/lib/session-rules';
import { popIn, slideFromLeft } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { cancelSession, createPresenterLink, removeParticipant, setSessionLocked } from '@/services/sessions';
import { copyText } from '@/utils/clipboard';
import { friendlyError } from '@/utils/errors';
import type { LobbyParticipant } from '@/types/session';

export default function HostLobbyPage() {
  const { sessionId } = useParams();
  const { toast } = useToast();
  const { lobby, setLobby, load, channel } = useLobby(getTeacherClient(), sessionId);
  const [selected, setSelected] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<LobbyParticipant | null>(null);
  const [removing, setRemoving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [projectorLink, setProjectorLink] = useState<string | null>(null);
  const [confirmRelink, setConfirmRelink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [joinSheet, setJoinSheet] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (load === 'loading') {
    return (
      <div className="grid min-h-[50vh] place-items-center text-ink-500">
        <Spinner className="size-6" label="Loading the lobby" />
      </div>
    );
  }
  if (load === 'not_found' || (load === 'error' && !lobby)) {
    return (
      <div className="max-w-lg space-y-4 py-10">
        <Alert tone="error" title={load === 'not_found' ? 'Session not found' : 'Could not load the lobby'}>
          {load === 'not_found'
            ? 'It may have been closed, or it belongs to another teacher.'
            : 'Check your connection and reload the page.'}
        </Alert>
        <ButtonLink to="/teacher/sessions" variant="secondary" leftIcon={<ArrowLeft className="size-4" />}>
          Live sessions
        </ButtonLink>
      </div>
    );
  }
  if (!lobby || !sessionId) return null;

  const isOpen = lobby.status === 'lobby' || lobby.status === 'in_progress';
  const link = joinUrl(lobby.pin);
  const selectedPlayer = lobby.participants.find((p) => p.id === selected) ?? null;

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
      setSelected(null);
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
    if (ok) {
      setCopied(what);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600);
    } else {
      toast({ tone: 'error', title: 'Copy failed', description: text });
    }
  };

  const copyButton = (text: string, what: string, variant: 'night' | 'secondary' = 'night') => (
    <Button
      variant={variant}
      size="sm"
      leftIcon={copied === what ? <Check className="size-4" /> : <Copy className="size-4" />}
      onClick={() => void copy(text, what)}
    >
      {copied === what ? 'Copied' : 'Copy link'}
    </Button>
  );

  const projectorControls = (
    <div className="space-y-3">
      <p className="text-label text-ink-900">Projector on another device</p>
      <p className="text-body-sm text-ink-500">For a classroom computer that isn’t signed in. The link only shows the screen; it can’t control the game.</p>
      <Button
        variant="secondary"
        size="sm"
        loading={linking}
        leftIcon={<MonitorUp className="size-4" />}
        onClick={() => (lobby.hasPresenterLink ? setConfirmRelink(true) : void makeProjectorLink())}
      >
        {lobby.hasPresenterLink ? 'New projector link' : 'Create projector link'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <ButtonLink to="/teacher/sessions" variant="ghost" size="sm" leftIcon={<ArrowLeft className="size-4" />} className="-ml-3">
          Live sessions
        </ButtonLink>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="type-display min-w-0 text-display-lg">{lobby.quizTitle}</h1>
          {isOpen ? (
            <Badge tone="signal" dot>
              Lobby open
            </Badge>
          ) : (
            <Badge>Closed</Badge>
          )}
        </div>
        <p className="text-body-sm text-ink-500">
          {lobby.questionCount} {lobby.questionCount === 1 ? 'question' : 'questions'} · up to {lobby.maxParticipants} players
        </p>
      </header>

      {!isOpen && (
        <Alert tone="info" title="This session is closed">
          Players can no longer join. Host the quiz again from Live sessions to get a new PIN.
        </Alert>
      )}

      {isOpen && (
        <section
          aria-label="Lobby controls"
          className="ground-night sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 flex flex-wrap items-center gap-x-6 gap-y-3 bg-night-950 px-4 py-3 text-night-text sm:mx-0 sm:rounded-md sm:px-5 lg:top-4"
        >
          <button
            type="button"
            onClick={() => void copy(link, 'pin')}
            className="group flex items-center gap-3 rounded-sm text-left"
            aria-label={`Game PIN ${lobby.pin}. Copy the join link`}
          >
            <ScoreBug tab="bg-signal-400" className="py-1.5">
              <PinDigits value={lobby.pin} size="bar" reveal className="text-night-text" />
            </ScoreBug>
            <span className="hidden text-caption text-night-muted group-hover:text-night-text sm:block">
              {copied === 'pin' ? (
                <span className="inline-flex items-center gap-1 text-success-400">
                  <Check className="size-3.5" /> Link copied
                </span>
              ) : (
                <>
                  {joinHost()}/join
                  <br />
                  Tap to copy link
                </>
              )}
            </span>
          </button>

          <p className="type-score text-score-xl" aria-label={`${lobby.participantCount} of ${lobby.maxParticipants} players`}>
            <CountRoll value={lobby.participantCount} />
            <span className="text-score-md text-night-muted">/{lobby.maxParticipants}</span>
          </p>

          <div className="hidden w-48 md:block">
            <SegmentedControl
              label="Lobby access"
              layoutId="lobby-lock"
              tone="night"
              value={lobby.isLocked ? 'locked' : 'open'}
              onChange={(v) => !locking && void toggleLock(v === 'locked')}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'locked', label: 'Locked' },
              ]}
            />
          </div>
          <div className="md:hidden">
            <Switch tone="night" checked={lobby.isLocked} onChange={(v) => void toggleLock(v)} disabled={locking} label="Lock" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ConnectionPill status={channel} quiet surface="night" />
            <Button variant="night" size="sm" className="md:hidden" leftIcon={<QrIcon className="size-4" />} onClick={() => setJoinSheet(true)}>
              Join details
            </Button>
            <ButtonLink
              to={`/presenter/${sessionId}`}
              target="_blank"
              rel="noopener"
              variant="night"
              size="sm"
              className="hidden md:inline-flex"
              leftIcon={<ExternalLink className="size-4" />}
            >
              Open projector view
            </ButtonLink>
          </div>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <section aria-labelledby="players-heading" className="min-w-0">
          <SectionHead
            id="players-heading"
            kicker="Players"
            action={<span className="type-score text-score-md">{lobby.participantCount}</span>}
          />
          {lobby.participants.length === 0 ? (
            <div className="py-16">
              <BreathingLine tone="paper" />
              <p className="mt-4 text-title">{isOpen ? 'Waiting for the first player' : 'No players'}</p>
              {isOpen && <p className="mt-1 text-body-sm text-ink-500">Share the PIN above, or open the projector view for the class.</p>}
            </div>
          ) : (
            <>
              <p className="mt-3 text-caption text-ink-500">{isOpen ? 'Select a player to remove them.' : ''}</p>
              <ul className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]">
                <AnimatePresence initial={false}>
                  {lobby.participants.map((p) => {
                    const isSelected = selected === p.id;
                    return (
                      <m.li key={p.id} variants={popIn} initial="hidden" animate="show" exit="exit" className="min-w-0">
                        <button
                          type="button"
                          disabled={!isOpen}
                          aria-pressed={isSelected}
                          onClick={() => setSelected(isSelected ? null : p.id)}
                          className={cn(
                            'flex w-full flex-col items-center gap-1.5 rounded-sm p-1.5 text-center transition-colors duration-[var(--dur-fast)]',
                            isOpen && 'hover:bg-paper-sunk',
                            isSelected && 'bg-paper-sunk ring-2 ring-ink-900',
                          )}
                        >
                          <Avatar code={p.avatar} className="size-14 rounded-full ring-1 ring-line sm:size-16" />
                          <span className="w-full truncate text-caption font-semibold text-ink-900">{p.nickname}</span>
                        </button>
                      </m.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </>
          )}
        </section>

        <aside className="min-w-0 space-y-8">
          {isOpen && (
            <section aria-label="Join with QR code" className="hidden md:block">
              <SectionHead kicker="Scan to join" />
              <div className="mt-4 flex items-end gap-4">
                <QrCode value={link} label={`QR code to join with PIN ${lobby.pin}`} className="w-[200px] rounded-sm border border-line p-2" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-body-sm text-ink-500">{joinHost()}/join</span>
                {copyButton(link, 'link', 'secondary')}
              </div>
            </section>
          )}
          {isOpen && (
            <Placeholder>Starting the game, questions and scores arrive with live games. Players can join and wait now.</Placeholder>
          )}
          {isOpen && <section className="hidden md:block">{projectorControls}</section>}
          {isOpen && (
            <section aria-labelledby="end-heading">
              <SectionHead id="end-heading" kicker="End session" />
              <p className="mt-3 text-body-sm text-ink-500">Every player is told the session ended and the PIN stops working.</p>
              <Button variant="danger-outline" size="sm" className="mt-3" leftIcon={<LogOut className="size-4" />} onClick={() => setConfirmClose(true)}>
                Close lobby
              </Button>
            </section>
          )}
        </aside>
      </div>

      {/* Contextual action for the selected player */}
      <AnimatePresence>
        {selectedPlayer && isOpen && (
          <m.div
            variants={slideFromLeft}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-x-4 bottom-[calc(var(--tabbar-h,0px)+1rem)] z-30 flex justify-center lg:bottom-6"
          >
            <LowerThird surface="night" tab="bg-error-300" className="gap-3 pr-2 shadow-pop">
              <span className="truncate">{selectedPlayer.nickname}</span>
              <Button variant="night" size="sm" leftIcon={<UserMinus className="size-4" />} onClick={() => setToRemove(selectedPlayer)}>
                Remove
              </Button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Clear selection"
                className="grid size-10 place-items-center rounded-sm text-night-muted hover:text-night-text"
              >
                <X className="size-4" />
              </button>
            </LowerThird>
          </m.div>
        )}
      </AnimatePresence>

      <Dialog open={joinSheet} onClose={() => setJoinSheet(false)} title="Join details">
        <div className="space-y-5">
          <div className="flex justify-center">
            <QrCode value={link} label={`QR code to join with PIN ${lobby.pin}`} className="w-56 rounded-sm border border-line p-2" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-body-sm text-ink-500">{joinHost()}/join</span>
            {copyButton(link, 'link', 'secondary')}
          </div>
          <ButtonLink to={`/presenter/${sessionId}`} target="_blank" rel="noopener" variant="dark" fullWidth leftIcon={<ExternalLink className="size-4" />}>
            Open projector view
          </ButtonLink>
          <div className="border-t border-line pt-5">{projectorControls}</div>
        </div>
      </Dialog>

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
        description="Open this on the classroom computer. Anyone with the link can watch this session’s screen, so don’t share it with students."
        footer={
          <>
            <Button variant="secondary" onClick={() => setProjectorLink(null)}>
              Done
            </Button>
            <Button
              leftIcon={copied === 'projector' ? <Check className="size-4" /> : <Copy className="size-4" />}
              onClick={() => projectorLink && void copy(projectorLink, 'projector')}
              data-autofocus
            >
              {copied === 'projector' ? 'Copied' : 'Copy link'}
            </Button>
          </>
        }
      >
        <ScoreBug tab="bg-signal-400" className="w-full">
          <span className="min-w-0 font-mono text-caption break-all text-night-text">{projectorLink}</span>
        </ScoreBug>
        <p className="mt-3 text-body-sm text-ink-500">This link is shown only once. Create a new one any time.</p>
      </Dialog>
    </div>
  );
}
