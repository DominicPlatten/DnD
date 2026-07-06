import { useGameSocket } from './net/useGameSocket';
import { useGameStore } from './net/gameStore';
import { LobbyScreen } from './screens/LobbyScreen';
import { CharacterCreateScreen } from './screens/CharacterCreateScreen';
import { SetupScreen } from './screens/SetupScreen';
import { PlayScreen } from './screens/PlayScreen';
import type { Session } from './App';

/**
 * Holds the live socket for the session and routes to the right screen based on
 * the current game phase (and whether this client is the GM). Later phases
 * (world play, turn tracker) become new cases here.
 */
export function GameRoot({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const { send } = useGameSocket(session.code, session.name);
  const state = useGameStore((s) => s.state);
  const you = useGameStore((s) => s.you);
  const connected = useGameStore((s) => s.connected);

  // Leaving on purpose: tell the server to remove us (not just mark offline).
  const handleLeave = () => {
    send({ t: 'leave' });
    onLeave();
  };

  if (!connected || !state) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        Connecting to room {session.code}…
      </div>
    );
  }

  const isGm = you !== null && you === state.gmId;

  switch (state.phase) {
    case 'setup':
      return isGm ? (
        <SetupScreen send={send} onLeave={handleLeave} />
      ) : (
        <CharacterCreateScreen send={send} />
      );

    case 'playing':
      return <PlayScreen send={send} onLeave={handleLeave} />;

    case 'lobby':
    case 'ended':
    default:
      return <LobbyScreen send={send} onLeave={handleLeave} />;
  }
}
