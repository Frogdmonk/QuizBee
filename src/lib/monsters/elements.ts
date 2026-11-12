import type { ElementId, ElementWords, Palette } from './types';

type ElementInfo = {
  id: ElementId;
  label: string;
  /** Base colours; archetypes may shift them slightly (see generate.ts). */
  palettes: readonly Palette[];
  words: ElementWords;
  /** First halves of compound names ("Ash" + "fang"). */
  nameStarts: readonly string[];
  /** Title adjectives ("the Ember Tyrant"). */
  titleWords: readonly string[];
  /** The element it is weak to (thematic). */
  weakTo: ElementId;
};

/*
 * Every palette keeps the glow (accent) clearly brighter than the body so cracks, runes and eyes
 * read on a projector, and every body colour stays visible on the night sky behind it.
 */
export const ELEMENTS: Record<ElementId, ElementInfo> = {
  fire: {
    id: 'fire',
    label: 'Fire',
    palettes: [
      { main: '#2b2324', secondary: '#7a2e14', accent: '#ff8a1f', eye: '#ffc94d' },
      { main: '#5c1d14', secondary: '#a8431d', accent: '#ffb02e', eye: '#fff0a8' },
    ],
    words: { adjective: 'Ember', noun: 'Flame', breath: 'Flame Breath', storm: 'Firestorm', armour: 'Molten Armour' },
    nameStarts: ['Ash', 'Cinder', 'Ember', 'Scorch', 'Pyre', 'Blaze'],
    titleWords: ['Ember', 'Burning', 'Molten', 'Cinder'],
    weakTo: 'water',
  },
  ice: {
    id: 'ice',
    label: 'Ice',
    palettes: [
      { main: '#3c5a7a', secondary: '#c9e6f5', accent: '#8ff0ff', eye: '#e8fdff' },
      { main: '#24384f', secondary: '#7fb2d6', accent: '#b8f4ff', eye: '#ffffff' },
    ],
    words: { adjective: 'Glacier', noun: 'Frost', breath: 'Ice Blast', storm: 'Blizzard', armour: 'Frost Scales' },
    nameStarts: ['Rime', 'Frost', 'Hail', 'Glacier', 'Sleet', 'Shiver'],
    titleWords: ['Glacier', 'Frozen', 'Winter', 'Rime'],
    weakTo: 'fire',
  },
  storm: {
    id: 'storm',
    label: 'Storm',
    palettes: [
      { main: '#2e3354', secondary: '#5a63a8', accent: '#f6f05a', eye: '#fffbd1' },
      { main: '#3a2f5c', secondary: '#7d74c4', accent: '#7ee8ff', eye: '#e6fbff' },
    ],
    words: { adjective: 'Thunder', noun: 'Lightning', breath: 'Thunder Strike', storm: 'Tempest', armour: 'Static Shell' },
    nameStarts: ['Thunder', 'Volt', 'Gale', 'Storm', 'Squall', 'Bolt'],
    titleWords: ['Thunder', 'Storm', 'Howling', 'Tempest'],
    weakTo: 'stone',
  },
  shadow: {
    id: 'shadow',
    label: 'Shadow',
    palettes: [
      { main: '#231d33', secondary: '#4a3b6b', accent: '#b57cff', eye: '#e8d4ff' },
      { main: '#1c1c26', secondary: '#3d3550', accent: '#ff5fa2', eye: '#ffd1e6' },
    ],
    words: { adjective: 'Shadow', noun: 'Dusk', breath: 'Shadow Bolt', storm: 'Night Surge', armour: 'Veil of Dusk' },
    nameStarts: ['Dusk', 'Night', 'Gloom', 'Umbra', 'Murk', 'Shade'],
    titleWords: ['Shadow', 'Midnight', 'Hollow', 'Dusk'],
    weakTo: 'arcane',
  },
  poison: {
    id: 'poison',
    label: 'Poison',
    palettes: [
      { main: '#25402c', secondary: '#4f7a3a', accent: '#b6ff3d', eye: '#f2ffcc' },
      { main: '#3b2a4a', secondary: '#6b4a7a', accent: '#8dff6a', eye: '#e9ffd9' },
    ],
    words: { adjective: 'Toxic', noun: 'Venom', breath: 'Toxic Cloud', storm: 'Plague Wind', armour: 'Venom Hide' },
    nameStarts: ['Venom', 'Blight', 'Bile', 'Rot', 'Fester', 'Mire'],
    titleWords: ['Toxic', 'Venom', 'Blighted', 'Festering'],
    weakTo: 'nature',
  },
  stone: {
    id: 'stone',
    label: 'Stone',
    palettes: [
      { main: '#5b5650', secondary: '#8a8277', accent: '#ffb347', eye: '#ffe0a3' },
      { main: '#3f3a36', secondary: '#6e655c', accent: '#7fe0c4', eye: '#d9fff4' },
    ],
    words: { adjective: 'Granite', noun: 'Stone', breath: 'Rockfall', storm: 'Earthquake', armour: 'Stone Armour' },
    nameStarts: ['Stone', 'Iron', 'Granite', 'Boulder', 'Flint', 'Crag'],
    titleWords: ['Granite', 'Mountain', 'Ironbound', 'Unbroken'],
    weakTo: 'water',
  },
  arcane: {
    id: 'arcane',
    label: 'Arcane',
    palettes: [
      { main: '#2a2f6b', secondary: '#5c4bb0', accent: '#5ff2ff', eye: '#e0fdff' },
      { main: '#3d1f5c', secondary: '#7a3fa8', accent: '#ffd36b', eye: '#fff5d1' },
    ],
    words: { adjective: 'Moonlit', noun: 'Rune', breath: 'Arcane Beam', storm: 'Rune Storm', armour: 'Rune Shield' },
    nameStarts: ['Rune', 'Moon', 'Star', 'Hex', 'Glyph', 'Aether'],
    titleWords: ['Moon', 'Starlit', 'Rune-bound', 'Arcane'],
    weakTo: 'shadow',
  },
  nature: {
    id: 'nature',
    label: 'Nature',
    palettes: [
      { main: '#2f4a2a', secondary: '#6b5a3a', accent: '#c8f56a', eye: '#f7ffd6' },
      { main: '#3b3a22', secondary: '#5e7a3a', accent: '#ffcf5c', eye: '#fff6cf' },
    ],
    words: { adjective: 'Thorn', noun: 'Bramble', breath: 'Thorn Volley', storm: 'Wildgrowth', armour: 'Bark Shield' },
    nameStarts: ['Thorn', 'Moss', 'Bramble', 'Root', 'Fern', 'Briar'],
    titleWords: ['Thorn', 'Elder', 'Wildwood', 'Mossbound'],
    weakTo: 'fire',
  },
  water: {
    id: 'water',
    label: 'Water',
    palettes: [
      { main: '#1f4a5c', secondary: '#2f7a8a', accent: '#6ff7e0', eye: '#e0fff9' },
      { main: '#1c3550', secondary: '#3a6b9a', accent: '#9ae8ff', eye: '#ffffff' },
    ],
    words: { adjective: 'Tidal', noun: 'Tide', breath: 'Tidal Jet', storm: 'Whirlpool', armour: 'Coral Plates' },
    nameStarts: ['Tide', 'Brine', 'Deep', 'Surge', 'Kelp', 'Reef'],
    titleWords: ['Tidal', 'Abyssal', 'Drowned', 'Deep'],
    weakTo: 'storm',
  },
  necrotic: {
    id: 'necrotic',
    label: 'Necrotic',
    palettes: [
      { main: '#3a3a36', secondary: '#c9c2a8', accent: '#6dffb4', eye: '#d6ffe9' },
      { main: '#2d2a33', secondary: '#a9a3b8', accent: '#9effd0', eye: '#e6fff4' },
    ],
    words: { adjective: 'Ashen', noun: 'Grave', breath: 'Soul Drain', storm: 'Fear Wave', armour: 'Bone Ward' },
    nameStarts: ['Grave', 'Bone', 'Ash', 'Wither', 'Crypt', 'Pale'],
    titleWords: ['Ashen', 'Hollow', 'Restless', 'Grave'],
    weakTo: 'arcane',
  },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS) as ElementId[];
