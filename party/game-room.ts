import type * as Party from 'partykit/server';
import { createInitialState, type GameState } from '../shared/state';
import { CommandSchema } from '../shared/protocol/commands';
import type { GameEvent, ServerMessage } from '../shared/protocol/messages';
import type { PlayerId } from '../shared/entities';
import { applyCommand, markOffline } from '../shared/rules/reducer';

const STORAGE_KEY = 'state';

/**
 * One instance of this class exists per game code (PartyKit gives each room its
 * own isolated Durable Object). It owns the authoritative GameState and is the
 * only place state is mutated:
 *
 *   client --Command--> onMessage --validate--> applyCommand --> broadcast snapshot
 *
 * State is persisted to Durable Object storage after every change and reloaded
 * in `onStart`, so it survives the DO hibernating/evicting — a room can be left
 * and rejoined, and a refresh reconnects to the game in progress.
 *
 * Note: imports use relative paths (not the `@shared` alias) because the
 * PartyKit bundler resolves this entry independently of Vite.
 */
export default class GameRoom implements Party.Server {
  private state: GameState;

  constructor(readonly room: Party.Room) {
    this.state = createInitialState(room.id);
  }

  async onStart() {
    const saved = await this.room.storage.get<GameState>(STORAGE_KEY);
    // Merge over a fresh state so any fields added since the save are present.
    if (saved) this.state = { ...createInitialState(this.room.id), ...saved };
  }

  onConnect(conn: Party.Connection) {
    // Tell the newcomer who they are + the current state. `you` is only sent here.
    this.sendTo(conn, { t: 'snapshot', state: this.state, you: conn.id });
  }

  async onMessage(raw: string, sender: Party.Connection) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.sendTo(sender, { t: 'error', message: 'Malformed message.' });
    }

    const result = CommandSchema.safeParse(parsed);
    if (!result.success) {
      return this.sendTo(sender, { t: 'error', message: 'Unrecognized command.' });
    }

    const { state, events, error, targeted } = applyCommand(this.state, result.data, {
      id: sender.id,
      random: Math.random(),
    });
    if (error) {
      return this.sendTo(sender, { t: 'error', message: error });
    }

    await this.commit(state);
    events.forEach((event) => this.broadcastEvent(event));
    targeted?.forEach(({ playerId, message }) => this.sendToPlayerId(playerId, message));
  }

  async onClose(conn: Party.Connection) {
    // A dropped connection keeps the player (marked offline) so they can rejoin.
    const { state } = markOffline(this.state, conn.id);
    await this.commit(state);
  }

  /** Persist the new state, then broadcast it to everyone. */
  private async commit(state: GameState) {
    this.state = state;
    await this.room.storage.put(STORAGE_KEY, state);
    this.broadcastSnapshot();
  }

  private broadcastSnapshot() {
    this.broadcast({ t: 'snapshot', state: this.state });
  }

  private broadcastEvent(event: GameEvent) {
    this.broadcast({ t: 'event', event });
  }

  private broadcast(message: ServerMessage) {
    this.room.broadcast(JSON.stringify(message));
  }

  private sendTo(conn: Party.Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }

  private sendToPlayerId(playerId: PlayerId, message: ServerMessage) {
    for (const conn of this.room.getConnections()) {
      if (conn.id === playerId) {
        conn.send(JSON.stringify(message));
        return;
      }
    }
  }
}
