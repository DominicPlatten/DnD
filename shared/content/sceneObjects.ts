export interface SpriteEntry {
  emoji: string;
  label: string;
}

export interface SpriteCategory {
  name: string;
  sprites: SpriteEntry[];
}

export const SPRITE_LIBRARY: SpriteCategory[] = [
  {
    name: 'Furniture',
    sprites: [
      { emoji: '📦', label: 'Crate' },
      { emoji: '🪣', label: 'Barrel' },
      { emoji: '📚', label: 'Bookshelf' },
      { emoji: '🛏️', label: 'Bed' },
      { emoji: '🪑', label: 'Chair' },
      { emoji: '🪞', label: 'Mirror' },
    ],
  },
  {
    name: 'Nature',
    sprites: [
      { emoji: '🪨', label: 'Boulder' },
      { emoji: '🌊', label: 'Pool' },
      { emoji: '🌿', label: 'Bush' },
      { emoji: '🍄', label: 'Mushroom' },
    ],
  },
  {
    name: 'Magic',
    sprites: [
      { emoji: '🔮', label: 'Orb' },
      { emoji: '💎', label: 'Gem' },
      { emoji: '📜', label: 'Scroll' },
      { emoji: '🏺', label: 'Urn' },
      { emoji: '🪄', label: 'Wand' },
      { emoji: '⭐', label: 'Star' },
      { emoji: '🔯', label: 'Rune' },
    ],
  },
  {
    name: 'Items',
    sprites: [
      { emoji: '⚔️', label: 'Sword' },
      { emoji: '🛡️', label: 'Shield' },
      { emoji: '🍶', label: 'Potion' },
      { emoji: '🔑', label: 'Key' },
      { emoji: '💰', label: 'Gold' },
      { emoji: '📿', label: 'Amulet' },
      { emoji: '🗺️', label: 'Map' },
      { emoji: '📖', label: 'Tome' },
    ],
  },
  {
    name: 'NPCs',
    sprites: [
      { emoji: '🧙', label: 'Wizard' },
      { emoji: '🧝', label: 'Elf' },
      { emoji: '👤', label: 'Stranger' },
      { emoji: '🏪', label: 'Merchant' },
      { emoji: '🧟', label: 'Undead' },
      { emoji: '👹', label: 'Creature' },
      { emoji: '🐉', label: 'Dragon' },
      { emoji: '🧚', label: 'Fairy' },
    ],
  },
  {
    name: 'Events',
    sprites: [
      { emoji: '❓', label: 'Mystery' },
      { emoji: '❗', label: 'Alert' },
      { emoji: '🚩', label: 'Flag' },
      { emoji: '🕳️', label: 'Pit' },
      { emoji: '🔥', label: 'Fire' },
      { emoji: '⚡', label: 'Lightning' },
      { emoji: '💀', label: 'Danger' },
      { emoji: '✨', label: 'Magic' },
    ],
  },
];

const ALL_EMOJIS = new Set(SPRITE_LIBRARY.flatMap((cat) => cat.sprites.map((s) => s.emoji)));

export function isValidSprite(emoji: string): boolean {
  return ALL_EMOJIS.has(emoji);
}
