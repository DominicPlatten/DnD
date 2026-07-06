import type { Command } from '@shared/protocol/commands';
import { useGameStore } from '../net/gameStore';

const PHASE_LABEL: Record<string, string> = {
  lobby: 'In the lobby',
  setup: 'Setting up the adventure',
  playing: 'Adventure in progress',
  ended: 'The adventure has ended',
};

export function LobbyScreen({
  send,
  onLeave,
}: {
  send: (command: Command) => void;
  onLeave: () => void;
}) {
  const state = useGameStore((s) => s.state)!;
  const you = useGameStore((s) => s.you);
  const log = useGameStore((s) => s.log);

  const players = Object.values(state.players);
  const isGm = you !== null && you === state.gmId;

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Room code</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em] text-indigo-400">
            {state.code}
          </p>
          <p className="mt-1 text-sm text-slate-400">{PHASE_LABEL[state.phase] ?? state.phase}</p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Leave
        </button>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Party ({players.length})
        </h2>
        <ul className="space-y-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${player.connected ? 'bg-emerald-500' : 'bg-slate-600'}`}
                  title={player.connected ? 'Connected' : 'Disconnected'}
                />
                <span className="font-medium">{player.name}</span>
                {player.id === you && <span className="text-xs text-slate-500">(you)</span>}
              </span>
              {player.role === 'gm' && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  Storyteller
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isGm ? (
        <button
          type="button"
          onClick={() => send({ t: 'gm/advancePhase' })}
          disabled={state.phase === 'ended'}
          className="mt-8 w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {state.phase === 'lobby' ? 'Begin setup →' : 'Advance phase →'}
        </button>
      ) : (
        <p className="mt-8 text-center text-sm text-slate-500">
          Waiting for the storyteller to begin…
        </p>
      )}

      {log.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Activity
          </h2>
          <ul className="space-y-1 text-sm text-slate-400">
            {log.slice(-8).map((event, i) => (
              <li key={i}>
                {event.t === 'playerJoined' && `${event.name} joined the party.`}
                {event.t === 'playerLeft' && `${event.name} left the party.`}
                {event.t === 'characterReady' && `${event.name} is ready for adventure.`}
                {event.t === 'worldChosen' && `The storyteller revealed the ${event.worldName}.`}
                {event.t === 'enemySpawned' && `A ${event.name} appears!`}
                {event.t === 'itemGiven' && `${event.to} received a ${event.item}.`}
                {event.t === 'diceRolled' && `${event.by} rolled a d${event.sides}: ${event.value}.`}
                {event.t === 'chestOpened' && `${event.by} opened a chest${event.items.length ? ` (${event.items.join(', ')})` : ''}.`}
                {event.t === 'doorToggled' && `A door was ${event.open ? 'opened' : 'closed'}.`}
                {event.t === 'greeted' && `${event.from} greets ${event.to}.`}
                {event.t === 'battleStarted' && `A battle with a ${event.foe} begins!`}
                {event.t === 'battleEnded' && event.outcome}
                {event.t === 'phaseChanged' && `The game moved to “${event.phase}”.`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
