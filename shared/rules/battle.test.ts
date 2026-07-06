import { describe, it, expect } from 'vitest';
import type { Combatant } from '../entities';
import { getMove } from '../content/moves';
import { attackDamage, chooseMove, isReadyToResolve, resolveRound, startBattle } from './battle';

const strike = getMove('strike')!;

const hero = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'hero',
  tokenId: 'hero',
  side: 'party',
  name: 'Hero',
  visual: { color: '#fff', icon: '⚔️' },
  hp: 20,
  maxHp: 20,
  speed: 40,
  power: 2,
  armor: 1,
  magicResist: 0,
  guarding: false,
  controllerId: 'p2',
  moves: ['strike', 'heavy', 'guard', 'second-wind', 'flee'],
  ...over,
});

const foe = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'foe',
  tokenId: 'foe',
  side: 'foe',
  name: 'Goblin',
  visual: { color: '#4d7c0f', icon: '👺' },
  hp: 7,
  maxHp: 7,
  speed: 30,
  power: 2,
  armor: 0,
  magicResist: 0,
  guarding: false,
  moves: ['strike', 'heavy', 'guard'],
  ...over,
});

describe('battle engine', () => {
  it('waits for the controlled fighter before resolving', () => {
    const battle = startBattle([hero(), foe()], 1);
    expect(isReadyToResolve(battle)).toBe(false);
    const after = chooseMove(battle, 'hero', 'strike').battle;
    expect(isReadyToResolve(after)).toBe(true);
  });

  it('rejects a move the fighter does not have', () => {
    const battle = startBattle([hero({ moves: ['strike'] }), foe()], 1);
    expect(chooseMove(battle, 'hero', 'heavy').error).toBeDefined();
  });

  it('computes damage as roll + power - armor, floored at 1', () => {
    expect(attackDamage(strike, hero({ power: 2 }), foe({ armor: 0 }), 4)).toBe(6); // 4 + 2 - 0
    expect(attackDamage(strike, hero({ power: 0 }), foe({ armor: 99 }), 4)).toBe(1); // floored
  });

  it('halves damage against a guarding target', () => {
    expect(attackDamage(strike, hero({ power: 2 }), foe({ armor: 0, guarding: true }), 4)).toBe(3); // 6 -> ceil(3)
  });

  it('routes physical damage through armor and magic through magic resist', () => {
    const firebolt = getMove('firebolt')!;
    // Physical strike is stopped by armor, ignores magic resist.
    expect(attackDamage(strike, hero({ power: 2 }), foe({ armor: 5, magicResist: 0 }), 6)).toBe(3); // 6 + 2 - 5
    // Magic firebolt ignores armor, is stopped by magic resist.
    expect(attackDamage(firebolt, hero({ power: 2 }), foe({ armor: 5, magicResist: 0 }), 6)).toBe(8); // 6 + 2 - 0
    expect(attackDamage(firebolt, hero({ power: 2 }), foe({ armor: 0, magicResist: 5 }), 6)).toBe(3); // 6 + 2 - 5
  });

  it('resolves rounds until the party defeats the foe, and clears guard each round', () => {
    // Foe kept to a single non-guard move so the multi-round loop is guard-free.
    let battle = startBattle([hero({ hp: 60, maxHp: 60 }), foe({ hp: 30, maxHp: 30, moves: ['strike'] })], 42);
    for (let i = 0; i < 30 && battle.phase === 'choosing'; i++) {
      battle = chooseMove(battle, 'hero', 'strike').battle;
      battle = resolveRound(battle);
    }
    expect(battle.phase).toBe('over');
    expect(battle.winner).toBe('party');
    expect(battle.combatants['foe']!.guarding).toBe(false);
    expect(battle.round).toBeGreaterThan(1);
  });

  it('heals with Second Wind (1d8 + 2), capped at max HP', () => {
    // From 5 HP: 1d8 + 2 lands somewhere in 8..15.
    let low = startBattle([hero({ hp: 5, maxHp: 20, moves: ['second-wind'] }), foe({ moves: ['guard'] })], 3);
    low = chooseMove(low, 'hero', 'second-wind').battle;
    low = resolveRound(low);
    const healed = low.combatants['hero']!.hp;
    expect(healed).toBeGreaterThanOrEqual(8);
    expect(healed).toBeLessThanOrEqual(15);

    // From 19/20 HP, any roll caps exactly at max.
    let capped = startBattle([hero({ hp: 19, maxHp: 20, moves: ['second-wind'] }), foe({ moves: ['guard'] })], 3);
    capped = chooseMove(capped, 'hero', 'second-wind').battle;
    capped = resolveRound(capped);
    expect(capped.combatants['hero']!.hp).toBe(20);
  });

  it('ends the battle when the party flees', () => {
    let battle = startBattle([hero(), foe()], 9);
    battle = chooseMove(battle, 'hero', 'flee').battle;
    battle = resolveRound(battle);
    expect(battle.phase).toBe('over');
    expect(battle.fled).toBe(true);
    expect(battle.winner).toBeUndefined();
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      let b = startBattle([hero({ hp: 30, maxHp: 30 }), foe({ hp: 30, maxHp: 30 })], 123);
      b = chooseMove(b, 'hero', 'heavy').battle;
      return resolveRound(b);
    };
    expect(run().combatants['foe']!.hp).toBe(run().combatants['foe']!.hp);
  });
});
