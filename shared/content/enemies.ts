/** Bestiary presets the GM can spawn onto the grid. */
export interface EnemyDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  maxHp: number;
  initiative: number;
  speed: number;
  /** Battle combat stats. */
  attack: number;
  defense: number;
}

export const ENEMIES: readonly EnemyDef[] = [
  { id: 'goblin', name: 'Goblin', icon: '👺', color: '#4d7c0f', maxHp: 7, initiative: 2, speed: 30, attack: 2, defense: 0 },
  { id: 'wolf', name: 'Wolf', icon: '🐺', color: '#6b7280', maxHp: 11, initiative: 2, speed: 40, attack: 3, defense: 0 },
  { id: 'skeleton', name: 'Skeleton', icon: '💀', color: '#d1d5db', maxHp: 13, initiative: 2, speed: 30, attack: 3, defense: 1 },
  { id: 'bandit', name: 'Bandit', icon: '🗡️', color: '#7c2d12', maxHp: 11, initiative: 1, speed: 30, attack: 3, defense: 1 },
  { id: 'orc', name: 'Orc', icon: '👹', color: '#166534', maxHp: 15, initiative: 1, speed: 30, attack: 4, defense: 1 },
  { id: 'zombie', name: 'Zombie', icon: '🧟', color: '#3f6212', maxHp: 22, initiative: -2, speed: 20, attack: 3, defense: 0 },
  { id: 'spider', name: 'Giant Spider', icon: '🕷️', color: '#3730a3', maxHp: 26, initiative: 3, speed: 30, attack: 4, defense: 2 },
  { id: 'wyrmling', name: 'Dragon Wyrmling', icon: '🐉', color: '#b91c1c', maxHp: 33, initiative: 0, speed: 30, attack: 6, defense: 3 },
];

const BY_ID = new Map<string, EnemyDef>(ENEMIES.map((e) => [e.id, e]));

export function getEnemy(id: string): EnemyDef | undefined {
  return BY_ID.get(id);
}
