import { useGameStore } from '../net/gameStore';

/** Shows the latest dice roll to everyone; re-animates on each new roll. */
export function DiceResult() {
  const roll = useGameStore((s) => s.state?.lastRoll ?? null);
  if (!roll) return null;
  return (
    <div
      key={roll.seq}
      className="roll-pop flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5"
    >
      <span className="text-lg">🎲</span>
      <span className="text-sm text-slate-400">d{roll.sides}</span>
      <span className="text-xl font-bold tabular-nums">{roll.value}</span>
      <span className="text-xs text-slate-500">· {roll.by}</span>
    </div>
  );
}
