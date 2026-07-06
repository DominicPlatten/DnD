import type { Coord, GridMap, TerrainKind } from '../entities';
import type { WorldConfig, WorldGenerator } from './types';
import { makeRng } from './rng';

/** Open woodland: grass scattered with impassable trees and the odd pond. */
function generate({ seed, width, height }: WorldConfig): GridMap {
  const rng = makeRng(seed);
  const tiles = new Array<TerrainKind>(width * height).fill('grass');
  const set = (x: number, y: number, t: TerrainKind) => {
    tiles[y * width + x] = t;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = rng();
      if (r < 0.18) set(x, y, 'tree');
      else if (r < 0.22) set(x, y, 'water');
    }
  }

  // Carve a clearing in the middle for the party to start in.
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const spawnPoints: Coord[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      set(x, y, 'grass');
      if (spawnPoints.length < 6) spawnPoints.push({ x, y });
    }
  }

  return { worldType: 'forest', seed, width, height, tiles, spawnPoints };
}

export const forestGenerator: WorldGenerator = {
  type: 'forest',
  name: 'Whispering Forest',
  blurb: 'Sunlit glades, ancient trees, and hidden pools.',
  generate,
};
