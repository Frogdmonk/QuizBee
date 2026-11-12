import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '@/contexts/ToastProvider';
import { MonsterPicker } from '@/components/battle/MonsterPicker';
import { BattleSettings } from '@/components/battle/BattleSettings';
import { autoDifficulty, autoHpAt, effectiveDifficulty } from '@/lib/monsters/difficulty';
import { catalogueMonster } from '@/lib/monsters/generate';
import { CATALOGUE } from '@/lib/monsters/catalogue';
import { DEFAULT_BATTLE_CONFIG } from '@/services/game';
import type { BattleState } from '@/types/game';
import type { MonsterSpec } from '@/lib/monsters/types';

const calls = vi.hoisted(() => ({ monster: [] as unknown[], difficulty: [] as unknown[] }));
vi.mock('@/services/battle', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/battle')>()),
  setBattleMonster: vi.fn(async (_c: unknown, _s: string, spec: unknown) => {
    calls.monster.push(spec);
    return 31;
  }),
  setBattleDifficulty: vi.fn(async (_c: unknown, _s: string, d: unknown) => {
    calls.difficulty.push(d);
    return 31;
  }),
}));


globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  calls.monster.length = 0;
  calls.difficulty.length = 0;
});

const wrap = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
const ashfang = catalogueMonster(CATALOGUE.find((e) => e.id === 'ashfang')!);
const battle: BattleState = {
  enabled: true, monster: ashfang.id, monsterSpec: ashfang, monsterChosen: true, difficulty: 'auto', difficultyResolved: null,
  hpSetting: null, baseDamage: 3, maxHp: null, hp: null, config: DEFAULT_BATTLE_CONFIG, current: null, energy: 0,
  armed: { shield: null, lightning: null, rally: null, scan: null }, draftPosition: null, weapon: null, vote: null, last: null,
};
const client = {} as never;

describe('difficulty (mirrors the server)', () => {
  it('automatic follows the quiz like private.auto_difficulty; HP scales like start_session_battle', () => {
    expect(autoDifficulty(Array(10).fill(null))).toBe('medium');
    expect(autoDifficulty(['hard', 'hard', 'hard', 'medium', null, null, null, null, null, null])).toBe('easy');
    expect(autoDifficulty(['easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'medium', 'medium', 'hard'])).toBe('hard');
    expect(autoDifficulty(['easy', 'easy', 'easy'])).toBe('medium'); // too few tagged to judge
    expect(effectiveDifficulty('epic', [])).toBe('epic');
    // Same numbers as the database test: 10 players × 10 questions × 3 damage.
    expect([autoHpAt(10, 10, 3, 'medium'), autoHpAt(10, 10, 3, 'easy'), autoHpAt(10, 10, 3, 'hard'), autoHpAt(10, 10, 3, 'epic')]).toEqual([210, 180, 240, 270]);
  });
});

describe('the host lobby’s monster choice', () => {
  it('shows the session’s monster and rolls a new random one or a surprise boss with this quiz’s weakness', async () => {
    const onChanged = vi.fn();
    render(<MonsterPicker client={client} sessionId="s1" battle={battle} topics={['Loops']} onChanged={onChanged} />, { wrapper: wrap });
    expect(screen.getByText('Ashfang')).toBeInTheDocument();
    // The stored monster's weakness (this one was made without topics); new rolls take the quiz's.
    expect(screen.getByText(/weak to Water$/)).toBeInTheDocument();

    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'New random monster' })));
    const random = calls.monster[0] as MonsterSpec;
    expect(random.source).toBe('random');
    expect(random.archetype).not.toBe('dragon'); // avoids the one the class already has
    expect(random.weakness.topic).toBe('Loops');
    expect(onChanged).toHaveBeenCalled();

    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Surprise boss' })));
    const surprise = calls.monster[1] as MonsterSpec;
    expect(surprise.source).toBe('surprise');
    expect(['epic', 'legendary']).toContain(surprise.rarity);
  });

  it('opens the catalogue by family, marks the current monster and saves a pick', async () => {
    render(<MonsterPicker client={client} sessionId="s1" battle={battle} topics={[]} onChanged={() => {}} />, { wrapper: wrap });
    fireEvent.click(screen.getByRole('button', { name: 'Choose…' }));
    const dialog = screen.getByRole('dialog', { name: 'Choose the monster' });
    expect(within(dialog).getByRole('region', { name: 'Dragons' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Ashfang/, pressed: true })).toBeInTheDocument();
    await act(async () => void fireEvent.click(within(dialog).getByRole('button', { name: /The Hollow King/ })));
    expect((calls.monster[0] as MonsterSpec).id).toBe('hollow-king');
  });
});

describe('the difficulty setting', () => {
  it('replaces the intensity buttons: automatic previews this quiz, a fixed level is saved', async () => {
    const hardQuiz = ['hard', 'hard', 'hard', 'hard', null];
    render(<BattleSettings client={client} sessionId="s1" battle={battle} players={10} questions={10} difficulties={hardQuiz} onChanged={() => {}} />, { wrapper: wrap });
    expect(screen.queryByRole('radiogroup', { name: 'Battle intensity' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Easy for this quiz')).toBeInTheDocument();
    expect(screen.getByText(/About/).textContent).toContain('180 HP');
    await act(async () => void fireEvent.click(screen.getByRole('radio', { name: 'Epic' })));
    expect(calls.difficulty).toEqual(['epic']);
  });
});
