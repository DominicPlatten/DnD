import type { ClassDef, ClassId } from '../entities';

export const CLASSES: readonly ClassDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    icon: '⚔️',
    blurb: 'Frontline fighter. Strong, sturdy, and relentless in the face of danger.',
    primary: 'str',
    hpBonus: 4,
  },
  {
    id: 'mage',
    name: 'Mage',
    icon: '🔮',
    blurb: 'Spellcaster. Intelligence and magic shape the world around them.',
    primary: 'mag',
    hpBonus: 0,
  },
  {
    id: 'rogue',
    name: 'Rogue',
    icon: '🗡️',
    blurb: 'Nimble striker. Fast, perceptive, and quick to find a way through.',
    primary: 'dex',
    hpBonus: 2,
  },
];

const BY_ID = new Map<ClassId, ClassDef>(CLASSES.map((c) => [c.id, c]));

export function getClass(id: ClassId): ClassDef | undefined {
  return BY_ID.get(id);
}
