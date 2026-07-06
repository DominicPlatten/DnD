import type {
  Battle,
  Character,
  CharId,
  DiceRoll,
  GridMap,
  Initiative,
  Interactable,
  Player,
  PlayerId,
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
  /** Chosen by the GM during setup; null until then. */
  map: GridMap | null;
  /** On-grid entities during play (PC and enemy tokens). */
  tokens: Record<TokenId, Token>;
  /** Turn order once the adventure starts; null before then. */
  initiative: Initiative | null;
  /** What the current actor has spent this turn (one move + one action). */
  turn: TurnResources;
  /** Objects on the grid players can interact with (chests, doors). */
  interactables: Record<string, Interactable>;
  /** The latest dice roll, shown to everyone; null until the first roll. */
  lastRoll: DiceRoll | null;
  /** The active encounter; when set, the board pauses and everyone watches. */
  battle: Battle | null;
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
    lastRoll: null,
    battle: null,
  };
}
