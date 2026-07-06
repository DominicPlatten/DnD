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
    expect(state.characters['p2']).toBeDefined();
  });

  it('re-attaches a returning id as the same player (still GM, no new slot)', () => {
    let s = join(createInitialState('ABCDE'), 'p1', 'Alice'); // GM
    s = join(s, 'p2', 'Bob');
    s = markOffline(s, 'p1').state;

    const back = applyCommand(s, { t: 'join', name: 'Alice' }, { id: 'p1' }).state;
    expect(Object.keys(back.players)).toHaveLength(2);
    expect(back.players['p1']!.connected).toBe(true);
    expect(back.gmId).toBe('p1');
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
    expect(char!.notes).toEqual([]);
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
    expect(tokens).toHaveLength(1);
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

  const playing = (): GameState => ({
    ...createInitialState('ABCDE'),
    phase: 'playing',
    gmId: 'p1',
    players: {
      p1: { id: 'p1', name: 'GM', role: 'gm', connected: true },
      p2: { id: 'p2', name: 'Bob', role: 'player', connected: true },
      p3: { id: 'p3', name: 'Cara', role: 'player', connected: true },
    },
    map: { worldType: 'test', seed: 1, width: 3, height: 1, tiles: ['floor', 'floor', 'floor'], spawnPoints: [{ x: 0, y: 0 }] },
    tokens: {
      p2: mkToken('p2', { coord: { x: 0, y: 0 }, ownerId: 'p2' }),
      p3: mkToken('p3', { coord: { x: 2, y: 0 }, ownerId: 'p3' }),
    },
    initiative: { order: ['p2', 'p3'], currentIndex: 0, round: 1 },
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
    const denied = applyCommand(playing(), { t: 'moveToken', tokenId: 'p3', to: { x: 1, y: 0 } }, { id: 'p2' });
    expect(denied.error).toBeDefined();
  });

  it('lets the GM move any token anywhere passable', () => {
    const { state, error } = applyCommand(playing(), { t: 'moveToken', tokenId: 'p3', to: { x: 1, y: 0 } }, { id: 'p1' });
    expect(error).toBeUndefined();
    expect(state.tokens['p3']!.coord).toEqual({ x: 1, y: 0 });
  });

  it("refuses a move when it is not the player's turn", () => {
    const s = playing();
    s.initiative = { order: ['p2', 'p3'], currentIndex: 1, round: 1 };
    const denied = applyCommand(s, { t: 'moveToken', tokenId: 'p2', to: { x: 1, y: 0 } }, { id: 'p2' });
    expect(denied.error).toMatch(/not your turn/i);
  });

  it('advances the turn on endTurn and enforces ownership', () => {
    const denied = applyCommand(playing(), { t: 'endTurn' }, { id: 'someone-else' });
    expect(denied.error).toBeDefined();

    const ok = applyCommand(playing(), { t: 'endTurn' }, { id: 'p2' });
    expect(ok.state.initiative?.currentIndex).toBe(1);

    const gm = applyCommand(playing(), { t: 'endTurn' }, { id: 'p1' });
    expect(gm.state.initiative?.currentIndex).toBe(1);
  });
});

describe('GM toolkit', () => {
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
    notes: [],
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

  it('gives an item, stacking quantity', () => {
    let s = applyCommand(base(), { t: 'gm/giveItem', charId: 'p2', itemId: 'healing-potion' }, { id: 'p1' }).state;
    s = applyCommand(s, { t: 'gm/giveItem', charId: 'p2', itemId: 'healing-potion' }, { id: 'p1' }).state;
    expect(s.characters['p2']!.inventory).toEqual([{ itemId: 'healing-potion', qty: 2 }]);
  });

  it('blocks a non-GM from using GM controls', () => {
    expect(applyCommand(base(), { t: 'gm/setHp', tokenId: 'p2', hp: 1 }, { id: 'p2' }).error).toBeDefined();
    expect(applyCommand(base(), { t: 'gm/rollDice', sides: 20 }, { id: 'p2', random: 0.5 }).error).toBeDefined();
  });

  it('places and removes scene objects', () => {
    let s = applyCommand(base(), { t: 'gm/placeObject', id: 'obj1', sprite: '🔮', label: 'Orb', at: { x: 1, y: 0 }, blocksMovement: false, collectible: false, description: '', statusEffects: { apply: [], remove: [] } }, { id: 'p1' }).state;
    expect(s.sceneObjects['obj1']).toBeDefined();
    expect(s.sceneObjects['obj1']!.sprite).toBe('🔮');
    s = applyCommand(s, { t: 'gm/removeObject', id: 'obj1' }, { id: 'p1' }).state;
    expect(s.sceneObjects['obj1']).toBeUndefined();
  });

  it('rejects placing an object on a non-passable tile or with an invalid sprite', () => {
    const wallMap: GameState = {
      ...base(),
      map: { worldType: 'test', seed: 1, width: 3, height: 1, tiles: ['floor', 'wall', 'floor'], spawnPoints: [{ x: 0, y: 0 }] },
    };
    expect(applyCommand(wallMap, { t: 'gm/placeObject', id: 'o', sprite: '🔮', label: 'Orb', at: { x: 1, y: 0 }, blocksMovement: false, collectible: false, description: '', statusEffects: { apply: [], remove: [] } }, { id: 'p1' }).error).toBeDefined();
    expect(applyCommand(base(), { t: 'gm/placeObject', id: 'o', sprite: '🚫', label: 'Bad', at: { x: 1, y: 0 }, blocksMovement: false, collectible: false, description: '', statusEffects: { apply: [], remove: [] } }, { id: 'p1' }).error).toBeDefined();
  });
});

describe('scene object interaction & narration', () => {
  const character: Character = {
    id: 'p2', ownerId: 'p2', name: 'Bob', raceId: 'human', classId: 'warrior',
    visual: { color: '#fff', icon: '⚔️' }, level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, mag: 10, cha: 10 },
    hp: 12, maxHp: 12, ac: 10, speed: 30, initiative: 0, inventory: [], notes: [],
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
    tokens: { p2: { id: 'p2', kind: 'pc', name: 'Bob', visual: { color: '#fff', icon: '⚔️' }, coord: { x: 0, y: 0 }, hp: 12, maxHp: 12, initiative: 0, speed: 30, statuses: [], ownerId: 'p2' } },
    initiative: { order: ['p2'], currentIndex: 0, round: 1 },
    sceneObjects: {
      orb1: { id: 'orb1', sprite: '🔮', label: 'Glowing Orb', coord: { x: 1, y: 0 }, blocksMovement: false, collectible: true, description: 'A pulsing crystal orb.', statusEffects: { apply: [], remove: [] } },
      sign1: { id: 'sign1', sprite: '📜', label: 'Ancient Sign', coord: { x: 1, y: 0 }, blocksMovement: false, collectible: false, description: '', statusEffects: { apply: [], remove: [] } },
    },
  });

  it('collectible objects are auto-collected on interact: removed from map and note added', () => {
    const { state, events } = applyCommand(base(), { t: 'interact', targetId: 'orb1' }, { id: 'p2' });
    expect(state.pendingInteraction).toBeNull();
    expect(state.turn.acted).toBe(true);
    expect(state.sceneObjects['orb1']).toBeUndefined();
    expect(state.characters['p2']!.notes).toHaveLength(1);
    expect(state.characters['p2']!.notes[0]).toMatchObject({ sprite: '🔮', label: 'Glowing Orb', text: 'A pulsing crystal orb.' });
    expect(events).toContainEqual({ t: 'objectCollected', playerName: 'Bob', objectLabel: 'Glowing Orb' });
  });

  it('non-collectible objects set pendingInteraction for GM to narrate', () => {
    const { state, events } = applyCommand(base(), { t: 'interact', targetId: 'sign1' }, { id: 'p2' });
    expect(state.pendingInteraction).toEqual({ objectId: 'sign1', playerId: 'p2' });
    expect(state.turn.acted).toBe(true);
    expect(events).toContainEqual({ t: 'objectInteracted', playerName: 'Bob', objectLabel: 'Ancient Sign' });
  });

  it('rejects interacting from too far away', () => {
    const s: GameState = { ...base(), sceneObjects: { orb1: { id: 'orb1', sprite: '🔮', label: 'Orb', coord: { x: 2, y: 0 }, blocksMovement: false, collectible: false, description: '', statusEffects: { apply: [], remove: [] } } } };
    expect(applyCommand(s, { t: 'interact', targetId: 'orb1' }, { id: 'p2' }).error).toMatch(/too far/i);
  });

  it('GM narrates non-collectible: sends targeted message and clears pendingInteraction', () => {
    let s = applyCommand(base(), { t: 'interact', targetId: 'sign1' }, { id: 'p2' }).state;
    const { state, events, targeted } = applyCommand(s, { t: 'gm/narrateObject', text: 'It pulses with ancient magic.', collect: false }, { id: 'p1' });
    expect(state.pendingInteraction).toBeNull();
    expect(targeted).toHaveLength(1);
    expect(targeted![0]!.playerId).toBe('p2');
    expect(targeted![0]!.message).toMatchObject({ t: 'narration', text: 'It pulses with ancient magic.' });
    expect(events).toHaveLength(0);
    expect(state.sceneObjects['sign1']).toBeDefined();
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
    notes: [],
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
    s.initiative = { order: ['p2', 'p3'], currentIndex: 1, round: 1 };
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

describe('INT skill checks', () => {
  const mage: Character = {
    id: 'p2', ownerId: 'p2', name: 'Merlin', raceId: 'human', classId: 'mage',
    visual: { color: '#a855f7', icon: '🔮' }, level: 1,
    abilities: { str: 8, dex: 10, con: 10, int: 16, mag: 16, cha: 10 },
    hp: 10, maxHp: 10, ac: 10, speed: 30, initiative: 0, inventory: [], notes: [],
  };
  const mageToken: Token = {
    id: 'p2', kind: 'pc', name: 'Merlin', visual: { color: '#a855f7', icon: '🔮' },
    coord: { x: 0, y: 0 }, hp: 10, maxHp: 10, initiative: 0, speed: 30, statuses: [], ownerId: 'p2',
  };
  const base = (interactables: Record<string, Interactable> = {}): GameState => ({
    ...createInitialState('ABCDE'),
    phase: 'playing', gmId: 'p1',
    players: {
      p1: { id: 'p1', name: 'GM', role: 'gm', connected: true },
      p2: { id: 'p2', name: 'Merlin', role: 'player', connected: true },
    },
    characters: { p2: mage },
    map: { worldType: 'test', seed: 1, width: 3, height: 1, tiles: ['floor', 'floor', 'floor'], spawnPoints: [{ x: 0, y: 0 }] },
    tokens: { p2: mageToken },
    initiative: { order: ['p2'], currentIndex: 0, round: 1 },
    interactables,
  });

  it('a locked chest needs an INT check: a low roll fails and still spends the action', () => {
    const chest: Interactable = { id: 'c1', kind: 'chest', coord: { x: 1, y: 0 }, contents: [{ itemId: 'gold', qty: 1 }], looted: false, dc: 15 };
    const { state, events } = applyCommand(base({ c1: chest }), { t: 'interact', targetId: 'c1' }, { id: 'p2', random: 0 });
    expect(state.interactables['c1']!.looted).toBe(false);
    expect(state.characters['p2']!.inventory).toEqual([]);
    expect(state.turn.acted).toBe(true);
    expect(state.lastRoll).toEqual({ sides: 20, value: 1, by: 'Merlin', seq: 1 });
    expect(events).toContainEqual({ t: 'lockAttempt', by: 'Merlin', target: 'chest', success: false, roll: 1, total: 4, dc: 15 });
  });

  it('a high roll picks the lock and loots the chest', () => {
    const chest: Interactable = { id: 'c1', kind: 'chest', coord: { x: 1, y: 0 }, contents: [{ itemId: 'gold', qty: 1 }], looted: false, dc: 15 };
    const { state, events } = applyCommand(base({ c1: chest }), { t: 'interact', targetId: 'c1' }, { id: 'p2', random: 0.99 });
    expect(state.interactables['c1']!.looted).toBe(true);
    expect(state.characters['p2']!.inventory).toEqual([{ itemId: 'gold', qty: 1 }]);
    expect(events.some((e) => e.t === 'chestOpened')).toBe(true);
    expect(events).toContainEqual({ t: 'lockAttempt', by: 'Merlin', target: 'chest', success: true, roll: 20, total: 23, dc: 15 });
  });

  it('an unlocked door (dc 0) opens with no check', () => {
    const door: Interactable = { id: 'd1', kind: 'door', coord: { x: 1, y: 0 }, open: false };
    const { state, events } = applyCommand(base({ d1: door }), { t: 'interact', targetId: 'd1' }, { id: 'p2', random: 0 });
    expect(state.interactables['d1']!.open).toBe(true);
    expect(events).toContainEqual({ t: 'doorToggled', open: true });
    expect(events.some((e) => e.t === 'lockAttempt')).toBe(false);
  });
});
