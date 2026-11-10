import type { LeaderboardEntry, SpecialEvent } from './types';

/** The headline for a leaderboard update (legendary comeback, new champion, champion defends), if any. */
export function eventBanner(events: SpecialEvent[], byId: Map<string, LeaderboardEntry>) {
  const name = (id: string) => byId.get(id)?.nickname ?? 'Someone';
  const legendary = events.find((e) => e.type === 'legendary-comeback');
  if (legendary && legendary.type === 'legendary-comeback') return { tone: 'bg-volt-400', text: `Legendary comeback · ${name(legendary.participantId)} · ${legendary.from} → 1` };
  const takeover = events.find((e) => e.type === 'champion-takeover');
  if (takeover) return { tone: 'bg-rank-gold', text: `New champion · ${name(takeover.participantId)}` };
  const defence = events.find((e) => e.type === 'champion-defence');
  if (defence) return { tone: 'bg-rank-gold', text: `Champion defends · ${name(defence.participantId)}` };
  return null;
}
