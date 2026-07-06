import { useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { GameRoot } from './GameRoot';

export interface Session {
  code: string;
  name: string;
}

const SESSION_KEY = 'dnd:session';

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function App() {
  // Restored from sessionStorage so a refresh drops you straight back into the game.
  const [session, setSession] = useState<Session | null>(loadSession);

  const enter = (code: string, name: string) => {
    const next = { code, name };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };

  const leave = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  if (!session) {
    return <HomeScreen onEnter={enter} />;
  }

  return <GameRoot session={session} onLeave={leave} />;
}
