import type {
  Character,
  CharId,
  DiceRoll,
  GridMap,
  Initiative,
  Interactable,
  PendingInteraction,
  Player,
  PlayerId,
  SceneObject,
  Token,
  TokenId,
  TurnResources,
} from './entities';

/**
 * The whole game is a state machine. Phases gate which commands are valid and
 * which screen each client shows.
 *   lobby   -> players join, roles assigned
 *   setup   -> GM picks a world, players build characters (parallel)
 *   playing -> turn tracker + GM controls
 *   ended   -> game over
 */
export type Phase = 'lobby' | 'setup' | 'playing' | 'ended';

/**
 * The single source of truth. Lives inside the room's Durable Object on the
 * server; clients hold a read-only mirror of the latest snapshot.
 */
export interface GameState {
  code: string;
  phase: Phase;
  gmId: PlayerId | null;
  players: Record<PlayerId, Player>;
  characters: Record<CharId, Character>;
  map: GridMap | null;
  tokens: Record<TokenId, Token>;
  initiative: Initiative | null;
  turn: TurnResources;
  interactables: Record<string, Interactable>;
  /** GM-placed scene objects (props, NPCs, event markers). */
  sceneObjects: Record<string, SceneObject>;
  /** Set when a player has interacted with a scene object; GM must narrate to clear it. */
  pendingInteraction: PendingInteraction | null;
  lastRoll: DiceRoll | null;
}

export function createInitialState(code: string): GameState {
  return {
    code,
    phase: 'lobby',
    gmId: null,
    players: {},
    characters: {},
    map: null,
    tokens: {},
    initiative: null,
    turn: { moved: false, acted: false },
    interactables: {},
    sceneObjects: {},
    pendingInteraction: null,
    lastRoll: null,
  };
}
