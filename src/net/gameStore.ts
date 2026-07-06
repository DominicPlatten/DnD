import { create } from 'zustand';
import type { GameState } from '@shared/state';
import type { PlayerId } from '@shared/entities';
import type { GameEvent } from '@shared/protocol/messages';

interface PendingNarration {
  sprite: string;
  label: string;
  text: string;
}

/**
 * Client-side mirror of the server's authoritative state, plus connection
 * status, a rolling event log, and any private narration the player received.
 */
interface GameStore {
  connected: boolean;
  you: PlayerId | null;
  state: GameState | null;
  log: GameEvent[];
  pendingNarration: PendingNarration | null;

  setConnected: (connected: boolean) => void;
  applySnapshot: (state: GameState, you?: PlayerId) => void;
  pushEvent: (event: GameEvent) => void;
  setPendingNarration: (n: PendingNarration) => void;
  clearNarration: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  you: null,
  state: null,
  log: [],
  pendingNarration: null,

  setConnected: (connected) => set({ connected }),
  applySnapshot: (state, you) => set((prev) => ({ state, you: you ?? prev.you })),
  pushEvent: (event) => set((prev) => ({ log: [...prev.log, event].slice(-100) })),
  setPendingNarration: (pendingNarration) => set({ pendingNarration }),
  clearNarration: () => set({ pendingNarration: null }),
  reset: () => set({ connected: false, you: null, state: null, log: [], pendingNarration: null }),
}));
