import type { AbilityKey } from '../entities';

/** The six abilities, in display order. `mag` (Magic) takes Wisdom's old slot. */
export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'mag', 'cha'] as const;

export const ABILITY_NAMES: Record<AbilityKey, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  mag: 'Magic',
  cha: 'Charisma',
};

/** One-line hint about what each ability does, shown in the builder. */
export const ABILITY_BLURBS: Record<AbilityKey, string> = {
  str: 'Physical attack power (Warrior).',
  dex: 'Dodge, initiative, and finesse attacks (Rogue).',
  con: 'Hit points.',
  int: 'Picking locks and solving riddles.',
  mag: 'Magical attack power (Mage).',
  cha: 'Swaying people you meet.',
};
