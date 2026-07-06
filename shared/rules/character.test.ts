import { describe, it, expect } from 'vitest';
import type { Abilities, CharacterDraft } from '../entities';
import { getRace } from '../content/races';
import { getClass } from '../content/classes';
import {
  abilityMod,
  applyRaceMods,
  baseAbilities,
  buildCharacter,
  deriveStats,
  isLegalPointBuy,
  totalPointBuyCost,
} from './character';

const scores = (partial: Partial<Abilities>): Abilities => ({ ...baseAbilities(), ...partial });

describe('point-buy', () => {
  it('the all-8 baseline costs nothing', () => {
    expect(totalPointBuyCost(baseAbilities())).toBe(0);
    expect(isLegalPointBuy(baseAbilities())).toBe(true);
  });

  it('charges 9 points for a 15 and rejects overspending', () => {
    // 15 costs 9; three 15s = 27 (exactly the budget) is legal.
    expect(isLegalPointBuy(scores({ str: 15, dex: 15, con: 15 }))).toBe(true);
    // Four 15s = 36 > 27 budget.
    expect(isLegalPointBuy(scores({ str: 15, dex: 15, con: 15, int: 15 }))).toBe(false);
  });

  it('rejects scores outside the 8..15 range', () => {
    expect(totalPointBuyCost(scores({ str: 16 }))).toBeNull();
    expect(totalPointBuyCost(scores({ str: 7 }))).toBeNull();
    expect(isLegalPointBuy(scores({ str: 16 }))).toBe(false);
  });
});

describe('derivation', () => {
  it('computes ability modifiers the D&D way', () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(14)).toBe(2);
    expect(abilityMod(8)).toBe(-1);
  });

  it('adds racial mods on top of base scores', () => {
    const dwarf = getRace('dwarf')!;
    const final = applyRaceMods(scores({ con: 14 }), dwarf);
    expect(final.con).toBe(16); // 14 + 2 from dwarf
  });

  it('derives HP/AC from final scores and speed from race', () => {
    const elf = getRace('elf')!;
    const final = applyRaceMods(scores({ con: 14, dex: 13 }), elf); // dex 13 + 2 = 15
    const derived = deriveStats(final, elf, getClass('mage')!); // mage: +0 HP bonus
    expect(derived.maxHp).toBe(12); // 10 + con mod (+2)
    expect(derived.ac).toBe(12); //   10 + dex mod (+2 at 15)
    expect(derived.speed).toBe(30);
    expect(derived.initiative).toBe(2);
  });
});

describe('buildCharacter', () => {
  it('produces a full-HP level-1 character owned by the player', () => {
    const draft: CharacterDraft = {
      name: 'Gimli',
      raceId: 'dwarf',
      classId: 'warrior',
      visual: { color: '#ef4444', icon: '🔨' },
      baseAbilities: scores({ con: 15, str: 14 }),
    };
    const character = buildCharacter('p2', draft, getRace('dwarf')!, getClass('warrior')!);
    expect(character.ownerId).toBe('p2');
    expect(character.classId).toBe('warrior');
    expect(character.abilities.con).toBe(17); // 15 + 2
    expect(character.hp).toBe(character.maxHp);
    expect(character.level).toBe(1);
  });
});
