import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BATTLE_CONFIG, toBattle, toGameState, type RawState } from '@/services/game';
import { abilityStatus } from '@/lib/battle/powerups';
import { EnergyMeter, PhoneDraft, PhonePowerup, TeamAbilities } from '@/components/battle/Powerups';
import { BattleArena } from '@/components/battle/BattleArena';
import { QuestionStage } from '@/components/game/QuestionStage';
import { ToastProvider } from '@/contexts/ToastProvider';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { BattleAttack, BattleState, GameQuestion, GameState, MyPowerup } from '@/types/game';

vi.mock('@/services/battle', () => ({
  choosePowerup: vi.fn(async () => ({ status: 'chosen' })),
  activatePowerup: vi.fn(async () => ({ status: 'used', hint: 'This question tests: X.' })),
  activateTeamAbility: vi.fn(async () => 9),
}));
import { activatePowerup, activateTeamAbility, choosePowerup } from '@/services/battle';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const client = {} as AppSupabaseClient;
const offered = [
  { key: 'thunder_strike', name: 'Thunder Strike', description: 'Your correct answer hits twice as hard.' },
  { key: 'revival', name: 'Revival Crystal', description: 'Change your answer once.' },
  { key: 'xray', name: 'X-Ray Vision', description: 'Shows a hint.' },
];
const powerup = (over: Partial<MyPowerup> = {}): MyPowerup => ({ state: 'offered', offered, chosen: null, draftQuestionId: 'q3', armedQuestionId: null, hint: null, ...over });
const battle = (over: Partial<BattleState> = {}): BattleState => ({
  enabled: true, monster: 'gloomjaw', hpSetting: null, baseDamage: 3, maxHp: 1000, hp: 600, config: DEFAULT_BATTLE_CONFIG, current: null,
  energy: 45, armed: { shield: null, lightning: null, rally: null, scan: null }, draftPosition: null, weapon: null, vote: null, last: null, ...over,
});
const gameState = (phase: string, open: boolean, b: BattleState) =>
  ({ session: { id: 's', phase, status: 'in_progress', currentPosition: 2, questionCount: 5 }, question: { id: 'q3', status: open ? 'open' : 'closed' }, battle: b }) as unknown as GameState;

describe('power-ups and energy from the server', () => {
  it('parses energy, armed abilities, the draft and my power-up', () => {
    const b = toBattle({
      enabled: true, monster: 'gloomjaw', hp_setting: null, base_damage: 3, max_hp: 1000, hp: 600, energy: 70,
      armed: { shield: 3, lightning: null, rally: null, scan: 3 }, draft_position: 2,
      current: { question_id: 'q', mode: 'rage', target_pct: 60, target_count: 3, announce: null, draft: true, hidden_option_id: 'o2', time_warp_s: 5, powerups_used: 2, topic: 'Fractions' },
      last: {
        question_id: 'q', position: 1, eligible: 4, correct: 3, accuracy: 75, attackers: [], damage: 9, hp_before: 609, hp_after: 600,
        energy_gain: 25, energy_reasons: ['mastery', 'defended', 'participation'], shielded: false, lightning: 0, rally: false, scan: false, boosted: 1,
      },
    })!;
    expect(b).toMatchObject({ energy: 70, armed: { shield: 3, scan: 3 }, draftPosition: 2, current: { draft: true, hiddenOptionId: 'o2', timeWarpS: 5, topic: 'Fractions' } });
    expect(b.last).toMatchObject({ energyGain: 25, energyReasons: ['mastery', 'defended', 'participation'], boosted: 1 });
    const s = toGameState({
      role: 'player', server_now: 'x',
      session: { id: 's', quiz_title: 'T', pin: null, status: 'in_progress', phase: 'question', state_version: 1, question_count: 3, current_position: 2, is_locked: false, participant_count: 3, speed_scoring: true },
      question: null, leaderboard: [], ranked_count: 0, leaderboard_version: null,
      me: {
        participant_id: 'p', nickname: 'N', avatar: '000000000', status: 'active', answer_option_id: null, last_correct: null, last_points: null, score: 0, rank: null, previous_rank: null, streak: 0, correct_count: 0,
        powerup: { state: 'held', offered, chosen: 'xray', draft_question_id: 'q3', armed_question_id: null, hint: null },
      },
    } as unknown as RawState);
    expect(s.me!.powerup).toMatchObject({ state: 'held', chosen: 'xray', draftQuestionId: 'q3' });
  });

  it('team abilities: energy, timing and one-per-question rules mirror the server', () => {
    expect(abilityStatus(gameState('question', true, battle({ energy: 20 })), battle({ energy: 20 }), 'team_shield')).toMatchObject({ can: false, reason: 'Needs 30 energy.' });
    expect(abilityStatus(gameState('question', true, battle()), battle(), 'team_shield')).toMatchObject({ can: true, reason: 'Applies to this question.' });
    expect(abilityStatus(gameState('leaderboard', false, battle()), battle(), 'knowledge_reveal')).toMatchObject({ can: false, reason: 'Only while a question is running.' });
    const shielded = battle({ armed: { shield: 2, lightning: null, rally: null, scan: null } });
    expect(abilityStatus(gameState('question', true, shielded), shielded, 'team_shield')).toMatchObject({ can: false });
    const rich = battle({ energy: 90 });
    expect(abilityStatus(gameState('question', true, rich), rich, 'final_rally')).toMatchObject({ can: false, reason: 'Final challenge only.' });
    const final = battle({ energy: 90, draftPosition: 2 });
    expect(abilityStatus(gameState('question', true, final), final, 'final_rally')).toMatchObject({ can: true });
  });
});

describe('power-up screens', () => {
  it('the draft: tap one of three; once chosen it is shown, not choosable again', async () => {
    const onChanged = vi.fn();
    const { rerender } = render(<PhoneDraft client={client} sessionId="s" powerup={powerup()} onChanged={onChanged} />);
    expect(screen.getAllByRole('button', { name: /Choose / })).toHaveLength(3);
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Choose Revival Crystal' })));
    expect(choosePowerup).toHaveBeenCalledWith(client, 's', 'revival');
    expect(onChanged).toHaveBeenCalled();
    rerender(<PhoneDraft client={client} sessionId="s" powerup={powerup({ state: 'held', chosen: 'revival' })} onChanged={onChanged} />);
    expect(screen.getByText('Power-up ready!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Choose / })).not.toBeInTheDocument();
  });

  it('using a power-up: Revival waits until I have answered; X-Ray shows its hint', async () => {
    const q = { id: 'q3' } as GameQuestion;
    const { rerender } = render(<PhonePowerup client={client} sessionId="s" powerup={powerup({ state: 'held', chosen: 'revival' })} question={q} answered={false} onChanged={() => {}} />);
    expect(screen.getByRole('button', { name: 'Use' })).toBeDisabled();
    rerender(<PhonePowerup client={client} sessionId="s" powerup={powerup({ state: 'held', chosen: 'xray' })} question={q} answered={false} onChanged={() => {}} />);
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Use' })));
    expect(activatePowerup).toHaveBeenCalledWith(client, 's');
    rerender(<PhonePowerup client={client} sessionId="s" powerup={powerup({ state: 'used', chosen: 'xray', armedQuestionId: 'q3', hint: 'This question tests: X.' })} question={q} answered={false} onChanged={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('This question tests: X.');
    rerender(<PhonePowerup client={client} sessionId="s" powerup={powerup({ state: 'used', chosen: 'xray', armedQuestionId: 'q1' })} question={q} answered={false} onChanged={() => {}} />);
    expect(screen.queryByText('X-Ray Vision')).not.toBeInTheDocument(); // used earlier: nothing to show
  });

  it('the energy meter and the teacher’s team abilities', async () => {
    render(<EnergyMeter energy={45} />);
    expect(screen.getByRole('meter', { name: 'Team energy' })).toHaveAttribute('aria-valuenow', '45');
    const b = battle();
    render(<TeamAbilities client={client} state={gameState('question', true, b)} battle={b} onChanged={() => {}} />, { wrapper: ToastProvider });
    expect(screen.getByRole('button', { name: /Group Lightning/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Final Rally/ })).toBeDisabled();
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: /Team Shield/ })));
    expect(activateTeamAbility).toHaveBeenCalledWith(client, 's', 'team_shield');
  });

  it('a removed answer is dimmed and labelled on the projector', () => {
    const q = {
      id: 'q', position: 0, type: 'multiple_choice', prompt: 'P', imagePath: null, status: 'open', options: [
        { id: 'a', position: 0, label: 'One', imagePath: null }, { id: 'b', position: 1, label: 'Two', imagePath: null }, { id: 'c', position: 2, label: 'Three', imagePath: null },
      ], distribution: null, correctOptionId: null,
    } as unknown as GameQuestion;
    render(<QuestionStage question={q} hiddenOptionId="b" />);
    expect(screen.getByLabelText('Answer B removed by Knowledge Reveal')).toBeInTheDocument();
  });

  it('the reveal names team abilities, power-up strikes and the energy earned', () => {
    vi.useFakeTimers();
    const attack: BattleAttack = {
      questionId: 'q1', position: 0, eligible: 2, correct: 2, accuracy: 100, attackers: ['a', 'b'], damage: 100, hpBefore: 700, hpAfter: 600,
      mode: 'normal', targetPct: 50, targetCount: 1, defended: true, heal: 0, unlocked: false, weapon: null, perHit: 6, weaponBonus: 0, burn: 0, special: null, frozen: false,
      energyGain: 25, energyReasons: ['mastery', 'defended', 'participation'], shielded: false, lightning: 80, rally: true, scan: false, boosted: 1,
    };
    render(<BattleArena battle={battle({ last: attack })} players={[{ id: 'a', avatar: '000000000', nickname: 'A' }]} attack={attack} />);
    act(() => void vi.advanceTimersByTime(4000));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Final Rally! Every hit doubled · Group Lightning −80 · 1 power-up strike · +25 team energy (mastery, defended, everyone joined in)',
    );
    vi.useRealTimers();
  });
});
