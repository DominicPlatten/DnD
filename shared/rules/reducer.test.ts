import { describe, it, expect } from 'vitest';
import type { Character, Interactable, Token } from '../entities';
import { createInitialState, type GameState } from '../state';
import { applyCommand, markOffline, removePlayer } from './reducer';

const join = (state: ReturnType<typeof createInitialState>, id: string, name: string) =>
  applyCommand(state, { t: 'join', name }, { id }).state;

describe('reducer', () => {
  it('makes the first player to join the GM', () => {
    const s = join(createInitialState('ABCDE'), 'p1', 'Alice');
    expect(s.gmId).toBe('p1');
    expect(s.players['p1']!.role).toBe('gm');
  });

  it('makes later joiners regular players', () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice');
    s = join(s, 'p2', 'Bob');
    expect(s.players['p2']!.role).toBe('player');
    expect(s.gmId).toBe('p1');
  });

  it('lets only the GM advance the phase', () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice');
    s = join(s, 'p2', 'Bob');

    const denied = applyCommand(s, { t: 'gm/advancePhase' }, { id: 'p2' });
    expect(denied.error).toBeDefined();
    expect(denied.state.phase).toBe('lobby');

    const ok = applyCommand(s, { t: 'gm/advancePhase' }, { id: 'p1' });
    expect(ok.error).toBeUndefined();
    expect(ok.state.phase).toBe('setup');
  });

  it('hands the GM role to a remaining player when the GM leaves', () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice');
    s = join(s, 'p2', 'Bob');

    const { state } = removePlayer(s, 'p1');
    expect(state.players['p1']).toBeUndefined();
    expect(state.gmId).toBe('p2');
    expect(state.players['p2']!.role).toBe('gm');
  });
});

describe('reconnection', () => {
  it('marks a dropped player offline but keeps their character and role', () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice'); // GM
    s = join(s, 'p2', 'Bob');
    s = applyCommand(
      s,
      { t: 'createCharacter', draft: { name: 'Bob', raceId: 'elf', classId: 'rogue', visual: { color: '#22c55e', icon: '🏹' }, baseAbilities: { str: 8, dex: 15, con: 12, int: 10, mag: 13, cha: 10 } } },
      { id: 'p2' },
    ).state;

    const { state } = markOffline(s, 'p2');
    expect(state.players['p2']!.connected).toBe(false);
    expect(state.players['p2']!.role).toBe('player');
    expect(state.characters['p2']).toBeDefined(); // character preserved
  });

  it('re-attaches a returning id as the same player (still GM, no new slot)', () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice'); // GM
    s = join(s, 'p2', 'Bob');
    s = markOffline(s, 'p1').state;

    // Alice reconnects with the same id.
    const back = applyCommand(s, { t: 'join', name: 'Alice' }, { id: 'p1' }).state;
    expect(Object.keys(back.players)).toHaveLength(2); // no duplicate player
    expect(back.players['p1']!.connected).toBe(true);
    expect(back.gmId).toBe('p1'); // still the GM
  });

  it('a brand-new id joining while the GM is offline does not steal GM', () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice'); // GM
    s = markOffline(s, 'p1').state;
    const withNew = applyCommand(s, { t: 'join', name: 'Newcomer' }, { id: 'p9' }).state;
    expect(withNew.players['p9']!.role).toBe('player');
    expect(withNew.gmId).toBe('p1');
  });

  it('the leave command fully removes the player', () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice');
    s = join(s, 'p2', 'Bob');
    const { state } = applyCommand(s, { t: 'leave' }, { id: 'p2' });
    expect(state.players['p2']).toBeUndefined();
  });

  it('game state round-trips through serialization (so it can be persisted)', () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice');
    s = join(s, 'p2', 'Bob');
    s = applyCommand(s, { t: 'gm/advancePhase' }, { id: 'p1' }).state;
    s = applyCommand(
      s,
      { t: 'createCharacter', draft: { name: 'Bob', raceId: 'dwarf', classId: 'warrior', visual: { color: '#22c55e', icon: '🔨' }, baseAbilities: { str: 14, dex: 10, con: 14, int: 8, mag: 12, cha: 10 } } },
      { id: 'p2' },
    ).state;
    s = applyCommand(s, { t: 'gm/selectWorld', worldType: 'dungeon', seed: 7 }, { id: 'p1' }).state;
    s = applyCommand(s, { t: 'gm/startGame' }, { id: 'p1' }).state;

    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('createCharacter', () => {
  const draft = {
    name: 'Legolas',
    raceId: 'elf',
    classId: 'rogue',
    visual: { color: '#22c55e', icon: '🏹' },
    baseAbilities: { str: 8, dex: 15, con: 12, int: 10, mag: 13, cha: 10 },
  } as const;

  const twoPlayerGame = () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice'); // GM
    s = join(s, 'p2', 'Bob'); // player
    return s;
  };

  it('lets a player create a character and finalizes its stats', () => {
    const { state, events } = applyCommand(twoPlayerGame(), { t: 'createCharacter', draft }, { id: 'p2' });
    const char = state.characters['p2'];
    expect(char).toBeDefined();
    expect(char!.abilities.dex).toBe(17); // 15 + 2 elf
    expect(char!.hp).toBe(char!.maxHp);
    expect(events).toContainEqual({ t: 'characterReady', name: 'Legolas' });
  });

  it('forbids the GM from making a character', () => {
    const denied = applyCommand(twoPlayerGame(), { t: 'createCharacter', draft }, { id: 'p1' });
    expect(denied.error).toBeDefined();
    expect(denied.state.characters['p1']).toBeUndefined();
  });

  it('rejects an illegal point-buy', () => {
    const cheating = { ...draft, baseAbilities: { str: 18, dex: 18, con: 18, int: 18, mag: 18, cha: 18 } };
    const denied = applyCommand(twoPlayerGame(), { t: 'createCharacter', draft: cheating }, { id: 'p2' });
    expect(denied.error).toBeDefined();
    expect(denied.state.characters['p2']).toBeUndefined();
  });

  it('treats a resubmission as an edit without re-announcing', () => {
    let s = twoPlayerGame();
    s = applyCommand(s, { t: 'createCharacter', draft }, { id: 'p2' }).state;
    const second = applyCommand(s, { t: 'createCharacter', draft: { ...draft, name: 'Legolas II' } }, { id: 'p2' });
    expect(second.state.characters['p2']!.name).toBe('Legolas II');
    expect(second.events).toHaveLength(0);
  });
});

describe('world & start', () => {
  const setupGame = () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice'); // GM
    s = join(s, 'p2', 'Bob'); // player
    s = applyCommand(s, { t: 'gm/advancePhase' }, { id: 'p1' }).state; // -> setup
    s = applyCommand(
      s,
      {
        t: 'createCharacter',
        draft: {
          name: 'Bob',
          raceId: 'human',
          classId: 'warrior',
          visual: { color: '#3b82f6', icon: '⚔️' },
          baseAbilities: { str: 12, dex: 12, con: 12, int: 12, mag: 12, cha: 8 },
        },
      },
      { id: 'p2' },
    ).state;
    return s;
  };

  it('lets the GM generate a world during setup', () => {
    const { state, events } = applyCommand(setupGame(), { t: 'gm/selectWorld', worldType: 'dungeon', seed: 42 }, { id: 'p1' });
    expect(state.map?.worldType).toBe('dungeon');
    expect(state.map?.tiles.length).toBe(state.map!.width * state.map!.height);
    expect(events).toContainEqual({ t: 'worldChosen', worldName: 'Forgotten Dungeon' });
  });

  it('forbids a non-GM from choosing the world', () => {
    const denied = applyCommand(setupGame(), { t: 'gm/selectWorld', worldType: 'dungeon', seed: 42 }, { id: 'p2' });
    expect(denied.error).toBeDefined();
    expect(denied.state.map).toBeNull();
  });

  it('refuses to start without a world', () => {
    const denied = applyCommand(setupGame(), { t: 'gm/startGame' }, { id: 'p1' });
    expect(denied.error).toBeDefined();
    expect(denied.state.phase).toBe('setup');
  });

  it('starts the game and spawns a token per character on passable ground', () => {
    let s = setupGame();
    s = applyCommand(s, { t: 'gm/selectWorld', worldType: 'forest', seed: 7 }, { id: 'p1' }).state;
    const { state } = applyCommand(s, { t: 'gm/startGame' }, { id: 'p1' });

    expect(state.phase).toBe('playing');
    const tokens = Object.values(state.tokens);
    expect(tokens).toHaveLength(1); // one character -> one token
    const token = tokens[0]!;
    expect(token.kind).toBe('pc');
    expect(token.ownerId).toBe('p2');
    const spawn = state.map!.spawnPoints;
    expect(spawn).toContainEqual(token.coord);
  });

  it('rolls initiative for the party on start', () => {
    let s = setupGame();
    s = applyCommand(s, { t: 'gm/selectWorld', worldType: 'dungeon', seed: 3 }, { id: 'p1' }).state;
    const { state } = applyCommand(s, { t: 'gm/startGame' }, { id: 'p1' });
    expect(state.initiative?.order).toContain('p2');
    expect(state.initiative?.round).toBe(1);
  });
});

describe('turns & movement', () => {
  const mkToken = (id: string, partial: Partial<Token>): Token => ({
    id,
    kind: 'pc',
    name: id,
    visual: { color: '#fff', icon: '⚔️' },
    coord: { x: 0, y: 0 },
    hp: 10,
    maxHp: 10,
    initiative: 0,
    speed: 30,
    statuses: [],
    ...partial,
  });

  // Hand-built playing state on an all-floor 3x1 map for predictable moves.
  const playing = (): GameState => ({
    ...createInitialState('ABCDE'),
    phase: 'playing',
    gmId: 'p1',
    players: {
      p1: { id: 'p1', name: 'GM', role: 'gm', connected: true },
      p2: { id: 'p2', name: 'Bob', role: 'player', connected: true },
    },
    map: { worldType: 'test', seed: 1, width: 3, height: 1, tiles: ['floor', 'floor', 'floor'], spawnPoints: [{ x: 0, y: 0 }] },
    tokens: {
      p2: mkToken('p2', { coord: { x: 0, y: 0 }, ownerId: 'p2' }),
      e1: mkToken('e1', { kind: 'enemy', name: 'Goblin', coord: { x: 2, y: 0 } }),
    },
    initiative: { order: ['p2', 'e1'], currentIndex: 0, round: 1 },
  });

  it('lets a player move their own token on their turn', () => {
    const { state, error } = applyCommand(playing(), { t: 'moveToken', tokenId: 'p2', to: { x: 1, y: 0 } }, { id: 'p2' });
    expect(error).toBeUndefined();
    expect(state.tokens['p2']!.coord).toEqual({ x: 1, y: 0 });
  });

  it('blocks moving onto an occupied tile', () => {
    const denied = applyCommand(playing(), { t: 'moveToken', tokenId: 'p2', to: { x: 2, y: 0 } }, { id: 'p2' });
    expect(denied.error).toMatch(/already there/);
  });

  it("forbids moving another player's token", () => {
    const denied = applyCommand(playing(), { t: 'moveToken', tokenId: 'e1', to: { x: 1, y: 0 } }, { id: 'p2' });
    expect(denied.error).toBeDefined();
  });

  it('lets the GM move any token anywhere passable', () => {
    const { state, error } = applyCommand(playing(), { t: 'moveToken', tokenId: 'e1', to: { x: 1, y: 0 } }, { id: 'p1' });
    expect(error).toBeUndefined();
    expect(state.tokens['e1']!.coord).toEqual({ x: 1, y: 0 });
  });

  it('refuses a move when it is not the player\'s turn', () => {
    const s = playing();
    s.initiative = { order: ['p2', 'e1'], currentIndex: 1, round: 1 }; // Goblin's turn
    const denied = applyCommand(s, { t: 'moveToken', tokenId: 'p2', to: { x: 1, y: 0 } }, { id: 'p2' });
    expect(denied.error).toMatch(/not your turn/i);
  });

  it('advances the turn on endTurn and enforces ownership', () => {
    const denied = applyCommand(playing(), { t: 'endTurn' }, { id: 'someone-else' });
    expect(denied.error).toBeDefined();

    const ok = applyCommand(playing(), { t: 'endTurn' }, { id: 'p2' });
    expect(ok.state.initiative?.currentIndex).toBe(1);

    // GM can always end the current turn.
    const gm = applyCommand(playing(), { t: 'endTurn' }, { id: 'p1' });
    expect(gm.state.initiative?.currentIndex).toBe(1);
  });
});

describe('GM combat controls', () => {
  const character: Character = {
    id: 'p2',
    ownerId: 'p2',
    name: 'Bob',
    raceId: 'human',
    classId: 'warrior',
    visual: { color: '#fff', icon: '⚔️' },
    level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, mag: 10, cha: 10 },
    hp: 12,
    maxHp: 12,
    ac: 10,
    speed: 30,
    initiative: 0,
    inventory: [],
  };
  const pcToken: Token = {
    id: 'p2',
    kind: 'pc',
    name: 'Bob',
    visual: { color: '#fff', icon: '⚔️' },
    coord: { x: 0, y: 0 },
    hp: 12,
    maxHp: 12,
    initiative: 0,
    speed: 30,
    statuses: [],
    ownerId: 'p2',
  };
  const base = (): GameState => ({
    ...createInitialState('ABCDE'),
    phase: 'playing',
    gmId: 'p1',
    players: {
      p1: { id: 'p1', name: 'GM', role: 'gm', connected: true },
      p2: { id: 'p2', name: 'Bob', role: 'player', connected: true },
    },
    characters: { p2: character },
    map: { worldType: 'test', seed: 1, width: 3, height: 1, tiles: ['floor', 'floor', 'floor'], spawnPoints: [{ x: 0, y: 0 }] },
    tokens: { p2: pcToken },
    initiative: { order: ['p2'], currentIndex: 0, round: 1 },
  });

  it('clamps HP changes to 0..maxHp', () => {
    expect(applyCommand(base(), { t: 'gm/setHp', tokenId: 'p2', hp: -5 }, { id: 'p1' }).state.tokens['p2']!.hp).toBe(0);
    expect(applyCommand(base(), { t: 'gm/setHp', tokenId: 'p2', hp: 999 }, { id: 'p1' }).state.tokens['p2']!.hp).toBe(12);
  });

  it('applies and removes conditions (apply is idempotent)', () => {
    let s = applyCommand(base(), { t: 'gm/applyStatus', tokenId: 'p2', status: 'poisoned' }, { id: 'p1' }).state;
    s = applyCommand(s, { t: 'gm/applyStatus', tokenId: 'p2', status: 'poisoned' }, { id: 'p1' }).state;
    expect(s.tokens['p2']!.statuses).toEqual(['poisoned']);
    s = applyCommand(s, { t: 'gm/removeStatus', tokenId: 'p2', status: 'poisoned' }, { id: 'p1' }).state;
    expect(s.tokens['p2']!.statuses).toEqual([]);
  });

  it('rejects an unknown condition', () => {
    expect(applyCommand(base(), { t: 'gm/applyStatus', tokenId: 'p2', status: 'nope' }, { id: 'p1' }).error).toBeDefined();
  });

  it('spawns an enemy onto a passable tile and adds it to initiative', () => {
    const { state, events } = applyCommand(base(), { t: 'gm/spawnEnemy', enemyId: 'goblin', tokenId: 'e1', at: { x: 1, y: 0 } }, { id: 'p1' });
    expect(state.tokens['e1']?.kind).toBe('enemy');
    expect(state.tokens['e1']?.hp).toBe(7); // normal tier: unscaled
    expect(state.tokens['e1']?.attack).toBe(0);
    expect(state.initiative?.order).toContain('e1');
    expect(events).toContainEqual({ t: 'enemySpawned', name: 'Goblin' });
  });

  it('scales a spawned enemy up by tier (boss)', () => {
    const { state, events } = applyCommand(
      base(),
      { t: 'gm/spawnEnemy', enemyId: 'goblin', tokenId: 'b1', at: { x: 1, y: 0 }, tier: 'boss' },
      { id: 'p1' },
    );
    const boss = state.tokens['b1']!;
    expect(boss.hp).toBe(15); // round(7 * 2.2)
    expect(boss.maxHp).toBe(15);
    expect(boss.tier).toBe('boss');
    expect(boss.name).toBe('Boss Goblin');
    expect(boss.attack).toBe(2); // max(0, 0 + 2)
    expect(boss.armor).toBe(2); // max(0, 0 + 2)
    expect(boss.magicResist).toBe(2); // max(0, 0 + 2)
    expect(events).toContainEqual({ t: 'enemySpawned', name: 'Boss Goblin' });
  });

  it('refuses to spawn onto an occupied tile', () => {
    const denied = applyCommand(base(), { t: 'gm/spawnEnemy', enemyId: 'goblin', tokenId: 'e1', at: { x: 0, y: 0 } }, { id: 'p1' });
    expect(denied.error).toMatch(/already there/);
  });

  it('removes a token and prunes it from initiative', () => {
    let s = applyCommand(base(), { t: 'gm/spawnEnemy', enemyId: 'goblin', tokenId: 'e1', at: { x: 1, y: 0 } }, { id: 'p1' }).state;
    s = applyCommand(s, { t: 'gm/removeToken', tokenId: 'e1' }, { id: 'p1' }).state;
    expect(s.tokens['e1']).toBeUndefined();
    expect(s.initiative?.order).not.toContain('e1');
  });

  it('gives an item, stacking quantity', () => {
    let s = applyCommand(base(), { t: 'gm/giveItem', charId: 'p2', itemId: 'healing-potion' }, { id: 'p1' }).state;
    s = applyCommand(s, { t: 'gm/giveItem', charId: 'p2', itemId: 'healing-potion' }, { id: 'p1' }).state;
    expect(s.characters['p2']!.inventory).toEqual([{ itemId: 'healing-potion', qty: 2 }]);
  });

  it('blocks a non-GM from using combat controls', () => {
    expect(applyCommand(base(), { t: 'gm/setHp', tokenId: 'p2', hp: 1 }, { id: 'p2' }).error).toBeDefined();
    expect(applyCommand(base(), { t: 'gm/spawnEnemy', enemyId: 'goblin', tokenId: 'e1', at: { x: 1, y: 0 } }, { id: 'p2' }).error).toBeDefined();
  });
});

describe('dice, interaction & the action economy', () => {
  const character = (id: string, name: string): Character => ({
    id,
    ownerId: id,
    name,
    raceId: 'human',
    classId: 'warrior',
    visual: { color: '#fff', icon: '⚔️' },
    level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, mag: 10, cha: 10 },
    hp: 10,
    maxHp: 10,
    ac: 10,
    speed: 30,
    initiative: 0,
    inventory: [],
  });
  const pc = (id: string, x: number, name: string): Token => ({
    id,
    kind: 'pc',
    name,
    visual: { color: '#fff', icon: '⚔️' },
    coord: { x, y: 0 },
    hp: 10,
    maxHp: 10,
    initiative: 0,
    speed: 30,
    statuses: [],
    ownerId: id,
  });

  // 5x2 floor board; Bob at (0,0), Cara at (3,0), a chest by Bob and a door by Cara.
  const play = (): GameState => ({
    ...createInitialState('ABCDE'),
    phase: 'playing',
    gmId: 'p1',
    players: {
      p1: { id: 'p1', name: 'GM', role: 'gm', connected: true },
      p2: { id: 'p2', name: 'Bob', role: 'player', connected: true },
      p3: { id: 'p3', name: 'Cara', role: 'player', connected: true },
    },
    characters: { p2: character('p2', 'Bob'), p3: character('p3', 'Cara') },
    map: { worldType: 'test', seed: 1, width: 5, height: 2, tiles: new Array(10).fill('floor'), spawnPoints: [{ x: 0, y: 0 }] },
    tokens: { p2: pc('p2', 0, 'Bob'), p3: pc('p3', 3, 'Cara') },
    initiative: { order: ['p2', 'p3'], currentIndex: 0, round: 1 },
    interactables: {
      'chest-0': { id: 'chest-0', kind: 'chest', coord: { x: 1, y: 0 }, contents: [{ itemId: 'gold', qty: 1 }], looted: false },
      'door-0': { id: 'door-0', kind: 'door', coord: { x: 4, y: 0 }, open: false },
    },
    turn: { moved: false, acted: false },
  });

  it('rolls dice server-side, clamped and sequenced', () => {
    const r = applyCommand(play(), { t: 'gm/rollDice', sides: 20 }, { id: 'p1', random: 0.5 });
    expect(r.state.lastRoll).toEqual({ sides: 20, value: 11, by: 'GM', seq: 1 });
    expect(r.events).toContainEqual({ t: 'diceRolled', sides: 20, value: 11, by: 'GM' });
    expect(applyCommand(play(), { t: 'gm/rollDice', sides: 6 }, { id: 'p1', random: 0.999999 }).state.lastRoll!.value).toBe(6);
  });

  it('lets only the GM roll', () => {
    expect(applyCommand(play(), { t: 'gm/rollDice', sides: 20 }, { id: 'p2', random: 0.5 }).error).toBeDefined();
  });

  it('loots an adjacent chest into inventory, once, spending the action', () => {
    const { state, events } = applyCommand(play(), { t: 'interact', targetId: 'chest-0' }, { id: 'p2' });
    expect(state.characters['p2']!.inventory).toEqual([{ itemId: 'gold', qty: 1 }]);
    expect(state.interactables['chest-0']!.looted).toBe(true);
    expect(state.turn.acted).toBe(true);
    expect(events.some((e) => e.t === 'chestOpened')).toBe(true);
    expect(applyCommand(state, { t: 'interact', targetId: 'chest-0' }, { id: 'p2' }).error).toMatch(/already acted/);
  });

  it('rejects interacting out of reach', () => {
    expect(applyCommand(play(), { t: 'interact', targetId: 'door-0' }, { id: 'p2' }).error).toMatch(/too far/i);
  });

  it('toggles an adjacent door open', () => {
    const s = play();
    s.initiative = { order: ['p2', 'p3'], currentIndex: 1, round: 1 }; // Cara's turn
    const { state } = applyCommand(s, { t: 'interact', targetId: 'door-0' }, { id: 'p3' });
    expect(state.interactables['door-0']!.open).toBe(true);
  });

  it('greets an adjacent player', () => {
    const s = play();
    s.tokens['p3'] = { ...s.tokens['p3']!, coord: { x: 1, y: 1 } };
    const { events } = applyCommand(s, { t: 'interact', targetId: 'p3' }, { id: 'p2' });
    expect(events).toContainEqual({ t: 'greeted', from: 'Bob', to: 'Cara' });
  });

  it('allows one move per turn; endTurn refreshes the economy', () => {
    const first = applyCommand(play(), { t: 'moveToken', tokenId: 'p2', to: { x: 0, y: 1 } }, { id: 'p2' });
    expect(first.error).toBeUndefined();
    expect(first.state.turn.moved).toBe(true);
    expect(applyCommand(first.state, { t: 'moveToken', tokenId: 'p2', to: { x: 1, y: 1 } }, { id: 'p2' }).error).toMatch(/already moved/);
    expect(applyCommand(first.state, { t: 'endTurn' }, { id: 'p2' }).state.turn).toEqual({ moved: false, acted: false });
  });
});

describe('battle integration', () => {
  const character: Character = {
    id: 'p2', ownerId: 'p2', name: 'Bob', raceId: 'human', classId: 'warrior', visual: { color: '#fff', icon: '⚔️' },
    level: 1, abilities: { str: 16, dex: 12, con: 10, int: 10, mag: 10, cha: 10 },
    hp: 40, maxHp: 40, ac: 10, speed: 40, initiative: 1, inventory: [],
  };
  const pcToken: Token = {
    id: 'p2', kind: 'pc', name: 'Bob', visual: { color: '#fff', icon: '⚔️' }, coord: { x: 0, y: 0 },
    hp: 40, maxHp: 40, initiative: 1, speed: 40, statuses: [], ownerId: 'p2',
  };
  const enemyToken: Token = {
    id: 'gob', kind: 'enemy', name: 'Goblin', visual: { color: '#4d7c0f', icon: '👺' }, coord: { x: 1, y: 0 },
    hp: 7, maxHp: 7, initiative: 2, speed: 30, statuses: [], enemyId: 'goblin',
  };
  const base = (): GameState => ({
    ...createInitialState('ABCDE'),
    phase: 'playing', gmId: 'p1',
    players: {
      p1: { id: 'p1', name: 'GM', role: 'gm', connected: true },
      p2: { id: 'p2', name: 'Bob', role: 'player', connected: true },
    },
    characters: { p2: character },
    map: { worldType: 'test', seed: 1, width: 3, height: 1, tiles: ['floor', 'floor', 'floor'], spawnPoints: [{ x: 0, y: 0 }] },
    tokens: { p2: pcToken, gob: enemyToken },
    initiative: { order: ['p2', 'gob'], currentIndex: 0, round: 1 },
  });

  it('starts a battle when a player engages an adjacent enemy', () => {
    const { state, events } = applyCommand(base(), { t: 'interact', targetId: 'gob' }, { id: 'p2', random: 0.5 });
    expect(state.battle).not.toBeNull();
    expect(state.turn.acted).toBe(true);
    expect(Object.keys(state.battle!.combatants)).toEqual(expect.arrayContaining(['p2', 'gob']));
    expect(events).toContainEqual({ t: 'battleStarted', foe: 'Goblin' });
  });

  it('blocks grid actions while a battle is underway', () => {
    const started = applyCommand(base(), { t: 'interact', targetId: 'gob' }, { id: 'p2', random: 0.5 }).state;
    expect(applyCommand(started, { t: 'moveToken', tokenId: 'p2', to: { x: 0, y: 0 } }, { id: 'p2' }).error).toMatch(/Resolve the battle/);
    expect(applyCommand(started, { t: 'endTurn' }, { id: 'p2' }).error).toMatch(/Resolve the battle/);
  });

  it('lets only a participant choose a move', () => {
    const s = applyCommand(base(), { t: 'interact', targetId: 'gob' }, { id: 'p2', random: 0.3 }).state;
    expect(applyCommand(s, { t: 'battle/chooseMove', moveId: 'strike' }, { id: 'p1' }).error).toBeDefined();
    expect(applyCommand(s, { t: 'battle/chooseMove', moveId: 'strike' }, { id: 'p2' }).error).toBeUndefined();
  });

  it('fights to a party victory, then dismiss cleans up the grid', () => {
    let s = applyCommand(base(), { t: 'interact', targetId: 'gob' }, { id: 'p2', random: 0.3 }).state;
    for (let i = 0; i < 25 && s.battle && s.battle.phase === 'choosing'; i++) {
      s = applyCommand(s, { t: 'battle/chooseMove', moveId: 'strike' }, { id: 'p2' }).state;
    }
    expect(s.battle!.phase).toBe('over');
    expect(s.battle!.winner).toBe('party');

    const done = applyCommand(s, { t: 'battle/dismiss' }, { id: 'p2' }).state;
    expect(done.battle).toBeNull();
    expect(done.tokens['gob']).toBeUndefined();
    expect(done.initiative!.order).not.toContain('gob');
    expect(done.tokens['p2']).toBeDefined();
  });
});

describe('classes & INT skill checks', () => {
  // A Mage with INT/MAG 16 (both +3 modifiers) on a 3-tile floor.
  const mage: Character = {
    id: 'p2', ownerId: 'p2', name: 'Merlin', raceId: 'human', classId: 'mage',
    visual: { color: '#a855f7', icon: '🔮' }, level: 1,
    abilities: { str: 8, dex: 10, con: 10, int: 16, mag: 16, cha: 10 },
    hp: 10, maxHp: 10, ac: 10, speed: 30, initiative: 0, inventory: [],
  };
  const mageToken: Token = {
    id: 'p2', kind: 'pc', name: 'Merlin', visual: { color: '#a855f7', icon: '🔮' },
    coord: { x: 0, y: 0 }, hp: 10, maxHp: 10, initiative: 0, speed: 30, statuses: [], ownerId: 'p2',
  };
  const base = (tokens: Record<string, Token> = {}, interactables: Record<string, Interactable> = {}): GameState => ({
    ...createInitialState('ABCDE'),
    phase: 'playing', gmId: 'p1',
    players: {
      p1: { id: 'p1', name: 'GM', role: 'gm', connected: true },
      p2: { id: 'p2', name: 'Merlin', role: 'player', connected: true },
    },
    characters: { p2: mage },
    map: { worldType: 'test', seed: 1, width: 3, height: 1, tiles: ['floor', 'floor', 'floor'], spawnPoints: [{ x: 0, y: 0 }] },
    tokens: { p2: mageToken, ...tokens },
    initiative: { order: ['p2'], currentIndex: 0, round: 1 },
    interactables,
  });

  it("builds a battle combatant from the player's class (magic power + kit)", () => {
    const skeleton: Token = {
      id: 'sk', kind: 'enemy', name: 'Skeleton', visual: { color: '#d1d5db', icon: '💀' },
      coord: { x: 1, y: 0 }, hp: 13, maxHp: 13, initiative: 2, speed: 30, statuses: [],
      enemyId: 'skeleton', attack: 1, armor: 3, magicResist: 0,
    };
    const { state } = applyCommand(base({ sk: skeleton }), { t: 'interact', targetId: 'sk' }, { id: 'p2', random: 0.5 });
    const me = state.battle!.combatants['p2']!;
    expect(me.moves).toContain('firebolt'); // mage kit, not the generic set
    expect(me.power).toBe(3); // MAG 16 -> +3
    const foe = state.battle!.combatants['sk']!;
    expect(foe.armor).toBe(3); // Mage's magic will bypass this...
    expect(foe.magicResist).toBe(0); // ...and meet no resistance here
  });

  it('a locked chest needs an INT check: a low roll fails and still spends the action', () => {
    const chest: Interactable = { id: 'c1', kind: 'chest', coord: { x: 1, y: 0 }, contents: [{ itemId: 'gold', qty: 1 }], looted: false, dc: 15 };
    // random 0 -> d20 = 1; 1 + INT(+3) = 4 < 15.
    const { state, events } = applyCommand(base({}, { c1: chest }), { t: 'interact', targetId: 'c1' }, { id: 'p2', random: 0 });
    expect(state.interactables['c1']!.looted).toBe(false);
    expect(state.characters['p2']!.inventory).toEqual([]);
    expect(state.turn.acted).toBe(true);
    expect(state.lastRoll).toEqual({ sides: 20, value: 1, by: 'Merlin', seq: 1 });
    expect(events).toContainEqual({ t: 'lockAttempt', by: 'Merlin', target: 'chest', success: false, roll: 1, total: 4, dc: 15 });
  });

  it('a high roll picks the lock and loots the chest', () => {
    const chest: Interactable = { id: 'c1', kind: 'chest', coord: { x: 1, y: 0 }, contents: [{ itemId: 'gold', qty: 1 }], looted: false, dc: 15 };
    // random 0.99 -> d20 = 20; 20 + 3 = 23 >= 15.
    const { state, events } = applyCommand(base({}, { c1: chest }), { t: 'interact', targetId: 'c1' }, { id: 'p2', random: 0.99 });
    expect(state.interactables['c1']!.looted).toBe(true);
    expect(state.characters['p2']!.inventory).toEqual([{ itemId: 'gold', qty: 1 }]);
    expect(events.some((e) => e.t === 'chestOpened')).toBe(true);
    expect(events).toContainEqual({ t: 'lockAttempt', by: 'Merlin', target: 'chest', success: true, roll: 20, total: 23, dc: 15 });
  });

  it('an unlocked door (dc 0) opens with no check', () => {
    const door: Interactable = { id: 'd1', kind: 'door', coord: { x: 1, y: 0 }, open: false };
    const { state, events } = applyCommand(base({}, { d1: door }), { t: 'interact', targetId: 'd1' }, { id: 'p2', random: 0 });
    expect(state.interactables['d1']!.open).toBe(true);
    expect(events).toContainEqual({ t: 'doorToggled', open: true });
    expect(events.some((e) => e.t === 'lockAttempt')).toBe(false);
  });
});
