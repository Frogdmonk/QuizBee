import { useState } from 'react';
import { Switch } from '@/components/ui/FormControls';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { setLearningSettings, type LearningSettingsInput } from '@/services/sessions';
import { friendlyError } from '@/utils/errors';
import type { AppSupabaseClient } from '@/lib/supabase';

/** The mastery check, in the teacher's lobby. */
export function LearningSettings({
  client,
  sessionId,
  enabled,
  masteryPct,
  reviewMs,
  onChanged,
}: {
  client: AppSupabaseClient;
  sessionId: string;
  enabled: boolean;
  masteryPct: number;
  reviewMs: number;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(String(masteryPct));
  const [review, setReview] = useState(String(reviewMs / 1000));
  const [error, setError] = useState<string | null>(null);

  const save = async (input: LearningSettingsInput) => {
    setBusy(true);
    try {
      await setLearningSettings(client, sessionId, input);
      onChanged();
    } catch (e) {
      toast({ tone: 'error', title: 'Learning settings not saved', description: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const p = Number(pct);
    const r = Number(review);
    if (!Number.isInteger(p) || p < 50 || p > 100) return setError('The mastery bar must be a whole number from 50 to 100.');
    if (!Number.isInteger(r) || r < 3 || r > 20) return setError('The review time must be a whole number from 3 to 20 seconds.');
    setError(null);
    void save({ masteryPct: p, reviewSeconds: r });
  };
  const changed = pct !== String(masteryPct) || review !== String(reviewMs / 1000);

  return (
    <div className="space-y-3">
      <Switch
        checked={enabled}
        disabled={busy}
        onChange={(masteryEnabled) => void save({ masteryEnabled })}
        label="Mastery check"
        description={`When fewer than ${masteryPct}% of the class get a question right and it has a recovery question, the class reviews the most common mix-up and tries a new question on the same idea. You can skip it during the game.`}
      />
      {enabled && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <TextField label="Mastery bar (%)" type="number" inputMode="numeric" min={50} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className="w-36" />
          <TextField label="Review (seconds)" type="number" inputMode="numeric" min={3} max={20} value={review} onChange={(e) => setReview(e.target.value)} className="w-36" />
          <Button type="submit" variant="secondary" size="md" loading={busy} disabled={!changed}>
            Save
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-body-sm font-semibold text-error-600">
          {error}
        </p>
      )}
    </div>
  );
}
