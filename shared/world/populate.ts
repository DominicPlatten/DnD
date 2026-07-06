import type { Coord, GridMap, Interactable, ItemStack } from '../entities';
import { ITEMS } from '../content/items';
import { makeRng, randInt } from './rng';
import { isPassable, tileAt } from './types';

/**
 * Scatter a few interactable objects (loot chests + a door) onto passable tiles,
 * avoiding tiles that are already occupied. Deterministic given the seed.
 */
export function placeInteractables(
  map: GridMap,
  occupied: Coord[],
  seed: number,
): Record<string, Interactable> {
  const rng = makeRng(seed);
  const taken = new Set(occupied.map((c) => `${c.x},${c.y}`));

  const free: Coord[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (isPassable(tileAt(map, x, y)) && !taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }

  const take = (): Coord | null => {
    if (free.length === 0) return null;
    const [picked] = free.splice(Math.floor(rng() * free.length), 1);
    return picked ?? null;
  };

  const lootStack = (): ItemStack => ({
    itemId: ITEMS[randInt(rng, 0, ITEMS.length - 1)]!.id,
    qty: 1,
  });

  const result: Record<string, Interactable> = {};

  for (let i = 0; i < 2; i++) {
    const coord = take();
    if (!coord) break;
    result[`chest-${i}`] = {
      id: `chest-${i}`,
      kind: 'chest',
      coord,
      contents: [lootStack(), lootStack()],
      looted: false,
    };
  }

  const doorCoord = take();
  if (doorCoord) {
    result['door-0'] = { id: 'door-0', kind: 'door', coord: doorCoord, open: false };
  }

  return result;
}
