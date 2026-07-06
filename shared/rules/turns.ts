import type { Coord, GridMap, Initiative, Interactable, SceneObject, Token, TokenId } from '../entities';
import { makeRng, randInt } from '../world/rng';
import { isPassable, tileAt } from '../world/types';

/** A tile is blocked by a chest, or by a closed (but not open) door. */
export function objectBlocks(interactables: Record<string, Interactable>, x: number, y: number): boolean {
  return Object.values(interactables).some(
    (o) => o.coord.x === x && o.coord.y === y && (o.kind === 'chest' || (o.kind === 'door' && !o.open)),
  );
}

/** A tile is blocked by a scene object with blocksMovement set. */
export function sceneObjectBlocks(sceneObjects: Record<string, SceneObject>, x: number, y: number): boolean {
  return Object.values(sceneObjects).some((o) => o.coord.x === x && o.coord.y === y && o.blocksMovement);
}

/** Chebyshev distance — how "adjacent" two coords are (1 = touching). */
export function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Turn-order and movement rules. Pure and framework-free, like the rest of
 * `rules/` — the server applies them and the client reuses them (e.g. to show
 * which tiles are reachable).
 */

/** Roll d20 + initiative modifier for each token and sort high-to-low. */
export function rollInitiative(tokens: Record<TokenId, Token>, seed: number): Initiative {
  const rng = makeRng(seed);
  const rolled = Object.values(tokens).map((token) => ({
    id: token.id,
    total: randInt(rng, 1, 20) + token.initiative,
    mod: token.initiative,
  }));
  rolled.sort((a, b) => b.total - a.total || b.mod - a.mod || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { order: rolled.map((r) => r.id), currentIndex: 0, round: 1 };
}

export function currentTokenId(init: Initiative): TokenId | undefined {
  return init.order[init.currentIndex];
}

/** Advance to the next token that still exists, wrapping and bumping the round. */
export function advanceTurn(init: Initiative, tokens: Record<TokenId, Token>): Initiative {
  const n = init.order.length;
  if (n === 0) return init;
  let idx = init.currentIndex;
  let round = init.round;
  for (let step = 0; step < n; step++) {
    idx += 1;
    if (idx >= n) {
      idx = 0;
      round += 1;
    }
    const id = init.order[idx];
    if (id && tokens[id]) return { order: init.order, currentIndex: idx, round };
  }
  return { order: init.order, currentIndex: idx, round };
}

/** Remove a token from the turn order, keeping the pointer sensible. */
export function removeFromInitiative(init: Initiative, id: TokenId): Initiative | null {
  if (!init.order.includes(id)) return init;
  const removedIndex = init.order.indexOf(id);
  const order = init.order.filter((tid) => tid !== id);
  if (order.length === 0) return null;
  let currentIndex = init.currentIndex;
  if (removedIndex < currentIndex) currentIndex -= 1;
  if (currentIndex >= order.length) currentIndex = 0;
  return { ...init, order, currentIndex };
}

/** How many tiles a token can cross in one move (5 ft per tile). */
export function moveRange(token: Token): number {
  return Math.max(1, Math.floor(token.speed / 5));
}

export interface MoveOptions {
  /** GM moves ignore range; player moves are limited to the token's speed. */
  enforceRange: boolean;
}

/** Returns an error message if the move is illegal, or null if it's allowed. */
export function checkMove(
  map: GridMap,
  tokens: Record<TokenId, Token>,
  interactables: Record<string, Interactable>,
  sceneObjects: Record<string, SceneObject>,
  tokenId: TokenId,
  to: Coord,
  opts: MoveOptions,
): string | null {
  const token = tokens[tokenId];
  if (!token) return 'No such token.';
  if (to.x < 0 || to.y < 0 || to.x >= map.width || to.y >= map.height) return 'That is off the map.';
  if (!isPassable(tileAt(map, to.x, to.y))) return 'That tile is blocked.';
  if (objectBlocks(interactables, to.x, to.y)) return 'Something is in the way.';
  if (sceneObjectBlocks(sceneObjects, to.x, to.y)) return 'Something is in the way.';
  const occupied = Object.values(tokens).some(
    (t) => t.id !== tokenId && t.coord.x === to.x && t.coord.y === to.y,
  );
  if (occupied) return 'Someone is already there.';
  if (opts.enforceRange && chebyshev(token.coord, to) > moveRange(token)) {
    return 'That is too far for one move.';
  }
  return null;
}
