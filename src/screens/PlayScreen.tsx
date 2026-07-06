import { useMemo, useState } from 'react';
import type { Coord, SceneObject, TokenId } from '@shared/entities';
import type { Command } from '@shared/protocol/commands';
import { chebyshev, moveRange, objectBlocks, sceneObjectBlocks } from '@shared/rules/turns';
import { isPassable, tileAt } from '@shared/world/types';
import { getItem } from '@shared/content/items';
import { STATUSES, getStatus } from '@shared/content/statuses';
import { useGameStore } from '../net/gameStore';
import { GridMapView } from '../components/GridMapView';
import { InitiativeTracker } from '../components/InitiativeTracker';
import { CharacterToken } from '../components/CharacterToken';
import { GMPanel, type ArmedObject } from '../components/GMPanel';
import { DiceResult } from '../components/DiceResult';

const genObjectId = () => `obj-${Math.random().toString(36).slice(2, 9)}`;

export function PlayScreen({
  send,
  onLeave,
}: {
  send: (command: Command) => void;
  onLeave: () => void;
}) {
  const state = useGameStore((s) => s.state)!;
  const you = useGameStore((s) => s.you);
  const pendingNarration = useGameStore((s) => s.pendingNarration);
  const clearNarration = useGameStore((s) => s.clearNarration);
  const isGm = you === state.gmId;

  const [selectedId, setSelectedId] = useState<TokenId | undefined>(undefined);
  const [armedObject, setArmedObject] = useState<ArmedObject | undefined>(undefined);
  const [interactionPrompt, setInteractionPrompt] = useState<{ id: string; obj: SceneObject } | undefined>(undefined);
  const [gmEditModal, setGmEditModal] = useState<{
    id: string;
    label: string;
    description: string;
    blocksMovement: boolean;
    collectible: boolean;
    statusEffects: { apply: string[]; remove: string[] };
  } | undefined>(undefined);

  const { map, initiative, turn } = state;
  const tokens = Object.values(state.tokens);
  const objects = Object.values(state.interactables);
  const sceneObjects = Object.values(state.sceneObjects);
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
        if (!isPassable(tileAt(map, x, y))) continue;
        if (objectBlocks(state.interactables, x, y)) continue;
        if (sceneObjectBlocks(state.sceneObjects, x, y)) continue;
        if (tokens.some((t) => t.id !== myToken.id && t.coord.x === x && t.coord.y === y)) continue;
        if (Math.max(Math.abs(x - myToken.coord.x), Math.abs(y - myToken.coord.y)) <= range) {
          set.add(`${x},${y}`);
        }
      }
    }
    return set;
  }, [map, isGm, isMyTurn, myToken, turn.moved, tokens, state.interactables, state.sceneObjects]);

  const handleTile = (coord: Coord) => {
    if (isGm) {
      if (armedObject) {
        send({
          t: 'gm/placeObject',
          id: genObjectId(),
          sprite: armedObject.sprite,
          label: armedObject.label,
          at: coord,
          blocksMovement: armedObject.blocksMovement,
          collectible: armedObject.collectible,
          description: armedObject.description,
          statusEffects: armedObject.statusEffects,
        });
        setArmedObject(undefined);
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

  const handleSceneObject = (id: string) => {
    if (isGm) {
      const obj = state.sceneObjects[id];
      if (obj) {
        setGmEditModal({ id, label: obj.label, description: obj.description, blocksMovement: obj.blocksMovement, collectible: obj.collectible, statusEffects: { ...obj.statusEffects } });
      }
      return;
    }
    const obj = state.sceneObjects[id];
    if (canAct && obj && adjacent(obj.coord)) {
      setInteractionPrompt({ id, obj });
    }
  };

  const hint = isGm
    ? armedObject
      ? `Click any tile to place ${armedObject.sprite} ${armedObject.label}.`
      : state.pendingInteraction
        ? 'A player is waiting — write your narration in the toolkit.'
        : 'Select a token to move it. Click a scene object to edit or remove it.'
    : !isMyTurn
      ? 'Wait for your turn.'
      : `${turn.moved ? '' : 'Click a glowing tile to move. '}${turn.acted ? '' : 'Click an adjacent object, chest, door, or ally to act. '}${turn.moved && turn.acted ? 'Turn spent — end your turn.' : ''}`;

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6">
      {/* GM edit/remove modal for placed scene objects */}
      {gmEditModal && isGm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-amber-500/40 bg-slate-900 p-5 shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-400">Edit object</h3>

            <label className="mb-2 block space-y-1">
              <span className="text-xs text-slate-400">Label</span>
              <input
                value={gmEditModal.label}
                onChange={(e) => setGmEditModal({ ...gmEditModal, label: e.target.value })}
                maxLength={40}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </label>

            <label className="mb-3 block space-y-1">
              <span className="text-xs text-slate-400">Description</span>
              <textarea
                value={gmEditModal.description}
                onChange={(e) => setGmEditModal({ ...gmEditModal, description: e.target.value })}
                placeholder="Shown to players before they interact…"
                rows={2}
                maxLength={300}
                className="w-full resize-none rounded border border-slate-700 bg-slate-800 p-1.5 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </label>

            <div className="mb-3 flex gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={gmEditModal.blocksMovement}
                  onChange={(e) => setGmEditModal({ ...gmEditModal, blocksMovement: e.target.checked })}
                  className="accent-amber-400"
                />
                Blocks movement
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={gmEditModal.collectible}
                  onChange={(e) => setGmEditModal({ ...gmEditModal, collectible: e.target.checked })}
                  className="accent-amber-400"
                />
                Collectible
              </label>
            </div>

            <div className="mb-4 space-y-1.5">
              <p className="text-xs text-slate-400">On interact — apply:</p>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((st) => {
                  const active = gmEditModal.statusEffects.apply.includes(st.id);
                  return (
                    <button key={st.id} type="button" title={st.name}
                      onClick={() => {
                        const apply = active ? gmEditModal.statusEffects.apply.filter((s) => s !== st.id) : [...gmEditModal.statusEffects.apply, st.id];
                        const remove = gmEditModal.statusEffects.remove.filter((s) => s !== st.id);
                        setGmEditModal({ ...gmEditModal, statusEffects: { apply, remove } });
                      }}
                      className={`rounded border px-1.5 py-0.5 text-sm ${active ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                    >{st.icon}</button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400">On interact — remove:</p>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((st) => {
                  const active = gmEditModal.statusEffects.remove.includes(st.id);
                  return (
                    <button key={st.id} type="button" title={st.name}
                      onClick={() => {
                        const remove = active ? gmEditModal.statusEffects.remove.filter((s) => s !== st.id) : [...gmEditModal.statusEffects.remove, st.id];
                        const apply = gmEditModal.statusEffects.apply.filter((s) => s !== st.id);
                        setGmEditModal({ ...gmEditModal, statusEffects: { apply, remove } });
                      }}
                      className={`rounded border px-1.5 py-0.5 text-sm ${active ? 'border-rose-500/60 bg-rose-500/20 text-rose-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                    >{st.icon}</button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={gmEditModal.label.trim().length === 0}
                onClick={() => {
                  send({ t: 'gm/editObject', id: gmEditModal.id, label: gmEditModal.label.trim(), description: gmEditModal.description, blocksMovement: gmEditModal.blocksMovement, collectible: gmEditModal.collectible, statusEffects: gmEditModal.statusEffects });
                  setGmEditModal(undefined);
                }}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  send({ t: 'gm/removeObject', id: gmEditModal.id });
                  setGmEditModal(undefined);
                }}
                className="rounded-lg border border-rose-700/60 px-4 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-900/30"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setGmEditModal(undefined)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interaction prompt — shown before spending an action on a scene object */}
      {interactionPrompt && !isGm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl">
            <p className="mb-1 flex items-center gap-2 text-lg font-semibold text-white">
              <span>{interactionPrompt.obj.sprite}</span>
              <span>{interactionPrompt.obj.label}</span>
            </p>
            {interactionPrompt.obj.description && (
              <p className="mb-3 leading-relaxed text-slate-300">{interactionPrompt.obj.description}</p>
            )}
            {(interactionPrompt.obj.statusEffects.apply.length > 0 || interactionPrompt.obj.statusEffects.remove.length > 0) && (
              <div className="mb-4 space-y-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs">
                {interactionPrompt.obj.statusEffects.apply.length > 0 && (
                  <p className="text-slate-300">
                    <span className="text-emerald-400">Applies: </span>
                    {interactionPrompt.obj.statusEffects.apply.map((sid) => {
                      const st = getStatus(sid);
                      return st ? `${st.icon} ${st.name}` : sid;
                    }).join(', ')}
                  </p>
                )}
                {interactionPrompt.obj.statusEffects.remove.length > 0 && (
                  <p className="text-slate-300">
                    <span className="text-rose-400">Removes: </span>
                    {interactionPrompt.obj.statusEffects.remove.map((sid) => {
                      const st = getStatus(sid);
                      return st ? `${st.icon} ${st.name}` : sid;
                    }).join(', ')}
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  send({ t: 'interact', targetId: interactionPrompt.id });
                  setInteractionPrompt(undefined);
                }}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Interact
              </button>
              <button
                type="button"
                onClick={() => setInteractionPrompt(undefined)}
                className="flex-1 rounded-lg border border-slate-700 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private narration popup */}
      {pendingNarration && !isGm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-indigo-500/40 bg-slate-900 p-6 shadow-2xl">
            <p className="mb-1 flex items-center gap-2 text-lg font-semibold text-white">
              <span>{pendingNarration.sprite}</span>
              <span>{pendingNarration.label}</span>
            </p>
            <p className="mb-4 leading-relaxed text-slate-300">{pendingNarration.text}</p>
            <button
              type="button"
              onClick={clearNarration}
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
              sceneObjects={sceneObjects}
              currentTokenId={currentId}
              selectedTokenId={isGm ? selectedId : undefined}
              reachable={reachable}
              onTileClick={handleTile}
              onTokenClick={handleToken}
              onObjectClick={handleObject}
              onSceneObjectClick={handleSceneObject}
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
              armedObject={armedObject}
              onArmObject={setArmedObject}
            />
          )}

          {/* Party health bars */}
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

          {/* Own inventory + collected scene objects */}
          {!isGm && myCharacter && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Your items</h2>
              {myCharacter.inventory.length === 0 && myCharacter.notes.length === 0 ? (
                <p className="text-xs text-slate-500">Nothing yet — loot a chest or pick up an item.</p>
              ) : (
                <ul className="space-y-1">
                  {myCharacter.inventory.map((stack) => {
                    const item = getItem(stack.itemId);
                    return (
                      <li
                        key={stack.itemId}
                        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-sm"
                      >
                        <span>{item?.icon ?? '❔'}</span>
                        <span className="flex-1 truncate">{item?.name ?? stack.itemId}</span>
                        {stack.qty > 1 && <span className="text-xs text-slate-400">×{stack.qty}</span>}
                      </li>
                    );
                  })}
                  {myCharacter.notes.map((note, i) => (
                    <li key={`note-${i}`} className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{note.sprite}</span>
                        <span className="flex-1 truncate font-medium">{note.label}</span>
                      </div>
                      {note.text && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{note.text}</p>}
                    </li>
                  ))}
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
