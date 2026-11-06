import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Radio } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/FormControls';
import { Alert } from '@/components/ui/Alert';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { createSession } from '@/services/sessions';
import { friendlyError } from '@/utils/errors';

const PLAYER_LIMITS = ['10', '20', '30', '50', '100'] as const;
type Limit = (typeof PLAYER_LIMITS)[number];

/** Opens a lobby for a published quiz and goes to the host screen. */
export function HostQuizDialog({
  quiz,
  onClose,
}: {
  quiz: { id: string; title: string; questionCount: number } | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [limit, setLimit] = useState<Limit>('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  const start = async () => {
    if (!quiz) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createSession(quiz.id, { maxParticipants: Number(limit) });
      navigate(`/teacher/sessions/${id}`);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={quiz !== null}
      onClose={close}
      dismissible={!busy}
      title="Host this quiz live"
      description={
        quiz ? (
          <>
            <strong className="text-ink-900">{quiz.title}</strong> · {quiz.questionCount}{' '}
            {quiz.questionCount === 1 ? 'question' : 'questions'}. Students join with a PIN or QR code, no accounts needed.
          </>
        ) : null
      }
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void start()} loading={busy} leftIcon={<Radio className="size-4" />} data-autofocus>
            Open lobby
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-label text-ink-900" id="player-limit-label">
            Player limit
          </p>
          <SegmentedControl
            label="Player limit"
            layoutId="player-limit"
            value={limit}
            onChange={setLimit}
            options={PLAYER_LIMITS.map((n) => ({ value: n, label: n }))}
          />
        </div>
        <div className="flex items-center gap-4">
          <ScoreBug tab="bg-signal-400" className="shrink-0">
            <span className="type-kicker">PIN</span>
            <span className="type-score text-score-md tracking-[0.12em] text-night-muted" aria-hidden>
              ––– –––
            </span>
          </ScoreBug>
          <p className="text-body-sm text-ink-500">A new PIN appears when the lobby opens. You can lock it at any time; unstarted lobbies close after 12 hours.</p>
        </div>
        {error && (
          <Alert tone="error" title="Could not open the lobby">
            {error}
          </Alert>
        )}
      </div>
    </Dialog>
  );
}
