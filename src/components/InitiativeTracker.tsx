import { useGameStore } from '../net/gameStore';
import { CharacterToken } from './CharacterToken';

/** Horizontal turn-order strip: round number + each token, current one lit up. */
export function InitiativeTracker() {
  const init = useGameStore((s) => s.state?.initiative ?? null);
  const tokens = useGameStore((s) => s.state?.tokens ?? {});
  if (!init) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-400">Turn order</span>
        <span className="text-xs text-slate-500">Round {init.round}</span>
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {init.order.map((id, i) => {
          const token = tokens[id];
          if (!token) return null;
          const active = i === init.currentIndex;
          return (
            <li
              key={id}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 ${
                active ? 'bg-amber-500/15 ring-1 ring-amber-400' : 'opacity-70'
              }`}
            >
              <CharacterToken visual={token.visual} size={30} />
              <span className="max-w-16 truncate text-xs">{token.name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
