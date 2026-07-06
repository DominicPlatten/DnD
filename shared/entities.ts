/**
 * Core domain entities. Framework-free: imported by both the PartyKit server
 * and the React client. Phase 0 only needs players; characters, tokens, maps,
 * enemies and items get added here in later phases.
 */
import type { EnemyTier } from './content/enemies';

export type PlayerId = string;

export type Role = 'gm' | 'player';

export interface Player {
  id: PlayerId;
  name: string;
  role: Role;
  connected: boolean;
}

// ---- Characters --------------------------------------------------------------

/**
 * The six abilities. `mag` (Magic) replaces classic Wisdom: it powers magical
 * attacks and wards. STR/DEX/CON/INT/CHA keep their usual meaning.
 */
export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'mag' | 'cha';
export type Abilities = Record<AbilityKey, number>;

export type RaceId = string;

export interface Race {
  id: RaceId;
  name: string;
  blurb: string;
  /** Added on top of the player's point-buy base scores. */
  abilityMods: Partial<Abilities>;
  speed: number;
}

export type ClassId = string;

/**
 * A character class: its move kit and which ability powers its attacks. The
 * registry lives in content/classes; the reducer validates the chosen id.
 */
export interface ClassDef {
  id: ClassId;
  name: string;
  icon: string;
  blurb: string;
  /** Ability whose modifier scales this class's attack/heal strength in battle. */
  primary: AbilityKey;
  /** Whether this class's attacks are resisted by armor (physical) or magic resist (magic). */
  damageType: DamageType;
  /** Battle move kit (ids into content/moves). */
  moves: string[];
  /** Flat HP added on top of the CON-derived base, so martials are sturdier. */
  hpBonus: number;
}

/** Physical damage is reduced by armor; magic damage by magic resist. */
export type DamageType = 'physical' | 'magic';

/** A token's look: a color + an emoji, both chosen from preset sets. */
export interface CharacterVisual {
  color: string;
  icon: string;
}

/** One character per player for now, so a character's id is its owner's id. */
export type CharId = PlayerId;

/** A stack of a carried item. */
export interface ItemStack {
  itemId: string;
  qty: number;
}

/** What a client submits to create/update their character (pre-racial scores). */
export interface CharacterDraft {
  name: string;
  raceId: RaceId;
  classId: ClassId;
  visual: CharacterVisual;
  baseAbilities: Abilities;
}

/** A finalized character living in the authoritative game state. */
export interface Character {
  id: CharId;
  ownerId: PlayerId;
  name: string;
  raceId: RaceId;
  classId: ClassId;
  visual: CharacterVisual;
  level: number;
  /** Final scores: point-buy base + racial mods. */
  abilities: Abilities;
  hp: number;
  maxHp: number;
  ac: number;
  speed: number;
  initiative: number;
  inventory: ItemStack[];
}

// ---- World & tokens ----------------------------------------------------------

export interface Coord {
  x: number;
  y: number;
}

export type TerrainKind = 'wall' | 'floor' | 'grass' | 'tree' | 'water';

/** Open string so new world types are just a new generator, no type change. */
export type WorldType = string;

export interface GridMap {
  worldType: WorldType;
  seed: number;
  width: number;
  height: number;
  /** Row-major terrain, length = width * height. */
  tiles: TerrainKind[];
  /** Where player tokens are placed when the adventure starts. */
  spawnPoints: Coord[];
}

export type TokenId = string;
export type TokenKind = 'pc' | 'enemy';

/** An entity placed on the grid during play. PC tokens mirror a character. */
export interface Token {
  id: TokenId;
  kind: TokenKind;
  name: string;
  visual: CharacterVisual;
  coord: Coord;
  hp: number;
  maxHp: number;
  /** Initiative modifier, used to roll turn order. */
  initiative: number;
  /** Movement speed in feet (5 ft per tile). */
  speed: number;
  /** Active status-condition ids (see content/statuses). */
  statuses: string[];
  ownerId?: PlayerId;
  /** For enemy tokens: which bestiary preset they came from (battle stats). */
  enemyId?: string;
  /** Enemy combat stats after tier scaling (set at spawn). PCs derive theirs from abilities. */
  attack?: number;
  /** Physical damage reduction (enemies). */
  armor?: number;
  /** Magic damage reduction (enemies). */
  magicResist?: number;
  /** Difficulty tier of a spawned enemy; drives the board badge. */
  tier?: EnemyTier;
}

/** Turn order for the current encounter. */
export interface Initiative {
  /** Token ids from first to last to act. */
  order: TokenId[];
  /** Index into `order` of the token whose turn it is. */
  currentIndex: number;
  /** 1-based round counter. */
  round: number;
}

/** What the current actor has spent this turn: one move + one action. */
export interface TurnResources {
  moved: boolean;
  acted: boolean;
}

/** The most recent dice roll, shown to everyone. `seq` makes repeats distinct. */
export interface DiceRoll {
  sides: number;
  value: number;
  by: string;
  seq: number;
}

// ---- Interactable world objects ----------------------------------------------

// ---- Battle (Pokémon-style encounter) ----------------------------------------

/** One fighter in a battle. Sides are arrays so party/duo fights expand later. */
export interface Combatant {
  id: string;
  tokenId: TokenId;
  side: 'party' | 'foe';
  name: string;
  visual: CharacterVisual;
  hp: number;
  maxHp: number;
  speed: number;
  /** Offensive modifier added to a move's dice (the class's primary-stat mod for PCs). */
  power: number;
  /** Physical damage reduction. */
  armor: number;
  /** Magic damage reduction. */
  magicResist: number;
  /** True for the round in which this fighter chose Guard. */
  guarding: boolean;
  /** Which player picks this fighter's moves; undefined = AI-controlled. */
  controllerId?: PlayerId;
  moves: string[];
}

export interface Battle {
  id: string;
  combatants: Record<string, Combatant>;
  round: number;
  phase: 'choosing' | 'over';
  /** combatantId -> chosen moveId for the round being assembled. */
  pending: Record<string, string>;
  log: string[];
  /** Seed for deterministic resolution (accuracy rolls, AI). */
  seed: number;
  winner?: 'party' | 'foe';
  fled?: boolean;
}

export type InteractableKind = 'chest' | 'door';

/** A thing on the grid a player can use with their action (chest, door, ...). */
export interface Interactable {
  id: string;
  kind: InteractableKind;
  coord: Coord;
  /** chest: loot inside, and whether it's been taken. */
  contents?: ItemStack[];
  looted?: boolean;
  /** door: whether it's open (open doors are passable). */
  open?: boolean;
  /** Lock difficulty: an INT check (d20 + INT mod) must meet this to open. 0/undefined = unlocked. */
  dc?: number;
}
