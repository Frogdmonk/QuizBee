import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Radio } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/FormControls';
import { Alert } from '@/components/ui/Alert';
import { createSession } from '@/services/sessions';
import { friendlyError } from '@/utils/errors';

const PLAYER_LIMITS = [10, 20, 30, 40, 50, 75, 100] as const;

/** Opens a lobby for a published quiz and goes to the host screen. */
export function HostQuizDialog({
  quiz,
  onClose,
}: {
  quiz: { id: string; title: string; questionCount: number } | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [limit, setLimit] = useState(100);
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
      const id = await createSession(quiz.id, { maxParticipants: limit });
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
            {quiz.questionCount === 1 ? 'question' : 'questions'}. Students join with a PIN or QR code, no accounts
            needed.
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
      <div className="space-y-4">
        <SelectField label="Player limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          {PLAYER_LIMITS.map((n) => (
            <option key={n} value={n}>
              Up to {n} players
            </option>
          ))}
        </SelectField>
        <p className="text-sm text-ink-500">
          You can lock the lobby at any time to stop new players joining. Unstarted lobbies close automatically after 12
          hours.
        </p>
        {error && (
          <Alert tone="error" title="Could not open the lobby">
            {error}
          </Alert>
        )}
      </div>
    </Dialog>
  );
}
