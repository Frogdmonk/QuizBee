import { useEffect, useState } from 'react';
import { Archive, Copy, Pencil, RotateCcw, Rocket, Undo2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/FormControls';
import { Alert } from '@/components/ui/Alert';
import { getQuizActivity } from '@/services/sharing';
import { ACTIVITY_LABELS } from '@/lib/workspace-rules';
import { relativeTime } from '@/utils/time';
import { friendlyError } from '@/utils/errors';
import type { QuizActivityAction, QuizActivityEntry } from '@/types/workspace';

const ICONS: Record<QuizActivityAction, typeof Pencil> = {
  edited: Pencil,
  published: Rocket,
  unpublished: Undo2,
  archived: Archive,
  restored: RotateCcw,
  copied: Copy,
};

const ACTION_TONES: Record<QuizActivityAction, string> = {
  edited: 'bg-paper-sunk text-ink-700',
  published: 'bg-success-50 text-success-600',
  unpublished: 'bg-warning-50 text-warning-700',
  archived: 'bg-ink-900 text-white',
  restored: 'bg-info-50 text-info-700',
  copied: 'bg-signal-50 text-signal-700',
};

/** Who edited, published or copied a quiz (owner and editors), on a timeline rail. */
export function QuizActivityDialog({ open, quizId, onClose }: { open: boolean; quizId: string | null; onClose: () => void }) {
  const [entries, setEntries] = useState<QuizActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the dialog opens for a quiz.
  const openKey = open && quizId ? quizId : null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    setEntries(null);
    setError(null);
  }

  useEffect(() => {
    if (!open || !quizId) return;
    let cancelled = false;
    getQuizActivity(quizId)
      .then((list) => !cancelled && setEntries(list))
      .catch((e) => !cancelled && setError(friendlyError(e)));
    return () => {
      cancelled = true;
    };
  }, [open, quizId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Quiz activity"
      description="Recent edits, status changes and copies by you and the teachers you share with."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {error ? (
        <Alert tone="error" title="Could not load activity">
          {error}
        </Alert>
      ) : entries === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading activity">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-body-sm text-ink-500">No activity yet.</p>
      ) : (
        <ol className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-line">
          {entries.map((entry, i) => {
            const Icon = ICONS[entry.action];
            return (
              <li key={`${entry.createdAt}-${i}`} className="relative flex items-start gap-3 py-2">
                <span className={`grid size-8 shrink-0 place-items-center rounded-sm ${ACTION_TONES[entry.action]}`}>
                  <Icon className="size-4" />
                </span>
                <p className="min-w-0 pt-1 text-body-sm">
                  <span className="font-semibold">{entry.isMe ? 'You' : entry.actorName}</span> {ACTIVITY_LABELS[entry.action]}
                  <span className="block text-caption text-ink-500">{relativeTime(entry.createdAt)}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Dialog>
  );
}
