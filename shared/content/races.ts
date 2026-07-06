import type { Race, RaceId } from '../entities';

/**
 * Race registry. A small, recognizable set — adding a race is just another
 * entry here, no other code changes. Ability mods are applied on top of the
 * player's point-buy base scores.
 */
export const RACES: readonly Race[] = [
  {
    id: 'human',
    name: 'Human',
    blurb: 'Adaptable and ambitious. A little better at everything.',
    abilityMods: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 30,
  },
  {
    id: 'elf',
    name: 'Elf',
    blurb: 'Graceful and keen-eyed. Quick on their feet.',
    abilityMods: { dex: 2 },
    speed: 30,
  },
  {
    id: 'dwarf',
    name: 'Dwarf',
    blurb: 'Stout and stubborn. Hard to knock down.',
    abilityMods: { con: 2 },
    speed: 25,
  },
  {
    id: 'halfling',
    name: 'Halfling',
    blurb: 'Small, lucky, and nimble.',
    abilityMods: { dex: 2 },
    speed: 25,
  },
  {
    id: 'half-orc',
    name: 'Half-Orc',
    blurb: 'Powerful and resilient in battle.',
    abilityMods: { str: 2, con: 1 },
    speed: 30,
  },
  {
    id: 'tiefling',
    name: 'Tiefling',
    blurb: 'Charismatic, sharp, touched by the infernal.',
    abilityMods: { cha: 2, int: 1 },
    speed: 30,
  },
];

const RACE_BY_ID = new Map<RaceId, Race>(RACES.map((race) => [race.id, race]));

export function getRace(id: RaceId): Race | undefined {
  return RACE_BY_ID.get(id);
}
