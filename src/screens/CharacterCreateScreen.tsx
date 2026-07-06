import { useState } from 'react';
import type { Abilities, AbilityKey, Character, Race } from '@shared/entities';
import type { Command } from '@shared/protocol/commands';
import { RACES, getRace } from '@shared/content/races';
import { CLASSES, getClass } from '@shared/content/classes';
import { TOKEN_COLORS, TOKEN_ICONS } from '@shared/content/visuals';
import { ABILITY_KEYS, ABILITY_NAMES } from '@shared/content/abilities';
import {
  ABILITY_MAX,
  ABILITY_MIN,
  POINT_BUY_BUDGET,
  abilityMod,
  applyRaceMods,
  baseAbilities,
  deriveStats,
  totalPointBuyCost,
} from '@shared/rules/character';
import { useGameStore } from '../net/gameStore';
import { CharacterToken } from '../components/CharacterToken';

const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Reverse racial mods so an existing character can be re-edited from its base scores. */
function baseFromCharacter(character: Character, race: Race): Abilities {
  const base = { ...character.abilities };
  for (const key of ABILITY_KEYS) base[key] = character.abilities[key] - (race.abilityMods[key] ?? 0);
  return base;
}

export function CharacterCreateScreen({ send }: { send: (command: Command) => void }) {
  const existing = useGameStore((s) => (s.you ? s.state?.characters[s.you] : undefined));

  const [editing, setEditing] = useState(existing === undefined);
  const [name, setName] = useState(existing?.name ?? '');
  const [raceId, setRaceId] = useState(existing?.raceId ?? RACES[0]!.id);
  const [classId, setClassId] = useState(existing?.classId ?? CLASSES[0]!.id);
  const [color, setColor] = useState<string>(existing?.visual.color ?? TOKEN_COLORS[0]);
  const [icon, setIcon] = useState<string>(existing?.visual.icon ?? TOKEN_ICONS[0]);
  const [base, setBase] = useState<Abilities>(() => {
    const race = existing ? getRace(existing.raceId) : undefined;
    return existing && race ? baseFromCharacter(existing, race) : baseAbilities();
  });

  const race = getRace(raceId) ?? RACES[0]!;
  const classDef = getClass(classId) ?? CLASSES[0]!;
  const finalAbilities = applyRaceMods(base, race);
  const derived = deriveStats(finalAbilities, race, classDef);
  const spent = totalPointBuyCost(base) ?? 0;
  const remaining = POINT_BUY_BUDGET - spent;

  const adjust = (key: AbilityKey, delta: number) => {
    setBase((prev) => {
      const next = prev[key] + delta;
      if (next < ABILITY_MIN || next > ABILITY_MAX) return prev;
      const candidate = { ...prev, [key]: next };
      const cost = totalPointBuyCost(candidate);
      if (cost === null || cost > POINT_BUY_BUDGET) return prev;
      return candidate;
    });
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    send({ t: 'createCharacter', draft: { name: trimmed, raceId, classId, visual: { color, icon }, baseAbilities: base } });
    setEditing(false);
  };

  // ---- Ready summary (not editing) ------------------------------------------
  if (!editing && existing) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-md px-4 py-10">
        <h1 className="mb-6 text-center text-2xl font-bold">Your hero is ready</h1>
        <CharacterCard character={existing} />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-6 w-full rounded-lg border border-slate-600 py-2.5 font-semibold hover:bg-slate-800"
        >
          Edit character
        </button>
        <p className="mt-6 text-center text-sm text-slate-500">
          Waiting for the storyteller to begin the adventure…
        </p>
      </div>
    );
  }

  // ---- Builder ---------------------------------------------------------------
  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Create your character</h1>

      {/* Identity */}
      <section className="mt-6 flex items-center gap-4">
        <CharacterToken visual={{ color, icon }} size={64} />
        <label className="flex-1 space-y-1">
          <span className="text-sm text-slate-300">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Name your hero"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </label>
      </section>

      {/* Appearance */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Appearance</h2>
        <div className="flex flex-wrap gap-2">
          {TOKEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`h-8 w-8 rounded-full ring-2 transition ${color === c ? 'ring-white' : 'ring-transparent'}`}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOKEN_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={`grid h-9 w-9 place-items-center rounded-lg border text-lg transition ${
                icon === i ? 'border-indigo-500 bg-slate-800' : 'border-slate-700 hover:bg-slate-800'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </section>

      {/* Race */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Race</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {RACES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRaceId(r.id)}
              className={`rounded-lg border p-3 text-left transition ${
                raceId === r.id ? 'border-indigo-500 bg-slate-800' : 'border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              <div className="font-semibold">{r.name}</div>
              <div className="mt-0.5 text-xs text-slate-400">{r.blurb}</div>
              <div className="mt-1 text-xs font-medium text-indigo-300">
                {ABILITY_KEYS.filter((k) => r.abilityMods[k])
                  .map((k) => `${k.toUpperCase()} ${fmtMod(r.abilityMods[k] ?? 0)}`)
                  .join(' · ')}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Class */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Class</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CLASSES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClassId(c.id)}
              className={`rounded-lg border p-3 text-left transition ${
                classId === c.id ? 'border-indigo-500 bg-slate-800' : 'border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              <div className="font-semibold">
                {c.icon} {c.name}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{c.blurb}</div>
              <div className="mt-1 text-xs font-medium text-indigo-300">
                {ABILITY_NAMES[c.primary]} · {c.damageType} attacks
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Abilities (point-buy) */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Abilities</h2>
          <span className={`text-sm font-semibold ${remaining === 0 ? 'text-slate-500' : 'text-emerald-400'}`}>
            {remaining} points left
          </span>
        </div>
        <div className="space-y-1.5">
          {ABILITY_KEYS.map((key) => {
            const finalScore = finalAbilities[key];
            const canDec = base[key] > ABILITY_MIN;
            const canInc = base[key] < ABILITY_MAX && (totalPointBuyCost({ ...base, [key]: base[key] + 1 }) ?? 99) <= POINT_BUY_BUDGET;
            return (
              <div key={key} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <span className="w-28 text-sm font-medium">
                  {ABILITY_NAMES[key]}
                  {key === classDef.primary && (
                    <span className="ml-1 text-[10px] text-indigo-400" title="Your class's primary ability">
                      ★
                    </span>
                  )}
                </span>
                <button type="button" disabled={!canDec} onClick={() => adjust(key, -1)} className="h-7 w-7 rounded border border-slate-600 disabled:opacity-30">−</button>
                <span className="w-6 text-center tabular-nums">{base[key]}</span>
                <button type="button" disabled={!canInc} onClick={() => adjust(key, 1)} className="h-7 w-7 rounded border border-slate-600 disabled:opacity-30">+</button>
                <span className="ml-auto text-sm text-slate-400">
                  final <span className="font-semibold text-slate-100">{finalScore}</span>{' '}
                  <span className="text-indigo-300">({fmtMod(abilityMod(finalScore))})</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Derived preview */}
      <section className="mt-6 grid grid-cols-4 gap-2 text-center">
        <Stat label="HP" value={derived.maxHp} />
        <Stat label="AC" value={derived.ac} />
        <Stat label="Speed" value={derived.speed} />
        <Stat label="Init" value={fmtMod(derived.initiative)} />
      </section>

      <button
        type="button"
        disabled={name.trim().length === 0}
        onClick={submit}
        className="mt-8 w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {existing ? 'Save changes' : 'Confirm character'}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 py-2">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

/** Compact read-only card, reused on the ready screen. */
export function CharacterCard({ character }: { character: Character }) {
  const race = getRace(character.raceId);
  const classDef = getClass(character.classId);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center gap-3">
        <CharacterToken visual={character.visual} size={48} />
        <div>
          <div className="font-semibold">{character.name}</div>
          <div className="text-xs text-slate-400">
            {race?.name ?? character.raceId} {classDef?.name ?? character.classId} · Level {character.level}
          </div>
        </div>
        <div className="ml-auto text-right text-sm">
          <div>❤️ {character.hp}/{character.maxHp}</div>
          <div className="text-slate-400">🛡️ {character.ac}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1 text-center">
        {ABILITY_KEYS.map((key) => (
          <div key={key} className="rounded bg-slate-800/60 py-1">
            <div className="text-[10px] uppercase text-slate-500">{key}</div>
            <div className="text-sm font-semibold tabular-nums">{character.abilities[key]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
