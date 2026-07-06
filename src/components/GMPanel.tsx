import { useState } from 'react';
import type { TokenId } from '@shared/entities';
import type { Command } from '@shared/protocol/commands';
import { SPRITE_LIBRARY, type SpriteEntry } from '@shared/content/sceneObjects';
import { STATUSES, getStatus } from '@shared/content/statuses';
import { ITEMS } from '@shared/content/items';
import { useGameStore } from '../net/gameStore';

export interface ArmedObject {
  sprite: string;
  label: string;
  blocksMovement: boolean;
  collectible: boolean;
  description: string;
  statusEffects: { apply: string[]; remove: string[] };
}

/**
 * The storyteller's toolkit during play: place scene objects, narrate player
 * interactions, and manage PC tokens (HP, conditions, items).
 */
export function GMPanel({
  send,
  selectedId,
  armedObject,
  onArmObject,
}: {
  send: (command: Command) => void;
  selectedId?: TokenId;
  armedObject?: ArmedObject;
  onArmObject: (obj?: ArmedObject) => void;
}) {
  const state = useGameStore((s) => s.state)!;
  const token = selectedId ? state.tokens[selectedId] : undefined;
  const pendingInteraction = state.pendingInteraction;
  const pendingObj = pendingInteraction ? state.sceneObjects[pendingInteraction.objectId] : undefined;
  const pendingPlayer = pendingInteraction ? state.players[pendingInteraction.playerId] : undefined;

  const [narrateText, setNarrateText] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  const narrate = (collect: boolean) => {
    send({ t: 'gm/narrateObject', text: narrateText.trim(), collect });
    setNarrateText('');
  };

  const setHp = (delta: number) => {
    if (token) send({ t: 'gm/setHp', tokenId: token.id, hp: token.hp + delta });
  };

  const armSprite = (sprite: SpriteEntry) => {
    if (armedObject?.sprite === sprite.emoji) {
      onArmObject(undefined);
    } else {
      onArmObject({ sprite: sprite.emoji, label: sprite.label, blocksMovement: false, collectible: false, description: '', statusEffects: { apply: [], remove: [] } });
    }
  };

  const toggleStatusEffect = (type: 'apply' | 'remove', statusId: string) => {
    if (!armedObject) return;
    const other = type === 'apply' ? 'remove' : 'apply';
    const current = armedObject.statusEffects[type];
    const hasIt = current.includes(statusId);
    onArmObject({
      ...armedObject,
      statusEffects: {
        ...armedObject.statusEffects,
        // Remove from opposite list if toggling on, toggle in current list
        [other]: armedObject.statusEffects[other].filter((s) => s !== statusId),
        [type]: hasIt ? current.filter((s) => s !== statusId) : [...current, statusId],
      },
    });
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

      {/* Narration panel — takes priority when a player is waiting */}
      {pendingInteraction && pendingObj ? (
        <div className="space-y-2 rounded-lg border border-indigo-500/40 bg-indigo-500/5 p-3">
          <p className="text-sm font-semibold text-indigo-300">
            <span className="text-white">{pendingPlayer?.name ?? 'A player'}</span> touches{' '}
            <span className="text-white">{pendingObj.sprite} {pendingObj.label}</span>
          </p>
          <textarea
            value={narrateText}
            onChange={(e) => setNarrateText(e.target.value)}
            placeholder="What do they discover…"
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => narrate(false)}
              disabled={narrateText.trim().length === 0}
              className="flex-1 rounded-lg border border-indigo-500/50 py-1.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40"
            >
              Narrate
            </button>
            {pendingObj.collectible && (
              <button
                type="button"
                onClick={() => narrate(true)}
                className="flex-1 rounded-lg border border-emerald-500/50 py-1.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
              >
                Give to player
              </button>
            )}
            <button
              type="button"
              onClick={() => { setNarrateText(''); send({ t: 'gm/narrateObject', text: '', collect: false }); }}
              title="Skip narration"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        /* Object placement library */
        <div>
          <p className="mb-2 text-xs text-slate-400">Place an object — click a sprite then click a tile</p>

          {/* Category tabs */}
          <div className="mb-2 flex flex-wrap gap-1">
            {SPRITE_LIBRARY.map((cat, i) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setActiveCategory(i)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeCategory === i
                    ? 'border border-amber-500/40 bg-amber-500/20 text-amber-200'
                    : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Sprite grid */}
          <div className="grid grid-cols-6 gap-1">
            {SPRITE_LIBRARY[activeCategory]?.sprites.map((sprite) => (
              <button
                key={sprite.emoji}
                type="button"
                onClick={() => armSprite(sprite)}
                title={sprite.label}
                className={`grid place-items-center rounded-lg border py-1.5 text-lg ${
                  armedObject?.sprite === sprite.emoji
                    ? 'border-amber-400 bg-amber-500/20'
                    : 'border-slate-700 hover:bg-slate-800'
                }`}
              >
                {sprite.emoji}
              </button>
            ))}
          </div>

          {/* Armed object options */}
          {armedObject && (
            <div className="mt-2 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
              <p className="text-xs text-amber-300">
                Placing {armedObject.sprite} {armedObject.label} — click any tile
              </p>
              <div className="flex gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={armedObject.blocksMovement}
                    onChange={(e) => onArmObject({ ...armedObject, blocksMovement: e.target.checked })}
                    className="accent-amber-400"
                  />
                  Blocks movement
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={armedObject.collectible}
                    onChange={(e) => onArmObject({ ...armedObject, collectible: e.target.checked })}
                    className="accent-amber-400"
                  />
                  Collectible
                </label>
              </div>

              {/* Description */}
              <textarea
                value={armedObject.description}
                onChange={(e) => onArmObject({ ...armedObject, description: e.target.value })}
                placeholder="Description shown to players before they interact…"
                rows={2}
                maxLength={300}
                className="w-full resize-none rounded border border-slate-700 bg-slate-900 p-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />

              {/* Status effects */}
              <div className="space-y-1">
                <p className="text-xs text-slate-400">On interact — apply:</p>
                <div className="flex flex-wrap gap-1">
                  {STATUSES.map((st) => {
                    const active = armedObject.statusEffects.apply.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => toggleStatusEffect('apply', st.id)}
                        title={st.name}
                        className={`rounded border px-1.5 py-0.5 text-sm ${
                          active ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {st.icon}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">On interact — remove:</p>
                <div className="flex flex-wrap gap-1">
                  {STATUSES.map((st) => {
                    const active = armedObject.statusEffects.remove.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => toggleStatusEffect('remove', st.id)}
                        title={st.name}
                        className={`rounded border px-1.5 py-0.5 text-sm ${
                          active ? 'border-rose-500/60 bg-rose-500/20 text-rose-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {st.icon}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-slate-800" />

      {/* Selected PC token controls */}
      {token ? (
        <div className="space-y-3">
          <div className="text-sm">
            Selected: <span className="font-semibold">{token.name}</span>
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

          {/* Give item */}
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
        </div>
      ) : (
        <p className="text-xs text-slate-500">Select a player token on the board to manage them.</p>
      )}
    </div>
  );
}
