import type { Command } from '@shared/protocol/commands';
import { WORLD_GENERATORS } from '@shared/world/registry';
import { useGameStore } from '../net/gameStore';
import { CharacterCard } from './CharacterCreateScreen';
import { GridMapView } from '../components/GridMapView';

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * The storyteller's setup view: choose a world (generated live) and watch the
 * party build their characters, then start the adventure.
 */
export function SetupScreen({
  send,
  onLeave,
}: {
  send: (command: Command) => void;
  onLeave: () => void;
}) {
  const state = useGameStore((s) => s.state)!;
  const map = state.map;

  const party = Object.values(state.players).filter((p) => p.role === 'player');
  const readyCount = party.filter((p) => state.characters[p.id]).length;

  const chooseWorld = (worldType: string) =>
    send({ t: 'gm/selectWorld', worldType, seed: randomSeed() });

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Setting up · room</p>
          <p className="font-mono text-2xl font-bold tracking-[0.3em] text-indigo-400">{state.code}</p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Leave
        </button>
      </header>

      {/* World selection */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Choose a world
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {WORLD_GENERATORS.map((world) => (
            <button
              key={world.type}
              type="button"
              onClick={() => chooseWorld(world.type)}
              className={`rounded-lg border p-3 text-left transition ${
                map?.worldType === world.type
                  ? 'border-indigo-500 bg-slate-800'
                  : 'border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              <div className="font-semibold">{world.name}</div>
              <div className="mt-0.5 text-xs text-slate-400">{world.blurb}</div>
            </button>
          ))}
        </div>

        {map && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-slate-400">Preview</span>
              <button
                type="button"
                onClick={() => chooseWorld(map.worldType)}
                className="rounded-lg border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
              >
                🎲 Reroll map
              </button>
            </div>
            <GridMapView map={map} tokens={[]} cell={22} />
          </div>
        )}
      </section>

      {/* Party readiness */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Party readiness ({readyCount}/{party.length})
        </h2>

        {party.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">
            No adventurers have joined yet. Share the room code {state.code}.
          </p>
        )}

        <div className="space-y-3">
          {party.map((player) => {
            const character = state.characters[player.id];
            return character ? (
              <CharacterCard key={player.id} character={character} />
            ) : (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-slate-400"
              >
                <span className="font-medium">{player.name}</span>
                <span className="text-sm italic">choosing their character…</span>
              </div>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        disabled={!map}
        onClick={() => send({ t: 'gm/startGame' })}
        className="mt-8 w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {map ? 'Start the adventure →' : 'Choose a world to continue'}
      </button>
    </div>
  );
}
