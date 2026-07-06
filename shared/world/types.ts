import type { GridMap, TerrainKind } from '../entities';

/**
 * Contract every world generator implements. Kept separate from the registry so
 * individual generators can import it without a circular dependency.
 */
export interface WorldConfig {
  seed: number;
  width: number;
  height: number;
}

export interface WorldGenerator {
  type: string;
  name: string;
  blurb: string;
  generate(config: WorldConfig): GridMap;
}

export const DEFAULT_WORLD_SIZE = { width: 18, height: 12 } as const;

const PASSABLE: Record<TerrainKind, boolean> = {
  wall: false,
  floor: true,
  grass: true,
  tree: false,
  water: false,
};

export function isPassable(terrain: TerrainKind): boolean {
  return PASSABLE[terrain];
}

export function tileAt(map: GridMap, x: number, y: number): TerrainKind {
  return map.tiles[y * map.width + x] ?? 'wall';
}
