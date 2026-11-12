/*
 * The Monster Generation Engine: types shared by the catalogue, the generator and the screens.
 *
 * A monster has an identity (MonsterSpec: name, archetype, element, look, abilities, personality,
 * weakness) that is generated once in the lobby, stored on the session's battle row and never
 * changes during the game. Everything about the fight itself (HP, modes, damage) stays on the
 * server; the spec only says who the class is fighting and how it looks and behaves.
 */

export type ElementId = 'fire' | 'ice' | 'storm' | 'shadow' | 'poison' | 'stone' | 'arcane' | 'nature' | 'water' | 'necrotic';

/** Body plans that are drawn (components/monsters). Several archetypes can share a rig. */
export type RigId = 'blob' | 'dragon' | 'caster' | 'golem' | 'brute' | 'undead' | 'wraith' | 'serpent' | 'beast' | 'phoenix';

export type CategoryId = 'dragons' | 'casters' | 'golems' | 'brutes' | 'undead' | 'mythic';

/** How the body moves: decides which idle/attack motions fit (a ghost never stomps). */
export type Movement = 'heavy' | 'stomp' | 'float' | 'slither' | 'prowl' | 'soar' | 'wobble';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** The session's difficulty. Independent of the monster and of its rarity. */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'epic';
export type DifficultySetting = Difficulty | 'auto';

export type Personality = 'arrogant' | 'furious' | 'cunning' | 'sleepy' | 'mischievous' | 'ancient' | 'proud' | 'sinister';

export type Palette = {
  /** Main body colour. */
  main: string;
  /** Second colour (belly, cloak lining, plates). */
  secondary: string;
  /** Glow: cracks, runes, breath, eyes in rage. */
  accent: string;
  /** Eye colour. */
  eye: string;
};

/** The animation set an archetype uses for each state (CSS motion families, drawn in Phase 3–4). */
export type AnimationSet = {
  idle: string;
  charge: string;
  attack: string;
  hit: string;
  defend: string;
  recover: string;
  rage: string;
  weakened: string;
  defeat: string;
};

/** The special attack charged in each battle mode (normal → rage → enraged). */
export type Specials = { normal: string; rage: string; enraged: string };

export type MonsterAbilities = {
  /** Its signature attack (shown on the announcement). */
  primary: string;
  /** How it defends (shown when the class's special attack is blocked). */
  defense: string;
  specials: Specials;
};

export type MonsterWeakness = {
  /** The element it fears (thematic; weapons of this element look super-effective). */
  element: ElementId;
  /** A learning objective or topic from this quiz that wounds it most, or null if the quiz has none. */
  topic: string | null;
};

/** A generated monster, as stored on the session (JSON, validated by the server). Version 1. */
export type MonsterSpec = {
  v: 1;
  /** Stable id: a catalogue id (e.g. "ashfang") or a generated one ("gen-dragon-fire-1a2b3c"). */
  id: string;
  /** Catalogue entry it came from, if any. */
  catalogueId: string | null;
  source: 'catalogue' | 'random' | 'surprise';
  archetype: string;
  rig: RigId;
  category: CategoryId;
  element: ElementId;
  name: string;
  title: string;
  rarity: Rarity;
  personality: Personality;
  movement: Movement;
  /** Body-part variants for the rig (e.g. { horns: "curved", wings: "torn", heads: "3" }). */
  parts: Record<string, string>;
  palette: Palette;
  abilities: MonsterAbilities;
  weakness: MonsterWeakness;
  /** The seed it was generated from (same seed + options → same monster). */
  seed: number;
};

/** One archetype: a configuration entry, so new monsters are added as data, not code. */
export type Archetype = {
  id: string;
  label: string;
  category: CategoryId;
  rig: RigId;
  /** What the body is, for people (shown in the teacher's catalogue). */
  body: string;
  movement: Movement;
  /** Elements this body can carry. Anything else is incompatible. */
  elements: readonly ElementId[];
  /** Part pools for the rig: every generated monster picks one value per key. */
  parts: Readonly<Record<string, readonly string[]>>;
  /** Per-element part restrictions (e.g. a water serpent always has fins). */
  partsByElement?: Partial<Record<ElementId, Readonly<Record<string, readonly string[]>>>>;
  personalities: readonly Personality[];
  /** Name building: element-flavoured first halves come from ELEMENTS; these are this body's second halves. */
  nameEnds: readonly string[];
  /** Full given names (witches, kings) used instead of compounds when present. */
  givenNames?: Partial<Record<ElementId, readonly string[]>>;
  /** Title nouns: "the {element adjective} {noun}". */
  titleNouns: readonly string[];
  /** Ability builders: receive the element's words. */
  primary: (w: ElementWords) => string;
  defense: (w: ElementWords) => string;
  specials: (w: ElementWords) => Specials;
  animations: AnimationSet;
  /** Rarities this body can appear at in random generation (surprise bosses use the rarest). */
  rarities: readonly Rarity[];
};

/** Words an element lends to names and abilities. */
export type ElementWords = {
  adjective: string;
  noun: string;
  /** A breath, beam or burst ("Flame Breath"). */
  breath: string;
  /** A wide attack ("Firestorm"). */
  storm: string;
  /** A defensive coat ("Molten Armour"). */
  armour: string;
};
