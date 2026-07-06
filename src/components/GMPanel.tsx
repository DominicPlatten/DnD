import type { TokenId } from '@shared/entities';
import type { Command } from '@shared/protocol/commands';
import { ENEMIES, ENEMY_TIERS, getEnemy, scaleEnemy, type EnemyTier } from '@shared/content/enemies';
import { STATUSES, getStatus } from '@shared/content/statuses';
import { ITEMS } from '@shared/content/items';
import { useGameStore } from '../net/gameStore';

const fmtDelta = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * The storyteller's toolkit during play: spawn creatures, and for a selected
 * token adjust HP, toggle conditions, remove it, or (for a PC) hand over items.
 */
export function GMPanel({
  send,
  selectedId,
  onSelect,
  spawningId,
  onArmSpawn,
  spawnTier,
  onSetTier,
}: {
  send: (command: Command) => void;
  selectedId?: TokenId;
  onSelect: (id?: TokenId) => void;
  spawningId?: string;
  onArmSpawn: (enemyId?: string) => void;
  spawnTier: EnemyTier;
  onSetTier: (tier: EnemyTier) => void;
}) {
  const token = useGameStore((s) => (selectedId ? s.state?.tokens[selectedId] : undefined));
  const armed = spawningId ? getEnemy(spawningId) : undefined;

  const setHp = (delta: number) => {
    if (token) send({ t: 'gm/setHp', tokenId: token.id, hp: token.hp + delta });
  };

  return (
    <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400">Storyteller</h2>

      {/* Dice roller */}
      <div>
        <p className="mb-1 text-xs text-slate-400">Roll dice (everyone sees it)</p>
        <div className="grid grid-cols-3 gap-1">
          {([6, 12, 20] as const).map((sides) => (
            <button
              key={sides}
              type="button"
              onClick={() => send({ t: 'gm/rollDice', sides })}
              className="rounded-lg border border-slate-700 py-1.5 text-sm font-semibold hover:bg-slate-800"
            >
              🎲 d{sides}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800" />

      {/* Spawn creatures */}
      <div>
        <p className="mb-1 text-xs text-slate-400">Spawn a creature</p>

        {/* Strength tier — ramp difficulty from weak fodder to bosses */}
        <div className="mb-2 grid grid-cols-4 gap-1">
          {ENEMY_TIERS.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => onSetTier(tier.id)}
              title={`HP ×${tier.hpMult} · ATK ${fmtDelta(tier.attackDelta)} · DEF ${fmtDelta(tier.defenseDelta)}`}
              className={`rounded-lg border py-1 text-xs font-semibold ${
                spawnTier === tier.id
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {tier.badge && `${tier.badge} `}
              {tier.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1">
          {ENEMIES.map((enemy) => {
            const scaled = scaleEnemy(enemy, spawnTier);
            return (
              <button
                key={enemy.id}
                type="button"
                onClick={() => onArmSpawn(spawningId === enemy.id ? undefined : enemy.id)}
                title={`${scaled.name} · ${scaled.maxHp} HP · ATK ${scaled.attack} · ARM ${scaled.armor} · RES ${scaled.magicResist}`}
                className={`grid place-items-center rounded-lg border py-1.5 text-lg ${
                  spawningId === enemy.id ? 'border-amber-400 bg-amber-500/20' : 'border-slate-700 hover:bg-slate-800'
                }`}
              >
                {enemy.icon}
              </button>
            );
          })}
        </div>
        {armed && (
          <p className="mt-1 text-xs text-amber-300">
            Placing {scaleEnemy(armed, spawnTier).name} ({scaleEnemy(armed, spawnTier).maxHp} HP) — click a tile, or pick
            again to cancel.
          </p>
        )}
      </div>

      <div className="border-t border-slate-800" />

      {/* Selected token controls */}
      {token ? (
        <div className="space-y-3">
          <div className="text-sm">
            Selected: <span className="font-semibold">{token.name}</span>
            <span className="ml-1 text-xs text-slate-500">({token.kind})</span>
          </div>

          {/* HP */}
          <div>
            <p className="mb-1 text-xs text-slate-400">
              Health — {token.hp}/{token.maxHp}
            </p>
            <div className="flex items-center gap-1">
              {[-5, -1, +1, +5].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => setHp(delta)}
                  className="flex-1 rounded border border-slate-600 py-1 text-sm hover:bg-slate-800"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          </div>

          {/* Conditions */}
          <div>
            <p className="mb-1 text-xs text-slate-400">Conditions</p>
            {token.statuses.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-1">
                {token.statuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send({ t: 'gm/removeStatus', tokenId: token.id, status: s })}
                    title={`Remove ${getStatus(s)?.name ?? s}`}
                    className="rounded-full bg-slate-800 px-2 py-0.5 text-xs hover:bg-slate-700"
                  >
                    {getStatus(s)?.icon} {getStatus(s)?.name} ✕
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {STATUSES.filter((st) => !token.statuses.includes(st.id)).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => send({ t: 'gm/applyStatus', tokenId: token.id, status: st.id })}
                  title={st.blurb}
                  className="rounded border border-slate-700 px-1.5 py-0.5 text-sm hover:bg-slate-800"
                >
                  {st.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Give item (PCs only) */}
          {token.kind === 'pc' && (
            <div>
              <p className="mb-1 text-xs text-slate-400">Give item</p>
              <div className="flex flex-wrap gap-1">
                {ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => send({ t: 'gm/giveItem', charId: token.id, itemId: item.id })}
                    title={`Give ${item.name}`}
                    className="rounded border border-slate-700 px-1.5 py-0.5 text-sm hover:bg-slate-800"
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Remove enemies */}
          {token.kind === 'enemy' && (
            <button
              type="button"
              onClick={() => {
                send({ t: 'gm/removeToken', tokenId: token.id });
                onSelect(undefined);
              }}
              className="w-full rounded-lg border border-red-500/40 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
            >
              Remove {token.name}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Select a token on the board to manage it.</p>
      )}
    </div>
  );
}
