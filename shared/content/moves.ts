import type { DamageType } from '../entities';

/**
 * Battle moves. A data-driven registry — adding a move is a new entry here plus
 * (optionally) handling its `kind` in the battle resolver.
 *
 * Strength is a DICE ROLL plus stats, not a fixed number: an attack's damage is
 * `roll(dice) + attacker power − defender resist`, a heal is `roll(dice) + bonus`.
 * An attack's `type` decides which defense resists it — armor (physical) or
 * magic resist (magic) — so a class's attacks fare differently against different
 * foes. See `rules/battle.ts` for resolution.
 */
export type MoveKind = 'attack' | 'defend' | 'heal' | 'flee';

/** `count`d`sides`, e.g. { count: 1, sides: 6 } = 1d6. */
export interface DiceSpec {
  count: number;
  sides: number;
}

export interface MoveDef {
  id: string;
  name: string;
  icon: string;
  kind: MoveKind;
  /** For attacks: which defense resists it. Ignored for non-attacks. */
  type?: DamageType;
  /** Dice rolled for damage (attack) or healing (heal); absent for stances. */
  dice?: DiceSpec;
  /** Flat amount added on top of the dice (and the attacker's power, for attacks). */
  bonus?: number;
  /** Percent chance to land, for attacks. */
  accuracy: number;
  blurb: string;
}

export const MOVES: readonly MoveDef[] = [
  // Warrior — physical
  { id: 'strike', name: 'Strike', icon: '⚔️', kind: 'attack', type: 'physical', dice: { count: 1, sides: 6 }, accuracy: 90, blurb: 'Reliable: 1d6 + power vs armor.' },
  { id: 'heavy', name: 'Heavy Blow', icon: '🔨', kind: 'attack', type: 'physical', dice: { count: 1, sides: 10 }, accuracy: 60, blurb: 'Big swing: 1d10 + power, often misses.' },
  { id: 'second-wind', name: 'Second Wind', icon: '💚', kind: 'heal', dice: { count: 1, sides: 8 }, bonus: 2, accuracy: 100, blurb: 'Recover 1d8 + 2 HP.' },
  // Mage — magic
  { id: 'firebolt', name: 'Firebolt', icon: '🔥', kind: 'attack', type: 'magic', dice: { count: 1, sides: 6 }, accuracy: 90, blurb: 'Reliable spell: 1d6 + power vs magic resist.' },
  { id: 'arcane-blast', name: 'Arcane Blast', icon: '💥', kind: 'attack', type: 'magic', dice: { count: 1, sides: 10 }, accuracy: 60, blurb: 'Big spell: 1d10 + power, often misses.' },
  { id: 'mend', name: 'Mend', icon: '✨', kind: 'heal', dice: { count: 1, sides: 8 }, bonus: 2, accuracy: 100, blurb: 'Weave 1d8 + 2 HP back together.' },
  // Rogue — physical, precise
  { id: 'quick-strike', name: 'Quick Strike', icon: '🗡️', kind: 'attack', type: 'physical', dice: { count: 1, sides: 6 }, accuracy: 95, blurb: 'Fast and sure: 1d6 + power vs armor.' },
  { id: 'backstab', name: 'Backstab', icon: '🔪', kind: 'attack', type: 'physical', dice: { count: 1, sides: 10 }, accuracy: 70, blurb: 'A well-placed 1d10 + power.' },
  // Shared
  { id: 'guard', name: 'Guard', icon: '🛡️', kind: 'defend', accuracy: 100, blurb: 'Halve damage taken this round.' },
  { id: 'flee', name: 'Flee', icon: '🏃', kind: 'flee', accuracy: 100, blurb: 'Escape back to the map.' },
];

const BY_ID = new Map<string, MoveDef>(MOVES.map((m) => [m.id, m]));

export function getMove(id: string): MoveDef | undefined {
  return BY_ID.get(id);
}

/** Human-readable dice formula for a move, e.g. "1d6 + power" or "1d8 + 2". */
export function moveFormula(move: MoveDef): string {
  if (!move.dice) return '';
  const dice = `${move.dice.count}d${move.dice.sides}`;
  if (move.kind === 'attack') return `${dice} + power`;
  return move.bonus ? `${dice} + ${move.bonus}` : dice;
}

/** Badge for an attack's damage type. */
export function damageTypeIcon(type: DamageType): string {
  return type === 'magic' ? '✨' : '🗡️';
}

/** Enemies keep a tight physical kit unless a preset overrides it. */
export const ENEMY_MOVES = ['strike', 'heavy', 'guard'];
