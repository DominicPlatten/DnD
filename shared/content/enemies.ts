/** Bestiary presets the GM can spawn onto the grid. */
export interface EnemyDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  maxHp: number;
  initiative: number;
  speed: number;
  /** Physical attack power (enemies fight physically for now). */
  attack: number;
  /** Reduces incoming PHYSICAL damage (Warrior/Rogue). */
  armor: number;
  /** Reduces incoming MAGIC damage (Mage). */
  magicResist: number;
}

/**
 * Attack values are low on purpose — battle damage is a dice roll PLUS stats and
 * PCs only have ~10–16 HP. Armor vs magic resist is the interesting axis: a
 * Skeleton laughs off steel (armor) but burns to spells, while a Zombie shrugs
 * off magic but not a good blade. So which class "clears" a foe cheaply varies.
 */
export const ENEMIES: readonly EnemyDef[] = [
  { id: 'goblin', name: 'Goblin', icon: '👺', color: '#4d7c0f', maxHp: 7, initiative: 2, speed: 30, attack: 0, armor: 0, magicResist: 0 },
  { id: 'wolf', name: 'Wolf', icon: '🐺', color: '#6b7280', maxHp: 11, initiative: 2, speed: 40, attack: 1, armor: 0, magicResist: 0 },
  { id: 'skeleton', name: 'Skeleton', icon: '💀', color: '#d1d5db', maxHp: 13, initiative: 2, speed: 30, attack: 1, armor: 3, magicResist: 0 },
  { id: 'bandit', name: 'Bandit', icon: '🗡️', color: '#7c2d12', maxHp: 11, initiative: 1, speed: 30, attack: 1, armor: 1, magicResist: 0 },
  { id: 'orc', name: 'Orc', icon: '👹', color: '#166534', maxHp: 15, initiative: 1, speed: 30, attack: 2, armor: 2, magicResist: 1 },
  { id: 'zombie', name: 'Zombie', icon: '🧟', color: '#3f6212', maxHp: 22, initiative: -2, speed: 20, attack: 1, armor: 0, magicResist: 3 },
  { id: 'spider', name: 'Giant Spider', icon: '🕷️', color: '#3730a3', maxHp: 26, initiative: 3, speed: 30, attack: 2, armor: 1, magicResist: 2 },
  { id: 'wyrmling', name: 'Dragon Wyrmling', icon: '🐉', color: '#b91c1c', maxHp: 33, initiative: 0, speed: 30, attack: 3, armor: 2, magicResist: 2 },
];

const BY_ID = new Map<string, EnemyDef>(ENEMIES.map((e) => [e.id, e]));

export function getEnemy(id: string): EnemyDef | undefined {
  return BY_ID.get(id);
}

// ---- Difficulty tiers --------------------------------------------------------

/** How strong a spawned enemy is. The GM picks this so encounters can ramp up. */
export type EnemyTier = 'weak' | 'normal' | 'elite' | 'boss';

export interface EnemyTierDef {
  id: EnemyTier;
  label: string;
  /** Small badge shown on the board for non-normal tiers. */
  badge: string;
  hpMult: number;
  attackDelta: number;
  /** Added to BOTH armor and magic resist. */
  defenseDelta: number;
}

export const ENEMY_TIERS: readonly EnemyTierDef[] = [
  { id: 'weak', label: 'Weak', badge: '▽', hpMult: 0.5, attackDelta: -1, defenseDelta: 0 },
  { id: 'normal', label: 'Normal', badge: '', hpMult: 1, attackDelta: 0, defenseDelta: 0 },
  { id: 'elite', label: 'Elite', badge: '★', hpMult: 1.6, attackDelta: 1, defenseDelta: 1 },
  { id: 'boss', label: 'Boss', badge: '👑', hpMult: 2.2, attackDelta: 2, defenseDelta: 2 },
];

const TIER_BY_ID = new Map<EnemyTier, EnemyTierDef>(ENEMY_TIERS.map((t) => [t.id, t]));

export function getTier(id: EnemyTier): EnemyTierDef {
  return TIER_BY_ID.get(id) ?? ENEMY_TIERS[1]!; // default to Normal
}

export interface ScaledEnemy {
  name: string;
  maxHp: number;
  attack: number;
  armor: number;
  magicResist: number;
  tier: EnemyTier;
}

/** Apply a tier to a bestiary preset, clamping stats to sensible floors. */
export function scaleEnemy(def: EnemyDef, tierId: EnemyTier): ScaledEnemy {
  const tier = getTier(tierId);
  return {
    name: tierId === 'normal' ? def.name : `${tier.label} ${def.name}`,
    maxHp: Math.max(1, Math.round(def.maxHp * tier.hpMult)),
    attack: Math.max(0, def.attack + tier.attackDelta),
    armor: Math.max(0, def.armor + tier.defenseDelta),
    magicResist: Math.max(0, def.magicResist + tier.defenseDelta),
    tier: tierId,
  };
}
