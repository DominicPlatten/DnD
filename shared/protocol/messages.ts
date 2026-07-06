import type { GameState } from '../state';
import type { PlayerId } from '../entities';

/**
 * Transient things that happen (as opposed to durable state): join/leave
 * notices, later dice rolls, floating damage numbers, chat. Clients keep a
 * short rolling log of these; they are NOT the source of truth.
 */
export type GameEvent =
  | { t: 'playerJoined'; name: string }
  | { t: 'playerLeft'; name: string }
  | { t: 'characterReady'; name: string }
  | { t: 'worldChosen'; worldName: string }
  | { t: 'enemySpawned'; name: string }
  | { t: 'itemGiven'; item: string; to: string }
  | { t: 'diceRolled'; sides: number; value: number; by: string }
  | { t: 'chestOpened'; by: string; items: string[] }
  | { t: 'doorToggled'; open: boolean }
  | { t: 'lockAttempt'; by: string; target: 'chest' | 'door'; success: boolean; roll: number; total: number; dc: number }
  | { t: 'greeted'; from: string; to: string }
  | { t: 'battleStarted'; foe: string }
  | { t: 'battleEnded'; outcome: string }
  | { t: 'phaseChanged'; phase: string };

/**
 * Everything the server can send a client.
 * - snapshot: the full authoritative state. `you` is only sent on a client's
 *   first snapshot so it can learn its own id; broadcasts omit it.
 * - event: a transient GameEvent to append to the log.
 * - error: a rejected command (bad input or permission denied).
 */
export type ServerMessage =
  | { t: 'snapshot'; state: GameState; you?: PlayerId }
  | { t: 'event'; event: GameEvent }
  | { t: 'error'; message: string };
