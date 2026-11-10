import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BATTLE_CONFIG, toBattle } from '@/services/game';
import { specialStatus } from '@/lib/battle/state';
import { currentVote } from '@/hooks/useWeaponVote';
import { planAttack } from '@/lib/battle/choreography';
import { WeaponVoteStage } from '@/components/battle/WeaponVote';
import { PhoneWeaponVote } from '@/components/battle/PhoneWeaponVote';
import { BattleArena } from '@/components/battle/BattleArena';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { BattleAttack, BattleState, EquippedWeapon, GameState, WeaponInfo, WeaponVote } from '@/types/game';

vi.mock('@/services/battle', () => ({ castWeaponVote: vi.fn(async () => 'accepted') }));
import { castWeaponVote } from '@/services/battle';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const weapon = (key: string, name: string): WeaponInfo => ({
  key, name, rarity: 'epic', description: `${name} description`, passive: `${name} passive`, specialName: `${name} special`, special: 'does a thing', charges: 2, cooldown: 1,
});
const offered = [weapon('thunder', 'Thunder Blade'), weapon('frost', 'Frost Hammer'), weapon('shadow', 'Shadow Bow')];
const vote = (over: Partial<WeaponVote> = {}): WeaponVote => ({
  id: 'v1', questionId: 'q1', round: 1, status: 'open', offered, options: ['thunder', 'frost', 'shadow'],
  opensAt: '2026-11-11T10:00:00Z', closesAt: '2026-11-11T10:00:10Z', voters: 30, ballots: 0,
  round1Counts: null, counts: null, winner: null, decidedBy: null, resolvedAt: null, ...over,
});

describe('weapons from the server', () => {
  it('parses the equipped weapon, the vote and the weapon part of an attack', () => {
    const b = toBattle({
      enabled: true, monster: 'gloomjaw', hp_setting: null, base_damage: 3, max_hp: 1000, hp: 900,
      weapon: {
        key: 'thunder', name: 'Thunder Blade', rarity: 'legendary', description: 'd', passive: 'p', special_name: 'Thunderclap', special: 's',
        charges: 2, cooldown: 1, charges_left: 1, ready_at: 4, armed_at: null,
      },
      vote: {
        id: 'v1', question_id: 'q1', round: 2, status: 'open', offered: [], options: ['thunder', 'frost'], opens_at: 'a', closes_at: 'b',
        voters: 30, ballots: 3, round1_counts: { thunder: 10, frost: 10, shadow: 5 }, counts: null, winner: null, decided_by: null, resolved_at: null,
      },
      last: {
        question_id: 'q1', position: 0, eligible: 10, correct: 9, accuracy: 90, attackers: [], damage: 40, hp_before: 940, hp_after: 900,
        unlocked: true, weapon: 'thunder', per_hit: 8, weapon_bonus: 13, burn: 0, special: 'thunder', frozen: false,
      },
    })!;
    expect(b.weapon).toMatchObject({ key: 'thunder', specialName: 'Thunderclap', chargesLeft: 1, readyAt: 4, armedAt: null });
    expect(b.vote).toMatchObject({ round: 2, options: ['thunder', 'frost'], round1Counts: { thunder: 10 } });
    expect(b.last).toMatchObject({ unlocked: true, perHit: 8, special: 'thunder', weaponBonus: 13 });
    expect(b.config).toMatchObject({ weaponsEnabled: true, unlockPct: 90, voteMs: 10000 }); // phase 2 server: defaults
  });

  it('the vote on screen belongs to the current question, during its reveal', () => {
    const s = { battle: { enabled: true, maxHp: 100, hp: 50, vote: vote() }, question: { id: 'q1' }, session: { phase: 'reveal' } } as unknown as GameState;
    expect(currentVote(s)?.id).toBe('v1');
    expect(currentVote({ ...s, question: { id: 'q2' } } as unknown as GameState)).toBeNull();
    expect(currentVote({ ...s, session: { phase: 'leaderboard' } } as unknown as GameState)).toBeNull();
  });

  it('when the teacher can use the special (mirrors the server)', () => {
    const w: EquippedWeapon = { ...weapon('thunder', 'Thunder Blade'), chargesLeft: 2, readyAt: 2, armedAt: null };
    const at = (phase: string, position: number, open = false) =>
      ({ session: { phase, currentPosition: position, questionCount: 10, status: 'in_progress' }, question: { status: open ? 'open' : 'closed' } }) as unknown as GameState;
    expect(specialStatus(at('leaderboard', 0), w)).toMatchObject({ target: 1, can: false, reason: 'Recharging: ready from question 3.' });
    expect(specialStatus(at('leaderboard', 1), w)).toMatchObject({ target: 2, can: true });
    expect(specialStatus(at('question', 3, true), w)).toMatchObject({ target: 3, can: true, reason: 'Applies to this question.' });
    expect(specialStatus(at('question', 3, true), { ...w, armedAt: 3 })).toMatchObject({ can: false, reason: 'Armed for question 4.' });
    expect(specialStatus(at('question', 3, true), { ...w, chargesLeft: 0 })).toMatchObject({ can: false, reason: 'No charges left.' });
    expect(specialStatus(at('leaderboard', 9), w)).toMatchObject({ target: null, can: false });
  });

  it('an equipped weapon fires its own projectiles', () => {
    expect(new Set(planAttack(['a', 'b', 'c', 'd'], 'q', 'ice').shots.map((s) => s.kind))).toEqual(new Set(['ice']));
  });
});

describe('the vote on the projector', () => {
  it('shows the unlock message, the three weapons and the live counts', () => {
    render(<WeaponVoteStage vote={vote()} stage="open" tally={{ voteId: 'v1', round: 1, counts: { thunder: 7, frost: 2, shadow: 1 }, total: 10 }} closesInMs={6200} />);
    expect(screen.getByRole('heading')).toHaveTextContent('A legendary weapon has been unlocked!');
    expect(screen.getByText(/Incredible teamwork/i)).toBeInTheDocument();
    expect(screen.getByText(/10 of 30 voted/)).toBeInTheDocument();
    expect(screen.getByText('7 votes')).toBeInTheDocument();
    expect(screen.getByLabelText('Seconds left to vote')).toHaveTextContent('7');
    expect(screen.queryByRole('button')).not.toBeInTheDocument(); // a projector link: no controls
  });

  it('the teacher’s projector can decide on a tie or cancel', () => {
    const decide = vi.fn();
    render(<WeaponVoteStage vote={vote({ round: 2, status: 'teacher', options: ['thunder', 'frost'], counts: { thunder: 4, frost: 4 } })} stage="teacher" tally={null} closesInMs={0} host={{ busy: false, decide }} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Your teacher chooses the weapon');
    fireEvent.click(screen.getAllByRole('button', { name: 'Choose for the class' })[1]);
    expect(decide).toHaveBeenCalledWith('frost');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel vote' }));
    expect(decide).toHaveBeenCalledWith(null);
  });
});

describe('the vote on a phone', () => {
  afterEach(() => vi.mocked(castWeaponVote).mockClear());
  const client = {} as AppSupabaseClient;

  it('one tap votes; then it only says what I chose', async () => {
    const onVoted = vi.fn();
    render(<PhoneWeaponVote client={client} vote={vote()} stage="open" closesInMs={8000} myChoice={null} onVoted={onVoted} />);
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Vote for Frost Hammer' })));
    expect(castWeaponVote).toHaveBeenCalledWith(client, 'v1', 'frost');
    expect(screen.getByRole('status')).toHaveTextContent('You voted Frost Hammer');
    expect(screen.queryByRole('button', { name: /Vote for/ })).not.toBeInTheDocument();
    expect(onVoted).toHaveBeenCalled();
  });

  it('after a reload, the server’s record of my vote is shown; a runoff offers only the tied weapons', () => {
    const { rerender } = render(<PhoneWeaponVote client={client} vote={vote()} stage="open" closesInMs={8000} myChoice="shadow" onVoted={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('You voted Shadow Bow');
    rerender(<PhoneWeaponVote client={client} vote={vote({ round: 2, options: ['thunder', 'frost'] })} stage="open" closesInMs={4000} myChoice={null} onVoted={() => {}} />);
    expect(screen.getByText('Tie! Vote again')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Vote for/ })).toHaveLength(2);
  });

  it('explains the teacher’s decision and the result', () => {
    const { rerender } = render(<PhoneWeaponVote client={client} vote={vote({ status: 'teacher', options: ['thunder', 'frost'] })} stage="teacher" closesInMs={0} myChoice={null} onVoted={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Your teacher is choosing between Thunder Blade and Frost Hammer');
    rerender(<PhoneWeaponVote client={client} vote={vote({ status: 'done', winner: 'thunder', decidedBy: 'vote' })} stage="done" closesInMs={0} myChoice={null} onVoted={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Thunder Blade equipped!');
  });
});

describe('weapons in the arena', () => {
  it('students hold the class weapon, and the reveal names its effect and the unlock', () => {
    vi.useFakeTimers();
    const attack: BattleAttack = {
      questionId: 'q1', position: 0, eligible: 2, correct: 2, accuracy: 100, attackers: ['a', 'b'], damage: 16, hpBefore: 100, hpAfter: 84,
      mode: 'normal', targetPct: 50, targetCount: 1, defended: true, heal: 0,
      unlocked: true, weapon: 'thunder', perHit: 8, weaponBonus: 10, burn: 0, special: 'thunder', frozen: false, energyGain: 0, energyReasons: [], shielded: false, lightning: 0, rally: false, scan: false, boosted: 0,
    };
    const battle: BattleState = { enabled: true, monster: 'gloomjaw', hpSetting: null, baseDamage: 3, maxHp: 100, hp: 84, config: DEFAULT_BATTLE_CONFIG, current: null, energy: 0, armed: { shield: null, lightning: null, rally: null, scan: null }, draftPosition: null, weapon: null, vote: null, last: attack };
    render(<BattleArena battle={battle} players={[{ id: 'a', avatar: '000000000', nickname: 'A' }, { id: 'b', avatar: '000000000', nickname: 'B' }]} attack={attack} />);
    expect(document.querySelectorAll('.hero-weapon')).toHaveLength(2);
    act(() => void vi.advanceTimersByTime(4000));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Thunderclap! Every hit doubled · +10 weapon damage');
    expect(status).toHaveTextContent('100% correct: weapon unlocked!');
    vi.useRealTimers();
  });
});
