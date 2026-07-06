import type { Abilities, Character, CharacterDraft, ClassDef, PlayerId, Race } from '../entities';
import { ABILITY_KEYS } from '../content/abilities';

/**
 * Pure character math, shared by the client (to preview a build live) and the
 * server (to validate and finalize it). No I/O.
 */

// ---- Point-buy (D&D 5e style) ------------------------------------------------

export const POINT_BUY_BUDGET = 27;
export const ABILITY_MIN = 8;
export const ABILITY_MAX = 15;

/** Cost of raising a single ability to `score` from the 8 baseline. */
const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

export function abilityCost(score: number): number | null {
  return POINT_BUY_COST[score] ?? null;
}

/** Total spent, or null if any score is outside the legal 8..15 range. */
export function totalPointBuyCost(abilities: Abilities): number | null {
  let total = 0;
  for (const key of ABILITY_KEYS) {
    const cost = abilityCost(abilities[key]);
    if (cost === null) return null;
    total += cost;
  }
  return total;
}

export function isLegalPointBuy(abilities: Abilities): boolean {
  const total = totalPointBuyCost(abilities);
  return total !== null && total <= POINT_BUY_BUDGET;
}

export function baseAbilities(): Abilities {
  return { str: 8, dex: 8, con: 8, int: 8, mag: 8, cha: 8 };
}

// ---- Derivation --------------------------------------------------------------

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function applyRaceMods(base: Abilities, race: Race): Abilities {
  const result = { ...base };
  for (const key of ABILITY_KEYS) {
    result[key] = base[key] + (race.abilityMods[key] ?? 0);
  }
  return result;
}

export interface DerivedStats {
  maxHp: number;
  ac: number;
  speed: number;
  initiative: number;
}

/** Simplified derivations from final ability scores + race + class. */
export function deriveStats(abilities: Abilities, race: Race, classDef: ClassDef): DerivedStats {
  return {
    maxHp: 10 + abilityMod(abilities.con) + classDef.hpBonus,
    ac: 10 + abilityMod(abilities.dex),
    speed: race.speed,
    initiative: abilityMod(abilities.dex),
  };
}

/** Turn a validated draft into a finished, full-HP character. */
export function buildCharacter(ownerId: PlayerId, draft: CharacterDraft, race: Race, classDef: ClassDef): Character {
  const abilities = applyRaceMods(draft.baseAbilities, race);
  const derived = deriveStats(abilities, race, classDef);
  return {
    id: ownerId,
    ownerId,
    name: draft.name,
    raceId: race.id,
    classId: classDef.id,
    visual: draft.visual,
    level: 1,
    abilities,
    hp: derived.maxHp,
    maxHp: derived.maxHp,
    ac: derived.ac,
    speed: derived.speed,
    initiative: derived.initiative,
    inventory: [],
    notes: [],
  };
}
