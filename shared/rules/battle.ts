import type { Battle, Combatant, Token } from '../entities';
import { getMove, PARTY_MOVES, ENEMY_MOVES, type MoveDef } from '../content/moves';
import { makeRng } from '../world/rng';

/** Damage for a landed attack: power + attack - defense (min 1), halved if guarded. */
export function computeDamage(move: MoveDef, attacker: Combatant, defender: Combatant): number {
  const dmg = Math.max(1, move.power + attacker.attack - defender.defense);
  return defender.guarding ? Math.ceil(dmg / 2) : dmg;
}

/**
 * Pure battle engine. The reducer builds combatants from grid tokens/characters
 * and drives this; everything here is deterministic given the battle's `seed`,
 * so it's fully unit-testable. Sides are arrays, so party/duo fights only need
 * more combatants — the resolver already loops over all of them.
 */

export function partyCombatant(token: Token, attack: number, defense: number): Combatant {
  return {
    id: token.id,
    tokenId: token.id,
    side: 'party',
    name: token.name,
    visual: token.visual,
    hp: token.hp,
    maxHp: token.maxHp,
    speed: token.speed,
    attack,
    defense,
    guarding: false,
    controllerId: token.ownerId,
    moves: PARTY_MOVES,
  };
}

export function foeCombatant(token: Token, attack: number, defense: number): Combatant {
  return {
    id: token.id,
    tokenId: token.id,
    side: 'foe',
    name: token.name,
    visual: token.visual,
    hp: token.hp,
    maxHp: token.maxHp,
    speed: token.speed,
    attack,
    defense,
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
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + move.power);
      log.push(`${actor.name} uses ${move.name} and recovers ${actor.hp - before} HP.`);
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

    // attack
    const target = Object.values(combatants).find((c) => c.side !== actor.side && alive(c));
    if (!target) continue;
    if (rng() * 100 >= move.accuracy) {
      log.push(`${actor.name} uses ${move.name}, but misses!`);
      continue;
    }
    const dmg = computeDamage(move, actor, target);
    target.hp = Math.max(0, target.hp - dmg);
    log.push(
      `${actor.name} uses ${move.name} for ${dmg} damage.` + (target.hp <= 0 ? ` ${target.name} is defeated!` : ''),
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
