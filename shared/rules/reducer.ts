import type { GameState, Phase } from '../state';
import type { Command } from '../protocol/commands';
import type { GameEvent } from '../protocol/messages';
import type { Battle, Coord, Interactable, ItemStack, Player, PlayerId, Token, TokenId } from '../entities';
import { getRace } from '../content/races';
import { getClass } from '../content/classes';
import { isValidColor, isValidIcon } from '../content/visuals';
import { getStatus } from '../content/statuses';
import { getItem } from '../content/items';
import { getEnemy, scaleEnemy } from '../content/enemies';
import { abilityMod, buildCharacter, isLegalPointBuy } from './character';
import {
  chooseMove as chooseBattleMove,
  foeCombatant,
  isReadyToResolve,
  partyCombatant,
  resolveRound,
  startBattle,
} from './battle';
import { getGenerator } from '../world/registry';
import { placeInteractables } from '../world/populate';
import { DEFAULT_WORLD_SIZE, isPassable, tileAt } from '../world/types';
import {
  advanceTurn,
  appendToInitiative,
  chebyshev,
  checkMove,
  currentTokenId,
  objectBlocks,
  removeFromInitiative,
  rollInitiative,
} from './turns';

const NO_TURN: { moved: boolean; acted: boolean } = { moved: false, acted: false };

/**
 * The pure heart of the game. `applyCommand` is a total function of
 * (state, command, sender) with no I/O, no framework, no clock — so the entire
 * rulebook is unit-testable without a browser or a server. The server calls it
 * and broadcasts the result; it never mutates `state` in place.
 */

export interface Sender {
  id: PlayerId;
  /** Server-injected entropy [0,1) for commands that need randomness (dice). */
  random?: number;
}

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
  /** Set when the command was rejected; the server relays it only to the sender. */
  error?: string;
}

const PHASE_ORDER: readonly Phase[] = ['lobby', 'setup', 'playing', 'ended'];

function reject(state: GameState, error: string): ReduceResult {
  return { state, events: [], error };
}

export function applyCommand(state: GameState, command: Command, sender: Sender): ReduceResult {
  switch (command.t) {
    case 'join': {
      // Reconnect: a returning id keeps its role, character, and turn — we just
      // mark it online again (and let it refresh its name).
      const existing = state.players[sender.id];
      if (existing) {
        return {
          state: {
            ...state,
            players: { ...state.players, [sender.id]: { ...existing, name: command.name, connected: true } },
          },
          events: existing.connected ? [] : [{ t: 'playerJoined', name: command.name }],
        };
      }
      const isFirst = Object.keys(state.players).length === 0;
      const player: Player = {
        id: sender.id,
        name: command.name,
        role: isFirst ? 'gm' : 'player',
        connected: true,
      };
      return {
        state: {
          ...state,
          gmId: isFirst ? sender.id : state.gmId,
          players: { ...state.players, [sender.id]: player },
        },
        events: [{ t: 'playerJoined', name: command.name }],
      };
    }

    case 'leave': {
      // Intentional exit (the Leave button): actually remove the player.
      return removePlayer(state, sender.id);
    }

    case 'rename': {
      const player = state.players[sender.id];
      if (!player) return reject(state, 'You have not joined this game.');
      return {
        state: {
          ...state,
          players: { ...state.players, [sender.id]: { ...player, name: command.name } },
        },
        events: [],
      };
    }

    case 'createCharacter': {
      if (state.phase === 'playing' || state.phase === 'ended') {
        return reject(state, 'Characters are locked once the adventure begins.');
      }
      const player = state.players[sender.id];
      if (!player) return reject(state, 'You have not joined this game.');
      if (player.role === 'gm') return reject(state, 'The storyteller does not play a character.');

      const { name, raceId, classId, visual, baseAbilities } = command.draft;
      const race = getRace(raceId);
      if (!race) return reject(state, 'Unknown race.');
      const classDef = getClass(classId);
      if (!classDef) return reject(state, 'Unknown class.');
      if (!isLegalPointBuy(baseAbilities)) return reject(state, 'Those ability scores are not a legal build.');
      if (!isValidColor(visual.color) || !isValidIcon(visual.icon)) {
        return reject(state, 'Invalid character appearance.');
      }

      const character = buildCharacter(sender.id, { name, raceId, classId, visual, baseAbilities }, race, classDef);
      const firstTime = state.characters[sender.id] === undefined;
      return {
        state: { ...state, characters: { ...state.characters, [sender.id]: character } },
        events: firstTime ? [{ t: 'characterReady', name: character.name }] : [],
      };
    }

    case 'gm/selectWorld': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can choose the world.');
      if (state.phase !== 'setup') return reject(state, 'The world is chosen during setup.');
      const generator = getGenerator(command.worldType);
      if (!generator) return reject(state, 'Unknown world type.');
      const map = generator.generate({ seed: command.seed, ...DEFAULT_WORLD_SIZE });
      return {
        state: { ...state, map },
        events: [{ t: 'worldChosen', worldName: generator.name }],
      };
    }

    case 'gm/startGame': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can start the adventure.');
      if (state.phase !== 'setup') return reject(state, 'The adventure starts from setup.');
      if (!state.map) return reject(state, 'Choose a world before starting.');
      const tokens = spawnPartyTokens(state.characters, state.map.spawnPoints);
      const initiative = rollInitiative(tokens, (state.map.seed ^ 0x9e3779b9) >>> 0);
      const occupied = [...state.map.spawnPoints, ...Object.values(tokens).map((t) => t.coord)];
      const interactables = placeInteractables(state.map, occupied, (state.map.seed ^ 0x1234abcd) >>> 0);
      return {
        state: { ...state, phase: 'playing', tokens, initiative, interactables, turn: NO_TURN },
        events: [{ t: 'phaseChanged', phase: 'playing' }],
      };
    }

    case 'moveToken': {
      if (state.battle) return reject(state, 'Resolve the battle first.');
      if (state.phase !== 'playing' || !state.map || !state.initiative) {
        return reject(state, 'You can only move during play.');
      }
      const token = state.tokens[command.tokenId];
      if (!token) return reject(state, 'No such token.');
      const isGm = sender.id === state.gmId;
      if (!isGm) {
        if (token.ownerId !== sender.id) return reject(state, 'That is not your character.');
        if (currentTokenId(state.initiative) !== token.id) return reject(state, 'It is not your turn.');
        if (state.turn.moved) return reject(state, 'You have already moved this turn.');
      }
      const error = checkMove(state.map, state.tokens, state.interactables, command.tokenId, command.to, {
        enforceRange: !isGm,
      });
      if (error) return reject(state, error);
      return {
        state: {
          ...state,
          tokens: { ...state.tokens, [token.id]: { ...token, coord: command.to } },
          turn: isGm ? state.turn : { ...state.turn, moved: true },
        },
        events: [],
      };
    }

    case 'endTurn': {
      if (state.battle) return reject(state, 'Resolve the battle first.');
      if (state.phase !== 'playing' || !state.initiative) return reject(state, 'The adventure is not underway.');
      const currentId = currentTokenId(state.initiative);
      const current = currentId ? state.tokens[currentId] : undefined;
      const isGm = sender.id === state.gmId;
      if (!isGm && current?.ownerId !== sender.id) return reject(state, 'You can only end your own turn.');
      return {
        state: { ...state, initiative: advanceTurn(state.initiative, state.tokens), turn: NO_TURN },
        events: [],
      };
    }

    case 'interact': {
      if (state.battle) return reject(state, 'Resolve the battle first.');
      if (state.phase !== 'playing' || !state.initiative) return reject(state, 'You can only interact during play.');
      if (sender.id === state.gmId) return reject(state, 'The storyteller acts through their toolkit.');
      const actor = Object.values(state.tokens).find((t) => t.ownerId === sender.id);
      if (!actor) return reject(state, 'You have no character on the board.');
      if (currentTokenId(state.initiative) !== actor.id) return reject(state, 'It is not your turn.');
      if (state.turn.acted) return reject(state, 'You have already acted this turn.');
      return resolveInteraction(state, actor, command.targetId, sender.random ?? 0);
    }

    case 'battle/chooseMove': {
      if (!state.battle) return reject(state, 'There is no battle right now.');
      if (state.battle.phase !== 'choosing') return reject(state, 'The battle is over.');
      const mine = Object.values(state.battle.combatants).find((c) => c.controllerId === sender.id);
      if (!mine) return reject(state, 'You are not fighting in this battle.');
      const chosen = chooseBattleMove(state.battle, mine.id, command.moveId);
      if (chosen.error) return reject(state, chosen.error);

      let battle = chosen.battle;
      const events: GameEvent[] = [];
      if (isReadyToResolve(battle)) {
        battle = resolveRound(battle);
        if (battle.phase === 'over') events.push({ t: 'battleEnded', outcome: battleOutcomeText(battle) });
      }
      return { state: { ...state, battle }, events };
    }

    case 'battle/dismiss': {
      if (!state.battle) return reject(state, 'There is no battle right now.');
      if (state.battle.phase !== 'over') return reject(state, 'The battle is still raging.');
      const participant = Object.values(state.battle.combatants).some((c) => c.controllerId === sender.id);
      if (sender.id !== state.gmId && !participant) return reject(state, 'Only a fighter can close the battle.');
      return { state: applyBattleResults(state, state.battle), events: [] };
    }

    case 'gm/rollDice': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can roll the dice.');
      const value = Math.min(command.sides, 1 + Math.floor((sender.random ?? 0) * command.sides));
      const by = state.players[sender.id]?.name ?? 'The storyteller';
      const seq = (state.lastRoll?.seq ?? 0) + 1;
      return {
        state: { ...state, lastRoll: { sides: command.sides, value, by, seq } },
        events: [{ t: 'diceRolled', sides: command.sides, value, by }],
      };
    }

    case 'gm/setHp': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can change health.');
      const token = state.tokens[command.tokenId];
      if (!token) return reject(state, 'No such token.');
      const hp = Math.max(0, Math.min(token.maxHp, Math.round(command.hp)));
      return {
        state: { ...state, tokens: { ...state.tokens, [token.id]: { ...token, hp } } },
        events: [],
      };
    }

    case 'gm/applyStatus': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can apply conditions.');
      const token = state.tokens[command.tokenId];
      if (!token) return reject(state, 'No such token.');
      if (!getStatus(command.status)) return reject(state, 'Unknown condition.');
      if (token.statuses.includes(command.status)) return { state, events: [] };
      return {
        state: {
          ...state,
          tokens: { ...state.tokens, [token.id]: { ...token, statuses: [...token.statuses, command.status] } },
        },
        events: [],
      };
    }

    case 'gm/removeStatus': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can clear conditions.');
      const token = state.tokens[command.tokenId];
      if (!token) return reject(state, 'No such token.');
      return {
        state: {
          ...state,
          tokens: {
            ...state.tokens,
            [token.id]: { ...token, statuses: token.statuses.filter((s) => s !== command.status) },
          },
        },
        events: [],
      };
    }

    case 'gm/spawnEnemy': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can spawn enemies.');
      if (state.phase !== 'playing' || !state.map) return reject(state, 'Enemies appear during play.');
      const def = getEnemy(command.enemyId);
      if (!def) return reject(state, 'Unknown creature.');
      if (state.tokens[command.tokenId]) return reject(state, 'That token already exists.');
      const placement = placementError(state.map, state.tokens, state.interactables, command.at);
      if (placement) return reject(state, placement);
      const scaled = scaleEnemy(def, command.tier ?? 'normal');
      const token: Token = {
        id: command.tokenId,
        kind: 'enemy',
        name: scaled.name,
        visual: { color: def.color, icon: def.icon },
        coord: command.at,
        hp: scaled.maxHp,
        maxHp: scaled.maxHp,
        initiative: def.initiative,
        speed: def.speed,
        statuses: [],
        enemyId: def.id,
        attack: scaled.attack,
        armor: scaled.armor,
        magicResist: scaled.magicResist,
        tier: scaled.tier,
      };
      return {
        state: {
          ...state,
          tokens: { ...state.tokens, [token.id]: token },
          initiative: state.initiative ? appendToInitiative(state.initiative, token.id) : state.initiative,
        },
        events: [{ t: 'enemySpawned', name: scaled.name }],
      };
    }

    case 'gm/removeToken': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can remove tokens.');
      if (!state.tokens[command.tokenId]) return reject(state, 'No such token.');
      const tokens = { ...state.tokens };
      delete tokens[command.tokenId];
      return {
        state: {
          ...state,
          tokens,
          initiative: state.initiative ? removeFromInitiative(state.initiative, command.tokenId) : null,
        },
        events: [],
      };
    }

    case 'gm/giveItem': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can give items.');
      const character = state.characters[command.charId];
      if (!character) return reject(state, 'No such character.');
      const item = getItem(command.itemId);
      if (!item) return reject(state, 'Unknown item.');
      const inventory = [...character.inventory];
      const existing = inventory.findIndex((s) => s.itemId === command.itemId);
      if (existing >= 0) inventory[existing] = { itemId: command.itemId, qty: inventory[existing]!.qty + 1 };
      else inventory.push({ itemId: command.itemId, qty: 1 });
      return {
        state: {
          ...state,
          characters: { ...state.characters, [character.id]: { ...character, inventory } },
        },
        events: [{ t: 'itemGiven', item: item.name, to: character.name }],
      };
    }

    case 'gm/advancePhase': {
      if (sender.id !== state.gmId) return reject(state, 'Only the GM can advance the game.');
      const idx = PHASE_ORDER.indexOf(state.phase);
      const nextPhase = PHASE_ORDER[Math.min(idx + 1, PHASE_ORDER.length - 1)] ?? state.phase;
      if (nextPhase === state.phase) return reject(state, 'The game is already over.');
      return {
        state: { ...state, phase: nextPhase },
        events: [{ t: 'phaseChanged', phase: nextPhase }],
      };
    }
  }
}

/** Whether a token may be placed on a tile (in bounds, passable, unoccupied). */
function placementError(
  map: GameState['map'],
  tokens: Record<TokenId, Token>,
  interactables: Record<string, Interactable>,
  at: Coord,
): string | null {
  if (!map) return 'There is no map.';
  if (at.x < 0 || at.y < 0 || at.x >= map.width || at.y >= map.height) return 'That is off the map.';
  if (!isPassable(tileAt(map, at.x, at.y))) return 'That tile is blocked.';
  if (objectBlocks(interactables, at.x, at.y)) return 'Something is in the way.';
  if (Object.values(tokens).some((t) => t.coord.x === at.x && t.coord.y === at.y)) {
    return 'A creature is already there.';
  }
  return null;
}

/** Add one character's inventory to another set of item stacks, merging counts. */
function mergeInventory(inventory: ItemStack[], additions: ItemStack[]): ItemStack[] {
  const merged = inventory.map((s) => ({ ...s }));
  for (const add of additions) {
    const existing = merged.find((s) => s.itemId === add.itemId);
    if (existing) existing.qty += add.qty;
    else merged.push({ ...add });
  }
  return merged;
}

/**
 * Resolve a player's `interact` action against an adjacent target. The target's
 * kind decides the effect — a switchboard that new interactable/target kinds
 * (levers, NPCs, trading, ...) slot into. Enemies will route to battle next.
 */
interface Check {
  roll: number;
  total: number;
  success: boolean;
}

/** A d20 skill check: 1d20 (from server entropy) + a modifier vs a DC. */
function d20Check(mod: number, dc: number, entropy: number): Check {
  const roll = 1 + Math.floor(entropy * 20);
  const total = roll + mod;
  return { roll, total, success: total >= dc };
}

/** A shared dice-display roll so everyone sees the d20 a check produced. */
function checkRoll(state: GameState, by: string, roll: number): GameState['lastRoll'] {
  return { sides: 20, value: roll, by, seq: (state.lastRoll?.seq ?? 0) + 1 };
}

function lockEvent(by: string, target: 'chest' | 'door', check: Check, dc: number): GameEvent {
  return { t: 'lockAttempt', by, target, success: check.success, roll: check.roll, total: check.total, dc };
}

function resolveInteraction(state: GameState, actor: Token, targetId: string, entropy: number): ReduceResult {
  const spent = { ...state.turn, acted: true };
  const interactable = state.interactables[targetId];
  const targetToken = state.tokens[targetId];

  const targetCoord = interactable?.coord ?? targetToken?.coord;
  if (!targetCoord) return reject(state, 'There is nothing there to interact with.');
  if (chebyshev(actor.coord, targetCoord) > 1) return reject(state, 'You are too far away.');

  if (interactable) {
    const character = state.characters[actor.id];
    const intMod = character ? abilityMod(character.abilities.int) : 0;

    if (interactable.kind === 'chest') {
      if (interactable.looted) return reject(state, 'The chest is already empty.');
      if (!character) return reject(state, 'Only characters can carry loot.');

      // A locked chest needs an INT check to force open; failure still spends the action.
      const dc = interactable.dc ?? 0;
      const check = dc > 0 ? d20Check(intMod, dc, entropy) : null;
      const lastRoll = check ? checkRoll(state, actor.name, check.roll) : state.lastRoll;
      const lockEvents: GameEvent[] = check ? [lockEvent(actor.name, 'chest', check, dc)] : [];
      if (check && !check.success) {
        return { state: { ...state, turn: spent, lastRoll }, events: lockEvents };
      }

      const contents = interactable.contents ?? [];
      const items = contents.map((s) => getItem(s.itemId)?.name ?? s.itemId);
      return {
        state: {
          ...state,
          turn: spent,
          lastRoll,
          characters: {
            ...state.characters,
            [character.id]: { ...character, inventory: mergeInventory(character.inventory, contents) },
          },
          interactables: { ...state.interactables, [interactable.id]: { ...interactable, looted: true, contents: [] } },
        },
        events: [...lockEvents, { t: 'chestOpened', by: actor.name, items }],
      };
    }

    // door: closing an open door is free; forcing a locked one open needs an INT check.
    if (interactable.open) {
      return {
        state: { ...state, turn: spent, interactables: { ...state.interactables, [interactable.id]: { ...interactable, open: false } } },
        events: [{ t: 'doorToggled', open: false }],
      };
    }
    const dc = interactable.dc ?? 0;
    const check = dc > 0 ? d20Check(intMod, dc, entropy) : null;
    const lastRoll = check ? checkRoll(state, actor.name, check.roll) : state.lastRoll;
    const lockEvents: GameEvent[] = check ? [lockEvent(actor.name, 'door', check, dc)] : [];
    if (check && !check.success) {
      return { state: { ...state, turn: spent, lastRoll }, events: lockEvents };
    }
    return {
      state: { ...state, turn: spent, lastRoll, interactables: { ...state.interactables, [interactable.id]: { ...interactable, open: true } } },
      events: [...lockEvents, { t: 'doorToggled', open: true }],
    };
  }

  if (targetToken) {
    if (targetToken.id === actor.id) return reject(state, 'You cannot interact with yourself.');
    if (targetToken.kind === 'enemy') {
      const character = state.characters[actor.id];
      if (!character) return reject(state, 'Only characters can fight.');
      const classDef = getClass(character.classId);
      if (!classDef) return reject(state, 'Your class is unknown.');
      const def = targetToken.enemyId ? getEnemy(targetToken.enemyId) : undefined;
      // Offense scales off the class's primary ability; DEX shrugs off blows, MAG wards spells.
      const party = partyCombatant(
        actor,
        abilityMod(character.abilities[classDef.primary]),
        abilityMod(character.abilities.dex),
        abilityMod(character.abilities.mag),
        classDef.moves,
      );
      const foe = foeCombatant(
        targetToken,
        targetToken.attack ?? def?.attack ?? 1,
        targetToken.armor ?? def?.armor ?? 0,
        targetToken.magicResist ?? def?.magicResist ?? 0,
      );
      const seed = (Math.floor(entropy * 0x7fffffff) ^ 0x51ed270b) >>> 0;
      return {
        state: { ...state, turn: spent, battle: startBattle([party, foe], seed) },
        events: [{ t: 'battleStarted', foe: targetToken.name }],
      };
    }
    return { state: { ...state, turn: spent }, events: [{ t: 'greeted', from: actor.name, to: targetToken.name }] };
  }

  return reject(state, 'There is nothing there to interact with.');
}

function battleOutcomeText(battle: Battle): string {
  if (battle.fled) return 'The party fled the battle.';
  if (battle.winner === 'party') return 'The party won the battle!';
  if (battle.winner === 'foe') return 'The party was defeated.';
  return 'The battle ended.';
}

/** On dismiss: sync combatant HP back to grid tokens; remove defeated foes. */
function applyBattleResults(state: GameState, battle: Battle): GameState {
  const tokens = { ...state.tokens };
  let initiative = state.initiative;
  for (const c of Object.values(battle.combatants)) {
    const token = tokens[c.tokenId];
    if (!token) continue;
    if (c.side === 'foe' && c.hp <= 0) {
      delete tokens[c.tokenId];
      if (initiative) initiative = removeFromInitiative(initiative, c.tokenId);
    } else {
      tokens[c.tokenId] = { ...token, hp: c.hp };
    }
  }
  return { ...state, tokens, initiative, battle: null };
}

/** Create one PC token per character, spread across the map's spawn points. */
function spawnPartyTokens(
  characters: GameState['characters'],
  spawns: Coord[],
): Record<TokenId, Token> {
  const tokens: Record<TokenId, Token> = {};
  const slots = Math.max(spawns.length, 1);
  Object.values(characters).forEach((character, i) => {
    const coord = spawns[i % slots] ?? { x: 0, y: 0 };
    tokens[character.id] = {
      id: character.id,
      kind: 'pc',
      name: character.name,
      visual: character.visual,
      coord,
      hp: character.hp,
      maxHp: character.maxHp,
      initiative: character.initiative,
      speed: character.speed,
      statuses: [],
      ownerId: character.ownerId,
    };
  });
  return tokens;
}

/**
 * Not a command — the server calls this when a connection drops. We KEEP the
 * player (and their character/token/role) and just mark them offline, so a
 * refresh or brief network blip lets them reconnect as themselves. Explicit
 * departures go through the `leave` command / `removePlayer`.
 */
export function markOffline(state: GameState, id: PlayerId): ReduceResult {
  const player = state.players[id];
  if (!player || !player.connected) return { state, events: [] };
  return {
    state: { ...state, players: { ...state.players, [id]: { ...player, connected: false } } },
    events: [],
  };
}

/**
 * Fully remove a player (they pressed Leave). Drops their character/token,
 * prunes the turn order, abandons a battle they were in, and hands the GM role
 * to a remaining (preferably connected) player so the game can continue.
 */
export function removePlayer(state: GameState, id: PlayerId): ReduceResult {
  const leaving = state.players[id];
  if (!leaving) return { state, events: [] };

  const players: Record<PlayerId, Player> = { ...state.players };
  delete players[id];

  const characters = { ...state.characters };
  delete characters[id];

  const tokens = { ...state.tokens };
  delete tokens[id];

  const initiative = state.initiative ? removeFromInitiative(state.initiative, id) : null;

  const battle =
    state.battle && Object.values(state.battle.combatants).some((c) => c.tokenId === id || c.controllerId === id)
      ? null
      : state.battle;

  let gmId = state.gmId;
  if (gmId === id) {
    const heir = Object.values(players).find((p) => p.connected) ?? Object.values(players)[0];
    if (heir) {
      gmId = heir.id;
      players[heir.id] = { ...heir, role: 'gm' };
    } else {
      gmId = null;
    }
  }

  return {
    state: { ...state, players, characters, tokens, initiative, battle, gmId },
    events: [{ t: 'playerLeft', name: leaving.name }],
  };
}
