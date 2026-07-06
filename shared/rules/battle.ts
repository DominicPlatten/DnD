import type { Battle, Combatant, Token } from '../entities';
import { getMove, ENEMY_MOVES, type MoveDef } from '../content/moves';
import { makeRng } from '../world/rng';

/** Roll `count` dice of `sides` each and sum them. */
export function rollDice(rng: () => number, count: number, sides: number): number {
  let sum = 0;
  for (let i = 0; i < count; i++) sum += 1 + Math.floor(rng() * sides);
  return sum;
}

/** Roll a move's damage/heal dice (0 for moves with no dice, e.g. Guard). */
export function rollMove(move: MoveDef, rng: () => number): number {
  return move.dice ? rollDice(rng, move.dice.count, move.dice.sides) : 0;
}

/** The defense that resists a move: magic resist for magic attacks, armor otherwise. */
export function resistTo(move: MoveDef, defender: Combatant): number {
  return move.type === 'magic' ? defender.magicResist : defender.armor;
}

/** Damage before a guard reduction: dice roll + attacker power + bonus − the relevant resist (min 1). */
export function rawDamage(move: MoveDef, attacker: Combatant, defender: Combatant, roll: number): number {
  return Math.max(1, roll + attacker.power + (move.bonus ?? 0) - resistTo(move, defender));
}

/** Final damage for a landed attack given its dice `roll`, halved if the target is guarding. */
export function attackDamage(move: MoveDef, attacker: Combatant, defender: Combatant, roll: number): number {
  const dmg = rawDamage(move, attacker, defender, roll);
  return defender.guarding ? Math.ceil(dmg / 2) : dmg;
}

/**
 * Pure battle engine. The reducer builds combatants from grid tokens/characters
 * and drives this; everything here is deterministic given the battle's `seed`,
 * so it's fully unit-testable. Sides are arrays, so party/duo fights only need
 * more combatants — the resolver already loops over all of them.
 */

export function partyCombatant(
  token: Token,
  power: number,
  armor: number,
  magicResist: number,
  moves: string[],
): Combatant {
  return {
    id: token.id,
    tokenId: token.id,
    side: 'party',
    name: token.name,
    visual: token.visual,
    hp: token.hp,
    maxHp: token.maxHp,
    speed: token.speed,
    power,
    armor,
    magicResist,
    guarding: false,
    controllerId: token.ownerId,
    moves,
  };
}

export function foeCombatant(token: Token, power: number, armor: number, magicResist: number): Combatant {
  return {
    id: token.id,
    tokenId: token.id,
    side: 'foe',
    name: token.name,
    visual: token.visual,
    hp: token.hp,
    maxHp: token.maxHp,
    speed: token.speed,
    power,
    armor,
    magicResist,
    guarding: false,
    moves: ENEMY_MOVES,
  };
}

export function startBattle(fighters: Combatant[], seed: number): Battle {
  const combatants: Record<string, Combatant> = {};
  for (const c of fighters) combatants[c.id] = c;
  const foe = fighters.find((c) => c.side === 'foe');
  return {
    id: 'battle',
    combatants,
    round: 1,
    phase: 'choosing',
    pending: {},
    log: [foe ? `A wild ${foe.name} blocks the way!` : 'A battle begins!'],
    seed,
  };
}

const alive = (c: Combatant) => c.hp > 0;

/** All player-controlled, living fighters have queued a move. */
export function isReadyToResolve(battle: Battle): boolean {
  return Object.values(battle.combatants)
    .filter((c) => c.controllerId && alive(c))
    .every((c) => battle.pending[c.id]);
}

export function chooseMove(battle: Battle, combatantId: string, moveId: string): { battle: Battle; error?: string } {
  if (battle.phase !== 'choosing') return { battle, error: 'The battle is over.' };
  const combatant = battle.combatants[combatantId];
  if (!combatant) return { battle, error: 'You are not in this battle.' };
  if (!combatant.moves.includes(moveId)) return { battle, error: 'You cannot use that move.' };
  return { battle: { ...battle, pending: { ...battle.pending, [combatantId]: moveId } } };
}

/** A simple, swappable enemy strategy: favor big hits, guard when badly hurt. */
function aiChoose(self: Combatant, rng: () => number): string {
  if (self.hp / self.maxHp < 0.4 && self.moves.includes('guard') && rng() < 0.4) return 'guard';
  if (self.moves.includes('heavy') && rng() < 0.6) return 'heavy';
  return self.moves.includes('strike') ? 'strike' : (self.moves[0] ?? 'strike');
}

/** Resolve one round: fill AI moves, act in speed order, then check the outcome. */
export function resolveRound(battle: Battle): Battle {
  const rng = makeRng((battle.seed ^ (battle.round * 0x9e3779b9)) >>> 0);
  const combatants: Record<string, Combatant> = {};
  for (const [id, c] of Object.entries(battle.combatants)) combatants[id] = { ...c, guarding: false };

  // Every living fighter needs a move; AI fills in for the uncontrolled ones.
  const pending: Record<string, string> = { ...battle.pending };
  for (const c of Object.values(combatants)) {
    if (alive(c) && !pending[c.id]) pending[c.id] = c.controllerId ? 'guard' : aiChoose(c, rng);
  }

  // Guard is a stance for the whole round, so mark it before anyone acts.
  for (const c of Object.values(combatants)) {
    if (getMove(pending[c.id] ?? '')?.kind === 'defend') c.guarding = true;
  }

  const order = Object.values(combatants)
    .filter(alive)
    .sort((a, b) => b.speed - a.speed || (a.id < b.id ? -1 : 1))
    .map((c) => c.id);

  const log = [...battle.log];
  let fled = false;

  for (const id of order) {
    const actor = combatants[id];
    if (!actor || !alive(actor)) continue;
    const move = getMove(pending[id] ?? '');
    if (!move) continue;

    if (move.kind === 'defend') {
      log.push(`${actor.name} raises their guard.`);
      continue;
    }
    if (move.kind === 'heal') {
      const roll = rollMove(move, rng);
      const healed = roll + (move.bonus ?? 0);
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + healed);
      const bonus = move.bonus ? ` + ${move.bonus}` : '';
      log.push(`${actor.name} uses ${move.name} — 🎲 ${roll}${bonus} = ${actor.hp - before} HP recovered.`);
      continue;
    }
    if (move.kind === 'flee') {
      if (actor.side === 'party') {
        fled = true;
        log.push(`${actor.name} flees the battle!`);
        break;
      }
      continue;
    }

    // attack: roll to hit, then roll for strength (dice + attack − defense)
    const target = Object.values(combatants).find((c) => c.side !== actor.side && alive(c));
    if (!target) continue;
    if (rng() * 100 >= move.accuracy) {
      log.push(`${actor.name} uses ${move.name}, but misses!`);
      continue;
    }
    const roll = rollMove(move, rng);
    const dmg = attackDamage(move, actor, target, roll);
    target.hp = Math.max(0, target.hp - dmg);
    const resistLabel = move.type === 'magic' ? 'RES' : 'ARM';
    const guarded = target.guarding ? ' (guarded)' : '';
    log.push(
      `${actor.name} uses ${move.name} — 🎲 ${roll} + ${actor.power} PWR − ${resistTo(move, target)} ${resistLabel} = ${dmg} dmg${guarded}.` +
        (target.hp <= 0 ? ` ${target.name} is defeated!` : ''),
    );
  }

  const list = Object.values(combatants);
  const partyAlive = list.some((c) => c.side === 'party' && alive(c));
  const foeAlive = list.some((c) => c.side === 'foe' && alive(c));

  let phase: Battle['phase'] = 'choosing';
  let winner: Battle['winner'] | undefined;
  if (fled) phase = 'over';
  else if (!foeAlive) {
    phase = 'over';
    winner = 'party';
  } else if (!partyAlive) {
    phase = 'over';
    winner = 'foe';
  }

  return {
    ...battle,
    combatants,
    pending: {},
    round: battle.round + 1,
    log: log.slice(-40),
    phase,
    winner,
    fled: fled || battle.fled,
  };
}
