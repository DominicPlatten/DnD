import type { ClassDef, ClassId } from '../entities';

/**
 * Class registry. A class gives a character a battle identity: which ability
 * powers their attacks (`primary`), whether those attacks are stopped by armor
 * or magic resist (`damageType`), and their move kit. Adding a class is one
 * entry here plus (if it uses new moves) entries in content/moves.
 *
 * The physical/magic split is the point: a Warrior's steel bounces off heavily
 * armored foes, while a Mage's spells ignore armor but fizzle against warded
 * ones — so parties want a mix.
 */
export const CLASSES: readonly ClassDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    icon: '⚔️',
    blurb: 'Frontline fighter. Strong, sturdy, and relentless with steel.',
    primary: 'str',
    damageType: 'physical',
    moves: ['strike', 'heavy', 'guard', 'second-wind'],
    hpBonus: 4,
  },
  {
    id: 'mage',
    name: 'Mage',
    icon: '🔮',
    blurb: 'Spellcaster. Magic cuts through armor but not magical wards.',
    primary: 'mag',
    damageType: 'magic',
    moves: ['firebolt', 'arcane-blast', 'guard', 'mend'],
    hpBonus: 0,
  },
  {
    id: 'rogue',
    name: 'Rogue',
    icon: '🗡️',
    blurb: 'Nimble striker. Fast, accurate, and quick to slip away.',
    primary: 'dex',
    damageType: 'physical',
    moves: ['quick-strike', 'backstab', 'guard', 'flee'],
    hpBonus: 2,
  },
];

const BY_ID = new Map<ClassId, ClassDef>(CLASSES.map((c) => [c.id, c]));

export function getClass(id: ClassId): ClassDef | undefined {
  return BY_ID.get(id);
}
