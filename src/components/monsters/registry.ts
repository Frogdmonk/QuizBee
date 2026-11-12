import type { ComponentType } from 'react';
import type { RigId } from '@/lib/monsters/types';
import type { RigProps } from './shared';
import { BeastRig } from './rigs/BeastRig';
import { BruteRig } from './rigs/BruteRig';
import { CasterRig } from './rigs/CasterRig';
import { DragonRig } from './rigs/DragonRig';
import { GolemRig } from './rigs/GolemRig';
import { PhoenixRig } from './rigs/PhoenixRig';
import { SerpentRig } from './rigs/SerpentRig';
import { UndeadRig } from './rigs/UndeadRig';
import { WraithRig } from './rigs/WraithRig';

/**
 * The SVG body for each rig. A rig missing here is drawn as the default monster, and the
 * generator only picks archetypes whose rig is listed (DRAWN_RIGS).
 */
export const RIGS: Partial<Record<RigId, ComponentType<RigProps>>> = {
  dragon: DragonRig,
  caster: CasterRig,
  golem: GolemRig,
  brute: BruteRig,
  undead: UndeadRig,
  wraith: WraithRig,
  serpent: SerpentRig,
  beast: BeastRig,
  phoenix: PhoenixRig,
};

/** Bodies that can be drawn: the blob (Gloomjaw, drawn by Monster.tsx) plus every registered rig. */
export const DRAWN_RIGS: ReadonlySet<RigId> = new Set<RigId>(['blob', ...(Object.keys(RIGS) as RigId[])]);
