import type { Combatant } from '@shared/entities';
import type { Command } from '@shared/protocol/commands';
import { getMove } from '@shared/content/moves';
import { useGameStore } from '../net/gameStore';
import { CharacterToken } from '../components/CharacterToken';

/**
 * The Pokémon-style battle view — shown to everyone while `state.battle` is set,
 * pausing the board. The controlling player picks a move; the enemy is AI; the
 * round resolves and the log updates. On defeat/victory/flee, a participant (or
 * the GM) returns everyone to the grid.
 */
export function BattleScreen({ send }: { send: (command: Command) => void }) {
  const battle = useGameStore((s) => s.state?.battle ?? null);
  const you = useGameStore((s) => s.you);
  const gmId = useGameStore((s) => s.state?.gmId ?? null);
  if (!battle) return null;

  const isGm = you === gmId;
  const combatants = Object.values(battle.combatants);
  const party = combatants.filter((c) => c.side === 'party');
  const foes = combatants.filter((c) => c.side === 'foe');
  const mine = combatants.find((c) => c.controllerId === you && c.hp > 0);
  const iChose = mine ? battle.pending[mine.id] : undefined;

  const over = battle.phase === 'over';
  const outcome = battle.fled
    ? '🏃 The party fled the battle.'
    : battle.winner === 'party'
      ? '🎉 Victory!'
      : battle.winner === 'foe'
        ? '💀 The party was defeated…'
        : 'The battle ended.';
  const canDismiss = over && (isGm || combatants.some((c) => c.controllerId === you));

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8">
      <header className="mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-slate-500">Battle · Round {battle.round}</p>
        <h1 className="text-2xl font-bold">⚔️ Encounter</h1>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="space-y-3">
          {party.map((c) => (
            <CombatantCard key={c.id} c={c} align="start" />
          ))}
        </div>
        <div className="text-2xl text-slate-600">vs</div>
        <div className="space-y-3">
          {foes.map((c) => (
            <CombatantCard key={c.id} c={c} align="end" />
          ))}
        </div>
      </div>

      <div className="mt-6 h-32 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
        {battle.log.slice(-12).map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      <div className="mt-6">
        {over ? (
          <div className="text-center">
            <p className="mb-3 text-lg font-semibold">{outcome}</p>
            {canDismiss ? (
              <button
                type="button"
                onClick={() => send({ t: 'battle/dismiss' })}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold text-white hover:bg-indigo-500"
              >
                Return to the map →
              </button>
            ) : (
              <p className="text-sm text-slate-500">Waiting for the fighters to regroup…</p>
            )}
          </div>
        ) : mine ? (
          iChose ? (
            <p className="text-center text-sm text-slate-400">You chose {getMove(iChose)?.name}. The clash unfolds…</p>
          ) : (
            <div>
              <p className="mb-2 text-center text-sm text-slate-400">Choose your move</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {mine.moves.map((id) => {
                  const move = getMove(id);
                  if (!move) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => send({ t: 'battle/chooseMove', moveId: id })}
                      title={move.blurb}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-left hover:bg-slate-800"
                    >
                      <div className="font-semibold">
                        {move.icon} {move.name}
                      </div>
                      <div className="text-xs text-slate-400">{move.blurb}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <p className="text-center text-sm text-slate-500">Watching the battle unfold…</p>
        )}
      </div>
    </div>
  );
}

function CombatantCard({ c, align }: { c: Combatant; align: 'start' | 'end' }) {
  const pct = Math.max(0, Math.round((c.hp / c.maxHp) * 100));
  const down = c.hp <= 0;
  return (
    <div className={`flex flex-col gap-1.5 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <div className={down ? 'opacity-40 grayscale' : ''}>
        <CharacterToken visual={c.visual} size={56} />
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold">
        {c.name} {c.guarding && <span title="Guarding">🛡️</span>}
      </div>
      <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full ${pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs tabular-nums text-slate-400">
        {c.hp}/{c.maxHp} HP
      </div>
    </div>
  );
}
