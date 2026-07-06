import { create } from 'zustand';
import type { GameState } from '@shared/state';
import type { PlayerId } from '@shared/entities';
import type { GameEvent } from '@shared/protocol/messages';

/**
 * Client-side mirror of the server's authoritative state, plus a little local
 * connection status and a rolling event log. The client never edits `state`
 * directly — it only replaces it with the latest snapshot from the server.
 */
interface GameStore {
  connected: boolean;
  you: PlayerId | null;
  state: GameState | null;
  log: GameEvent[];

  setConnected: (connected: boolean) => void;
  applySnapshot: (state: GameState, you?: PlayerId) => void;
  pushEvent: (event: GameEvent) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  you: null,
  state: null,
  log: [],

  setConnected: (connected) => set({ connected }),
  applySnapshot: (state, you) => set((prev) => ({ state, you: you ?? prev.you })),
  pushEvent: (event) => set((prev) => ({ log: [...prev.log, event].slice(-100) })),
  reset: () => set({ connected: false, you: null, state: null, log: [] }),
}));
