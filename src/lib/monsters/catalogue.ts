import type { ElementId, Personality, Rarity } from './types';

/*
 * Named monsters a teacher can pick from (generation mode B). Each entry fixes an archetype,
 * element, name, title, rarity and personality; body parts and palette come from its own fixed
 * seed, so the same entry always looks the same. Ids are stable: never rename one that shipped.
 *
 * Names are original. Three examples from the brief were renamed because they match well-known
 * characters elsewhere: Frostmaw → Rimemaw, Dreadwing → Duskwing, Stormscale → Thunderscale.
 */

export type CatalogueEntry = {
  id: string;
  archetype: string;
  element: ElementId;
  name: string;
  title: string;
  rarity: Rarity;
  personality: Personality;
  seed: number;
  /** Part choices that define this monster's look (others come from the seed). */
  parts?: Record<string, string>;
};

export const CATALOGUE: readonly CatalogueEntry[] = [
  // The original monster, and the default when nothing else is chosen.
  { id: 'gloomjaw', archetype: 'gloom', element: 'shadow', name: 'Gloomjaw', title: 'the Riddle Eater', rarity: 'common', personality: 'mischievous', seed: 1 },

  // Dragons
  { id: 'ashfang', archetype: 'dragon', element: 'fire', name: 'Ashfang', title: 'the Ember Tyrant', rarity: 'epic', personality: 'arrogant', seed: 101, parts: { wings: 'torn', horns: 'curved' } },
  { id: 'rimemaw', archetype: 'dragon', element: 'ice', name: 'Rimemaw', title: 'the Glacier Wyrm', rarity: 'rare', personality: 'ancient', seed: 102, parts: { wings: 'full', crest: 'spines' } },
  { id: 'thunderscale', archetype: 'dragon', element: 'storm', name: 'Thunderscale', title: 'the Thunder Sovereign', rarity: 'epic', personality: 'proud', seed: 103, parts: { horns: 'crown' } },
  { id: 'duskwing', archetype: 'dragon', element: 'shadow', name: 'Duskwing', title: 'the Shadow Dragon', rarity: 'legendary', personality: 'arrogant', seed: 104, parts: { wings: 'ribbed' } },
  { id: 'venomcrest', archetype: 'dragon', element: 'poison', name: 'Venomcrest', title: 'the Toxic Serpent', rarity: 'rare', personality: 'furious', seed: 105, parts: { crest: 'fin' } },

  // Witches and warlocks
  { id: 'morvexa', archetype: 'witch', element: 'shadow', name: 'Morvexa', title: 'the Hollow Witch', rarity: 'rare', personality: 'cunning', seed: 201, parts: { headwear: 'peaked-hat', orbit: 'candles' } },
  { id: 'vespera', archetype: 'witch', element: 'arcane', name: 'Vespera', title: 'the Moon Sorceress', rarity: 'epic', personality: 'mischievous', seed: 202, parts: { headwear: 'hood', orbit: 'runes' } },
  { id: 'grimhollow', archetype: 'warlock', element: 'necrotic', name: 'Grimhollow', title: 'the Cursed Warlock', rarity: 'rare', personality: 'sinister', seed: 203, parts: { headwear: 'horned-hood', orbit: 'skulls' } },

  // Golems and ancient guardians
  { id: 'stonebreaker', archetype: 'golem', element: 'stone', name: 'Stonebreaker', title: 'the Granite Juggernaut', rarity: 'common', personality: 'furious', seed: 301 },
  { id: 'ironroot', archetype: 'guardian', element: 'nature', name: 'Ironroot', title: 'the Elder Warden', rarity: 'rare', personality: 'ancient', seed: 302, parts: { head: 'antlered' } },
  { id: 'obsidian-colossus', archetype: 'golem', element: 'fire', name: 'Obsidian Colossus', title: 'the Molten Sentinel', rarity: 'epic', personality: 'sleepy', seed: 303, parts: { core: 'furnace' } },
  { id: 'thornheart', archetype: 'guardian', element: 'nature', name: 'Thornheart', title: 'the Wildwood Guardian', rarity: 'legendary', personality: 'proud', seed: 304, parts: { shoulders: 'roots', core: 'heartwood' } },

  // Trolls, giants and brutes
  { id: 'bloodstone-brute', archetype: 'troll', element: 'stone', name: 'Bloodstone', title: 'the Brute', rarity: 'common', personality: 'furious', seed: 401, parts: { weapon: 'club' } },
  { id: 'frostjaw', archetype: 'giant', element: 'ice', name: 'Frostjaw', title: 'the Winter Titan', rarity: 'rare', personality: 'sleepy', seed: 402, parts: { back: 'snowcap' } },
  { id: 'mountainbane', archetype: 'giant', element: 'stone', name: 'Mountainbane', title: 'the Mountain King', rarity: 'epic', personality: 'ancient', seed: 403, parts: { weapon: 'boulder' } },
  { id: 'grimtusk', archetype: 'warlord', element: 'fire', name: 'Grimtusk', title: 'the Iron Chieftain', rarity: 'rare', personality: 'arrogant', seed: 404, parts: { weapon: 'axe' } },
  { id: 'snatchgrin', archetype: 'goblin-king', element: 'poison', name: 'Snatchgrin', title: 'the Scrap King', rarity: 'common', personality: 'mischievous', seed: 405 },
  { id: 'pyrebrand', archetype: 'demon', element: 'fire', name: 'Pyrebrand', title: 'the Ember Fiend', rarity: 'epic', personality: 'sinister', seed: 406 },

  // Undead and shadow
  { id: 'hollow-king', archetype: 'undead-knight', element: 'necrotic', name: 'The Hollow King', title: 'Lord of the Silent Crypt', rarity: 'legendary', personality: 'proud', seed: 501, parts: { helm: 'crowned', weapon: 'greatsword' } },
  { id: 'nightveil', archetype: 'shade', element: 'shadow', name: 'Nightveil', title: 'the Whispering Shade', rarity: 'rare', personality: 'mischievous', seed: 502, parts: { eyes: 'many' } },
  { id: 'ashen-reaper', archetype: 'reaper', element: 'necrotic', name: 'The Ashen Reaper', title: 'Harvester of Doubts', rarity: 'epic', personality: 'sinister', seed: 503 },
  { id: 'gravefang', archetype: 'hound', element: 'necrotic', name: 'Gravefang', title: 'the Crypt Gatekeeper', rarity: 'rare', personality: 'furious', seed: 504 },

  // Other mythical creatures
  { id: 'tidecoil', archetype: 'hydra', element: 'water', name: 'Tidecoil', title: 'the Many-Headed', rarity: 'epic', personality: 'furious', seed: 601, parts: { heads: '3' } },
  { id: 'gravelgaze', archetype: 'basilisk', element: 'stone', name: 'Gravelgaze', title: 'the Serpent King', rarity: 'rare', personality: 'arrogant', seed: 602, parts: { crest: 'crown' } },
  { id: 'brinewake', archetype: 'leviathan', element: 'water', name: 'Brinewake', title: 'Terror of the Deep', rarity: 'epic', personality: 'ancient', seed: 603 },
  { id: 'cinderclaw', archetype: 'chimera', element: 'fire', name: 'Cinderclaw', title: 'the Prowling Chimera', rarity: 'rare', personality: 'cunning', seed: 604 },
  { id: 'ashplume', archetype: 'phoenix', element: 'shadow', name: 'Ashplume', title: 'the Undying', rarity: 'legendary', personality: 'proud', seed: 605 },
  { id: 'mossbloom', archetype: 'spirit', element: 'nature', name: 'Mossbloom', title: 'the Elder Spirit', rarity: 'rare', personality: 'sleepy', seed: 606, parts: { crown: 'antlers' } },
];

export const CATALOGUE_BY_ID: ReadonlyMap<string, CatalogueEntry> = new Map(CATALOGUE.map((e) => [e.id, e]));
export const DEFAULT_MONSTER_ID = 'gloomjaw';
