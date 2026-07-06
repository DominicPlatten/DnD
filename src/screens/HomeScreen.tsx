import { useState } from 'react';

// Unambiguous alphabet (no O/0, I/1) for human-friendly room codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length = 5): string {
  return Array.from(
    { length },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join('');
}

export function HomeScreen({ onEnter }: { onEnter: (code: string, name: string) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const trimmedName = name.trim();
  const canJoin = trimmedName.length > 0 && code.trim().length > 0;
  const canCreate = trimmedName.length > 0;

  const enter = (roomCode: string) => onEnter(roomCode.trim().toUpperCase(), trimmedName);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">⚔️ D&D Online</h1>
          <p className="mt-1 text-sm text-slate-400">Gather your party by sharing a room code.</p>
        </header>

        <label className="block space-y-1">
          <span className="text-sm text-slate-300">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Aragorn"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </label>

        <button
          type="button"
          disabled={!canCreate}
          onClick={() => enter(randomCode())}
          className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create a game (you’ll be the storyteller)
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-700" />
          OR JOIN
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canJoin) enter(code);
          }}
          className="flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="CODE"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono tracking-widest outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!canJoin}
            className="shrink-0 rounded-lg border border-slate-600 px-4 font-semibold transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
