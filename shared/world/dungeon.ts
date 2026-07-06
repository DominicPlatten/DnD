import type { Coord, GridMap, TerrainKind } from '../entities';
import type { WorldConfig, WorldGenerator } from './types';
import { makeRng, randInt } from './rng';

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

function center(room: Room): Coord {
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

function overlaps(a: Room, b: Room, pad: number): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

/** Classic rooms-and-corridors dungeon carved out of solid rock. */
function generate({ seed, width, height }: WorldConfig): GridMap {
  const rng = makeRng(seed);
  const tiles = new Array<TerrainKind>(width * height).fill('wall');
  const set = (x: number, y: number) => {
    tiles[y * width + x] = 'floor';
  };
  const carveH = (x1: number, x2: number, y: number) => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) set(x, y);
  };
  const carveV = (y1: number, y2: number, x: number) => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) set(x, y);
  };

  const rooms: Room[] = [];
  for (let i = 0; i < 24; i++) {
    const w = randInt(rng, 3, 6);
    const h = randInt(rng, 3, 5);
    const x = randInt(rng, 1, width - w - 1);
    const y = randInt(rng, 1, height - h - 1);
    const room = { x, y, w, h };
    if (rooms.some((r) => overlaps(r, room, 1))) continue;
    rooms.push(room);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy);
  }

  // Connect each room to the previous one with an L-shaped corridor.
  for (let i = 1; i < rooms.length; i++) {
    const a = center(rooms[i - 1]!);
    const b = center(rooms[i]!);
    carveH(a.x, b.x, a.y);
    carveV(a.y, b.y, b.x);
  }

  const spawnPoints: Coord[] = [];
  const first = rooms[0];
  if (first) {
    for (let yy = first.y; yy < first.y + first.h && spawnPoints.length < 6; yy++) {
      for (let xx = first.x; xx < first.x + first.w && spawnPoints.length < 6; xx++) {
        spawnPoints.push({ x: xx, y: yy });
      }
    }
  } else {
    set(1, 1);
    spawnPoints.push({ x: 1, y: 1 });
  }

  return { worldType: 'dungeon', seed, width, height, tiles, spawnPoints };
}

export const dungeonGenerator: WorldGenerator = {
  type: 'dungeon',
  name: 'Forgotten Dungeon',
  blurb: 'Stone rooms and twisting corridors deep underground.',
  generate,
};
