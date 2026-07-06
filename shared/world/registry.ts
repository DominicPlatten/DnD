import type { WorldGenerator } from './types';
import { dungeonGenerator } from './dungeon';
import { forestGenerator } from './forest';

/**
 * The catalogue of world types. Adding a world = write a generator and drop it
 * in here; nothing else in the codebase changes.
 */
export const WORLD_GENERATORS: readonly WorldGenerator[] = [dungeonGenerator, forestGenerator];

const BY_TYPE = new Map<string, WorldGenerator>(WORLD_GENERATORS.map((g) => [g.type, g]));

export function getGenerator(type: string): WorldGenerator | undefined {
  return BY_TYPE.get(type);
}
