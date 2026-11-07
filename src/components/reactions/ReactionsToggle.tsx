import { useState } from 'react';
import { SmilePlus, SmileIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ButtonVariant } from '@/components/ui/button-styles';
import { useToast } from '@/hooks/useToast';
import type { AppSupabaseClient } from '@/lib/supabase';
import { setReactionsEnabled } from '@/services/reactions';
import { friendlyError } from '@/utils/errors';

/** Teacher switch for student reactions. The change reaches every screen in the next state broadcast. */
export function ReactionsToggle({
  client,
  sessionId,
  enabled,
  onChanged,
  variant = 'night-ghost',
  size = 'sm',
}: {
  client: AppSupabaseClient;
  sessionId: string;
  enabled: boolean;
  onChanged?: () => void | Promise<void>;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  async function toggle() {
    setBusy(true);
    try {
      await setReactionsEnabled(client, sessionId, !enabled);
      await onChanged?.();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not change reactions', description: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      variant={variant}
      size={size}
      loading={busy}
      aria-pressed={enabled}
      leftIcon={enabled ? <SmilePlus className="size-4" /> : <SmileIcon className="size-4 opacity-50" />}
      onClick={() => void toggle()}
    >
      {enabled ? 'Reactions on' : 'Reactions off'}
    </Button>
  );
}
