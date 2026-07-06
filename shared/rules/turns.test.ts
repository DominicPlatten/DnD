import { describe, it, expect } from 'vitest';
import type { GridMap, Token, TokenId } from '../entities';
import { advanceTurn, checkMove, currentTokenId, rollInitiative } from './turns';

const token = (id: string, partial: Partial<Token> = {}): Token => ({
  id,
  kind: 'pc',
  name: id,
  visual: { color: '#fff', icon: '⚔️' },
  coord: { x: 0, y: 0 },
  hp: 10,
  maxHp: 10,
  initiative: 0,
  speed: 30,
  statuses: [],
  ...partial,
});

const asRecord = (...tokens: Token[]): Record<TokenId, Token> =>
  Object.fromEntries(tokens.map((t) => [t.id, t]));

// A tiny 3x1 map: floor, wall, floor.
const map: GridMap = {
  worldType: 'test',
  seed: 1,
  width: 3,
  height: 1,
  tiles: ['floor', 'wall', 'floor'],
  spawnPoints: [{ x: 0, y: 0 }],
};

describe('rollInitiative', () => {
  it('is deterministic and orders every token', () => {
    const tokens = asRecord(token('a', { initiative: 2 }), token('b', { initiative: 0 }), token('c', { initiative: 5 }));
    const a = rollInitiative(tokens, 123);
    const b = rollInitiative(tokens, 123);
    expect(a.order).toEqual(b.order);
    expect([...a.order].sort()).toEqual(['a', 'b', 'c']);
    expect(a.currentIndex).toBe(0);
    expect(a.round).toBe(1);
  });
});

describe('advanceTurn', () => {
  const tokens = asRecord(token('a'), token('b'), token('c'));
  const init = { order: ['a', 'b', 'c'], currentIndex: 0, round: 1 };

  it('moves to the next token', () => {
    expect(advanceTurn(init, tokens).currentIndex).toBe(1);
  });

  it('wraps around and increments the round', () => {
    const last = { order: ['a', 'b', 'c'], currentIndex: 2, round: 1 };
    const next = advanceTurn(last, tokens);
    expect(next.currentIndex).toBe(0);
    expect(next.round).toBe(2);
  });

  it('skips tokens that no longer exist', () => {
    const missingB = asRecord(token('a'), token('c'));
    expect(advanceTurn(init, missingB).currentIndex).toBe(2); // skips b -> c
  });
});

describe('checkMove', () => {
  const tokens = asRecord(token('a', { coord: { x: 0, y: 0 }, speed: 10 }), token('b', { coord: { x: 2, y: 0 } }));

  it('reports a blocked (wall) tile', () => {
    expect(checkMove(map, tokens, {}, {}, 'a', { x: 1, y: 0 }, { enforceRange: true })).toBe('That tile is blocked.');
  });

  it('rejects out-of-bounds and occupied tiles', () => {
    expect(checkMove(map, tokens, {}, {}, 'a', { x: 3, y: 0 }, { enforceRange: true })).toMatch(/off the map/);
    expect(checkMove(map, tokens, {}, {}, 'a', { x: 2, y: 0 }, { enforceRange: false })).toMatch(/already there/);
  });

  it('blocks a tile occupied by a closed door but not an open one', () => {
    const solo = asRecord(token('a', { coord: { x: 0, y: 0 } }));
    const closed = { d: { id: 'd', kind: 'door' as const, coord: { x: 2, y: 0 }, open: false } };
    const open = { d: { id: 'd', kind: 'door' as const, coord: { x: 2, y: 0 }, open: true } };
    expect(checkMove(map, solo, closed, {}, 'a', { x: 2, y: 0 }, { enforceRange: false })).toMatch(/in the way/);
    expect(checkMove(map, solo, open, {}, 'a', { x: 2, y: 0 }, { enforceRange: false })).toBeNull();
  });

  it('enforces range only when asked', () => {
    const far = asRecord(token('a', { coord: { x: 0, y: 0 }, speed: 5 })); // range 1
    expect(checkMove(map, far, {}, {}, 'a', { x: 2, y: 0 }, { enforceRange: true })).toMatch(/too far/);
    expect(checkMove(map, far, {}, {}, 'a', { x: 2, y: 0 }, { enforceRange: false })).toBeNull();
  });

  it('reports the current token', () => {
    expect(currentTokenId({ order: ['a', 'b'], currentIndex: 1, round: 1 })).toBe('b');
  });
});
