import { describe, it, expect } from 'vitest';
import type { Combatant } from '../entities';
import { getMove } from '../content/moves';
import { chooseMove, computeDamage, isReadyToResolve, resolveRound, startBattle } from './battle';

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
  attack: 2,
  defense: 1,
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
  attack: 2,
  defense: 0,
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

  it('computes damage as power + attack - defense, floored at 1', () => {
    expect(computeDamage(strike, hero({ attack: 2 }), foe({ defense: 0 }))).toBe(8);
    expect(computeDamage(strike, hero({ attack: 0 }), foe({ defense: 99 }))).toBe(1);
  });

  it('halves damage against a guarding target', () => {
    expect(computeDamage(strike, hero({ attack: 2 }), foe({ defense: 0, guarding: true }))).toBe(4);
  });

  it('resolves rounds until the party defeats the foe, and clears guard each round', () => {
    let battle = startBattle([hero({ hp: 60, maxHp: 60 }), foe()], 42);
    for (let i = 0; i < 20 && battle.phase === 'choosing'; i++) {
      battle = chooseMove(battle, 'hero', 'strike').battle;
      battle = resolveRound(battle);
    }
    expect(battle.phase).toBe('over');
    expect(battle.winner).toBe('party');
    expect(battle.combatants['foe']!.guarding).toBe(false);
    expect(battle.round).toBeGreaterThan(1);
  });

  it('heals with Second Wind, capped at max HP', () => {
    let battle = startBattle([hero({ hp: 5, moves: ['second-wind'] }), foe({ moves: ['guard'] })], 3);
    battle = chooseMove(battle, 'hero', 'second-wind').battle;
    battle = resolveRound(battle);
    expect(battle.combatants['hero']!.hp).toBe(13); // 5 + 8
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
