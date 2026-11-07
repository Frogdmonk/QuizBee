import { Flag, ListOrdered, SkipForward, Square } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/Button';
import type { GameCommands } from '@/hooks/useGameCommands';

/**
 * The phase-appropriate teacher buttons: End question while a question runs, then Leaderboard and
 * Next question (or Final results) after the reveal. Same buttons on the host page and projector.
 */
export function GameCommandButtons({
  commands,
  size = 'sm',
  surface = 'night',
}: {
  commands: GameCommands;
  size?: ButtonProps['size'];
  surface?: 'night' | 'paper';
}) {
  const secondary: ButtonProps['variant'] = surface === 'night' ? 'night' : 'secondary';
  return (
    <>
      {commands.canEnd && (
        <Button size={size} variant={secondary} leftIcon={<Square className="size-4" />} loading={commands.busy} onClick={() => void commands.endQuestion()}>
          End question
        </Button>
      )}
      {commands.canBoard && (
        <Button size={size} variant={secondary} leftIcon={<ListOrdered className="size-4" />} loading={commands.busy} onClick={() => void commands.showBoard()}>
          Leaderboard
        </Button>
      )}
      {commands.canNext && (
        <Button
          size={size}
          variant="primary"
          leftIcon={commands.last ? <Flag className="size-4" /> : <SkipForward className="size-4" />}
          loading={commands.busy}
          onClick={() => void commands.next()}
        >
          {commands.nextLabel}
        </Button>
      )}
    </>
  );
}
