import { useMemo, useState } from 'react';
import type { Coord, TokenId } from '@shared/entities';
import type { EnemyTier } from '@shared/content/enemies';
import type { Command } from '@shared/protocol/commands';
import { chebyshev, moveRange, objectBlocks } from '@shared/rules/turns';
import { isPassable, tileAt } from '@shared/world/types';
import { getItem } from '@shared/content/items';
import { useGameStore } from '../net/gameStore';
import { GridMapView } from '../components/GridMapView';
import { InitiativeTracker } from '../components/InitiativeTracker';
import { CharacterToken } from '../components/CharacterToken';
import { GMPanel } from '../components/GMPanel';
import { DiceResult } from '../components/DiceResult';

const genTokenId = () => `e-${Math.random().toString(36).slice(2, 9)}`;

/**
 * The play view: the board with click-to-move + interact, the initiative
 * tracker, each turn's move/action economy, the dice result, the GM toolkit,
 * and inventories. Attacking enemies (battle) hooks into `interact` next.
 */
export function PlayScreen({
  send,
  onLeave,
}: {
  send: (command: Command) => void;
  onLeave: () => void;
}) {
  const state = useGameStore((s) => s.state)!;
  const you = useGameStore((s) => s.you);
  const isGm = you === state.gmId;

  const [selectedId, setSelectedId] = useState<TokenId | undefined>(undefined);
  const [spawningId, setSpawningId] = useState<string | undefined>(undefined);
  const [spawnTier, setSpawnTier] = useState<EnemyTier>('normal');

  const { map, initiative, turn } = state;
  const tokens = Object.values(state.tokens);
  const objects = Object.values(state.interactables);
  const currentId = initiative ? initiative.order[initiative.currentIndex] : undefined;
  const currentToken = currentId ? state.tokens[currentId] : undefined;

  const myToken = tokens.find((t) => t.ownerId === you);
  const isMyTurn = !!myToken && currentId === myToken.id;
  const myCharacter = you ? state.characters[you] : undefined;
  const canAct = !isGm && isMyTurn && !turn.acted;
  const adjacent = (coord: Coord) => !!myToken && chebyshev(myToken.coord, coord) <= 1;

  const reachable = useMemo(() => {
    const set = new Set<string>();
    if (!map || isGm || !isMyTurn || !myToken || turn.moved) return set;
    const range = moveRange(myToken);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!isPassable(tileAt(map, x, y)) || objectBlocks(state.interactables, x, y)) continue;
        if (tokens.some((t) => t.id !== myToken.id && t.coord.x === x && t.coord.y === y)) continue;
        if (Math.max(Math.abs(x - myToken.coord.x), Math.abs(y - myToken.coord.y)) <= range) set.add(`${x},${y}`);
      }
    }
    return set;
  }, [map, isGm, isMyTurn, myToken, turn.moved, tokens, state.interactables]);

  const handleTile = (coord: Coord) => {
    if (isGm) {
      if (spawningId) {
        send({ t: 'gm/spawnEnemy', enemyId: spawningId, tokenId: genTokenId(), at: coord, tier: spawnTier });
        setSpawningId(undefined);
        return;
      }
      if (selectedId) send({ t: 'moveToken', tokenId: selectedId, to: coord });
    } else if (isMyTurn && myToken && !turn.moved) {
      send({ t: 'moveToken', tokenId: myToken.id, to: coord });
    }
  };

  const handleToken = (id: TokenId) => {
    if (isGm) {
      setSelectedId((prev) => (prev === id ? undefined : id));
      return;
    }
    const target = state.tokens[id];
    if (canAct && target && target.id !== myToken?.id && adjacent(target.coord)) {
      send({ t: 'interact', targetId: id });
    }
  };

  const handleObject = (id: string) => {
    if (isGm) return;
    const object = state.interactables[id];
    if (canAct && object && adjacent(object.coord)) send({ t: 'interact', targetId: id });
  };

  const hint = isGm
    ? spawningId
      ? 'Click a tile to place the creature.'
      : 'Select a token, then click a tile to move it. Use the toolkit to manage it.'
    : !isMyTurn
      ? 'Wait for your turn.'
      : `${turn.moved ? '' : 'Click a glowing tile to move. '}${turn.acted ? '' : 'Click an adjacent chest, door, or ally to act. '}${turn.moved && turn.acted ? 'Turn spent — end your turn.' : ''}`;

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            {map ? `Exploring · ${map.worldType}` : 'Adventure'}
          </p>
          <p className="font-mono text-2xl font-bold tracking-[0.3em] text-indigo-400">{state.code}</p>
        </div>
        <div className="flex items-center gap-3">
          <DiceResult />
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Leave
          </button>
        </div>
      </header>

      <InitiativeTracker />

      <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2">
        <span className="flex items-center gap-2 text-sm">
          {currentToken && <CharacterToken visual={currentToken.visual} size={26} />}
          <span>
            {isMyTurn ? (
              <span className="font-semibold text-emerald-400">Your turn!</span>
            ) : (
              <>
                <span className="text-slate-400">Now acting: </span>
                <span className="font-semibold">{currentToken?.name ?? '—'}</span>
              </>
            )}
          </span>
          {!isGm && isMyTurn && (
            <span className="ml-2 flex gap-1">
              <Chip label="Move" used={turn.moved} />
              <Chip label="Action" used={turn.acted} />
            </span>
          )}
        </span>
        <button
          type="button"
          disabled={!(isGm || isMyTurn)}
          onClick={() => send({ t: 'endTurn' })}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          End turn →
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div>
          {map ? (
            <GridMapView
              map={map}
              tokens={tokens}
              interactables={objects}
              currentTokenId={currentId}
              selectedTokenId={isGm ? selectedId : undefined}
              reachable={reachable}
              onTileClick={handleTile}
              onTokenClick={handleToken}
              onObjectClick={handleObject}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-500">
              No world was generated.
            </p>
          )}
          <p className="mt-2 min-h-4 text-xs text-slate-500">{hint}</p>
        </div>

        <aside className="space-y-4">
          {isGm && (
            <GMPanel
              send={send}
              selectedId={selectedId}
              onSelect={setSelectedId}
              spawningId={spawningId}
              onArmSpawn={setSpawningId}
              spawnTier={spawnTier}
              onSetTier={setSpawnTier}
            />
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Party</h2>
            <ul className="space-y-2">
              {tokens
                .filter((t) => t.kind === 'pc')
                .map((token) => {
                  const pct = Math.max(0, Math.round((token.hp / token.maxHp) * 100));
                  return (
                    <li key={token.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                      <div className="flex items-center gap-2">
                        <CharacterToken visual={token.visual} size={28} />
                        <span className="flex-1 truncate text-sm font-medium">{token.name}</span>
                        <span className="text-xs tabular-nums text-slate-400">
                          {token.hp}/{token.maxHp}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>

          {!isGm && myCharacter && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Your items</h2>
              {myCharacter.inventory.length === 0 ? (
                <p className="text-xs text-slate-500">Nothing yet — loot a chest or ask the storyteller.</p>
              ) : (
                <ul className="space-y-1">
                  {myCharacter.inventory.map((stack) => {
                    const item = getItem(stack.itemId);
                    return (
                      <li key={stack.itemId} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-sm">
                        <span>{item?.icon ?? '❔'}</span>
                        <span className="flex-1 truncate">{item?.name ?? stack.itemId}</span>
                        {stack.qty > 1 && <span className="text-xs text-slate-400">×{stack.qty}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Chip({ label, used }: { label: string; used: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        used ? 'bg-slate-800 text-slate-500 line-through' : 'bg-emerald-500/15 text-emerald-300'
      }`}
    >
      {label}
    </span>
  );
}
