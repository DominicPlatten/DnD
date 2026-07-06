import { describe, it, expect } from 'vitest';
import { WORLD_GENERATORS, getGenerator } from './registry';
import { DEFAULT_WORLD_SIZE, isPassable, tileAt } from './types';

const config = { seed: 12345, ...DEFAULT_WORLD_SIZE };

describe('world generators', () => {
  for (const generator of WORLD_GENERATORS) {
    describe(generator.name, () => {
      it('produces a fully-sized tile grid', () => {
        const map = generator.generate(config);
        expect(map.tiles).toHaveLength(map.width * map.height);
        expect(map.width).toBe(DEFAULT_WORLD_SIZE.width);
      });

      it('is deterministic for a given seed', () => {
        const a = generator.generate(config);
        const b = generator.generate(config);
        expect(b.tiles).toEqual(a.tiles);
        expect(b.spawnPoints).toEqual(a.spawnPoints);
      });

      it('differs for a different seed', () => {
        const a = generator.generate(config);
        const b = generator.generate({ ...config, seed: 999 });
        expect(b.tiles).not.toEqual(a.tiles);
      });

      it('places spawn points on passable, in-bounds tiles', () => {
        const map = generator.generate(config);
        expect(map.spawnPoints.length).toBeGreaterThan(0);
        for (const { x, y } of map.spawnPoints) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(map.width);
          expect(y).toBeLessThan(map.height);
          expect(isPassable(tileAt(map, x, y))).toBe(true);
        }
      });
    });
  }

  it('looks up generators by type', () => {
    expect(getGenerator('dungeon')?.type).toBe('dungeon');
    expect(getGenerator('nope')).toBeUndefined();
  });
});
