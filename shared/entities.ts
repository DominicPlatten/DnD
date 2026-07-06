/**
 * Core domain entities. Framework-free: imported by both the PartyKit server
 * and the React client.
 */

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
 * effects and wards. STR/DEX/CON/INT/CHA keep their usual meaning.
 */
export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'mag' | 'cha';
export type Abilities = Record<AbilityKey, number>;

export type RaceId = string;

export interface Race {
  id: RaceId;
  name: string;
  blurb: string;
  abilityMods: Partial<Abilities>;
  speed: number;
}

export type ClassId = string;

export interface ClassDef {
  id: ClassId;
  name: string;
  icon: string;
  blurb: string;
  /** Which ability score is this class's primary stat (for flavour and character display). */
  primary: AbilityKey;
  /** Flat HP added on top of the CON-derived base, so martials are sturdier. */
  hpBonus: number;
}

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

/** A note added to a character when they collect a scene object. */
export interface NarrativeNote {
  sprite: string;
  label: string;
  text: string;
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
  abilities: Abilities;
  hp: number;
  maxHp: number;
  ac: number;
  speed: number;
  initiative: number;
  inventory: ItemStack[];
  notes: NarrativeNote[];
}

// ---- World & tokens ----------------------------------------------------------

export interface Coord {
  x: number;
  y: number;
}

export type TerrainKind = 'wall' | 'floor' | 'grass' | 'tree' | 'water';

export type WorldType = string;

export interface GridMap {
  worldType: WorldType;
  seed: number;
  width: number;
  height: number;
  tiles: TerrainKind[];
  spawnPoints: Coord[];
}

export type TokenId = string;
export type TokenKind = 'pc';

/** A player character placed on the grid during play. */
export interface Token {
  id: TokenId;
  kind: TokenKind;
  name: string;
  visual: CharacterVisual;
  coord: Coord;
  hp: number;
  maxHp: number;
  initiative: number;
  speed: number;
  statuses: string[];
  ownerId?: PlayerId;
}

/** Turn order for the current encounter. */
export interface Initiative {
  order: TokenId[];
  currentIndex: number;
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

// ---- Interactables & scene objects ------------------------------------------

export type InteractableKind = 'chest' | 'door';

/** A built-in world object players can use with their action (chest, door). */
export interface Interactable {
  id: string;
  kind: InteractableKind;
  coord: Coord;
  contents?: ItemStack[];
  looted?: boolean;
  open?: boolean;
  dc?: number;
}

/** A GM-placed scene object (prop, NPC, event marker, etc.). */
export interface SceneObject {
  id: string;
  sprite: string;
  label: string;
  coord: Coord;
  blocksMovement: boolean;
  collectible: boolean;
  /** Flavour text shown to players before they interact. Used as note text for collectibles. */
  description: string;
  /** Status effect ids to add/remove when a player interacts with this object. */
  statusEffects: { apply: string[]; remove: string[] };
}

/** Set when a player has interacted with a scene object and is waiting for GM narration. */
export interface PendingInteraction {
  objectId: string;
  playerId: PlayerId;
}
