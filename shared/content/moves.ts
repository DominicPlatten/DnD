/**
 * Battle moves. A data-driven registry — adding a move is a new entry here plus
 * (optionally) handling its `kind` in the battle resolver. Powers/accuracy are
 * deliberately simple and easy to tune.
 */
export type MoveKind = 'attack' | 'defend' | 'heal' | 'flee';

export interface MoveDef {
  id: string;
  name: string;
  icon: string;
  kind: MoveKind;
  /** Damage (attack) or HP restored (heal); ignored otherwise. */
  power: number;
  /** Percent chance to land, for attacks. */
  accuracy: number;
  blurb: string;
}

export const MOVES: readonly MoveDef[] = [
  { id: 'strike', name: 'Strike', icon: '⚔️', kind: 'attack', power: 6, accuracy: 90, blurb: 'A reliable hit.' },
  { id: 'heavy', name: 'Heavy Blow', icon: '🔨', kind: 'attack', power: 11, accuracy: 60, blurb: 'Big damage, often misses.' },
  { id: 'guard', name: 'Guard', icon: '🛡️', kind: 'defend', power: 0, accuracy: 100, blurb: 'Halve damage taken this round.' },
  { id: 'second-wind', name: 'Second Wind', icon: '💚', kind: 'heal', power: 8, accuracy: 100, blurb: 'Recover some HP.' },
  { id: 'flee', name: 'Flee', icon: '🏃', kind: 'flee', power: 0, accuracy: 100, blurb: 'Escape back to the map.' },
];

const BY_ID = new Map<string, MoveDef>(MOVES.map((m) => [m.id, m]));

export function getMove(id: string): MoveDef | undefined {
  return BY_ID.get(id);
}

/** Default menus. Enemies keep a tighter kit (no heal/flee) unless overridden. */
export const PARTY_MOVES = ['strike', 'heavy', 'guard', 'second-wind', 'flee'];
export const ENEMY_MOVES = ['strike', 'heavy', 'guard'];
