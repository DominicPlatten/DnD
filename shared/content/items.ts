/** Items the GM can hand to a character. */
export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  blurb: string;
}

export const ITEMS: readonly ItemDef[] = [
  { id: 'healing-potion', name: 'Healing Potion', icon: '🧪', blurb: 'Restores hit points when drunk.' },
  { id: 'sword', name: 'Sword', icon: '⚔️', blurb: 'A trusty blade.' },
  { id: 'shield', name: 'Shield', icon: '🛡️', blurb: 'Improves armor class.' },
  { id: 'bow', name: 'Bow', icon: '🏹', blurb: 'A ranged weapon.' },
  { id: 'torch', name: 'Torch', icon: '🔦', blurb: 'Lights the dark.' },
  { id: 'rations', name: 'Rations', icon: '🍖', blurb: 'A day of food.' },
  { id: 'rope', name: 'Rope', icon: '🪢', blurb: 'Fifty feet of hemp.' },
  { id: 'scroll', name: 'Scroll', icon: '📜', blurb: 'A single-use magical scroll.' },
  { id: 'gold', name: 'Gold', icon: '💰', blurb: 'Coins of the realm.' },
  { id: 'key', name: 'Key', icon: '🗝️', blurb: 'Opens something, somewhere.' },
];

const BY_ID = new Map<string, ItemDef>(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef | undefined {
  return BY_ID.get(id);
}
