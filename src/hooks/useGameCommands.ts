import { useCallback, useState } from 'react';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { GameController } from '@/hooks/useGameState';
import { useToast } from '@/hooks/useToast';
import { closeQuestion, endGame, nextQuestion, showLeaderboard, startGame } from '@/services/game';
import { friendlyError } from '@/utils/errors';

/**
 * The teacher's game commands, shared by the host page and the projector (when the projector is
 * the teacher's own signed-in view). Every command carries the state version it was issued
 * against, so a double click, a held key or a second tab can never skip a question: the server
 * treats a stale command as a no-op.
 */
export function useGameCommands(client: AppSupabaseClient, sessionId: string, game: GameController) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const state = game.state;
  const phase = state?.session.phase ?? null;
  const version = state?.session.stateVersion ?? null;
  const last = Boolean(state && state.session.currentPosition !== null && state.session.currentPosition + 1 >= state.session.questionCount);

  const run = useCallback(
    async (action: () => Promise<unknown>, failTitle: string) => {
      setBusy(true);
      try {
        await action();
        await game.refresh();
      } catch (error) {
        toast({ tone: 'error', title: failTitle, description: friendlyError(error) });
      } finally {
        setBusy(false);
      }
    },
    [game, toast],
  );

  const endQuestion = useCallback(() => run(() => closeQuestion(client, sessionId, version), 'Could not end the question'), [run, client, sessionId, version]);
  const showBoard = useCallback(() => run(() => showLeaderboard(client, sessionId, version), 'Could not show the leaderboard'), [run, client, sessionId, version]);
  const next = useCallback(() => run(() => nextQuestion(client, sessionId, version), 'Could not continue'), [run, client, sessionId, version]);
  const finish = useCallback(() => run(() => endGame(client, sessionId), 'Could not end the game'), [run, client, sessionId]);

  const canEnd = phase === 'question';
  const canBoard = phase === 'reveal';
  const canNext = phase === 'reveal' || phase === 'leaderboard';

  return {
    busy,
    canEnd,
    canBoard,
    canNext,
    nextLabel: last ? 'Final results' : 'Next question',
    last,
    endQuestion,
    showBoard,
    next,
    finish,
    /** What Space / → does: reveal → leaderboard → next question. Never ends a running question. */
    primary: canBoard ? showBoard : canNext ? next : null,
  };
}

export type GameCommands = ReturnType<typeof useGameCommands>;

/** Starts the game from the lobby (host only). */
export function useStartGame(client: AppSupabaseClient, sessionId: string, stateVersion: number | null, onStarted: () => Promise<unknown> | void) {
  const { toast } = useToast();
  const [starting, setStarting] = useState(false);
  const start = useCallback(async () => {
    setStarting(true);
    try {
      await startGame(client, sessionId, stateVersion);
      await onStarted();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not start the game', description: friendlyError(error) });
    } finally {
      setStarting(false);
    }
  }, [client, sessionId, stateVersion, onStarted, toast]);
  return { starting, start };
}
