import { z } from 'zod';

/**
 * Commands are the ONLY way a client can change the game. They travel
 * client -> server, are validated with these Zod schemas at the trust
 * boundary, then applied by the pure reducer. Adding a feature starts here:
 * add a variant, then a reducer case, then UI to dispatch it.
 *
 * Convention: GM-only commands are namespaced `gm/...`. The reducer enforces
 * the permission — the namespace is just a readable signal.
 */
const AbilitiesSchema = z.object({
  str: z.number().int(),
  dex: z.number().int(),
  con: z.number().int(),
  int: z.number().int(),
  wis: z.number().int(),
  cha: z.number().int(),
});

const CharacterDraftSchema = z.object({
  name: z.string().trim().min(1).max(24),
  raceId: z.string(),
  visual: z.object({ color: z.string(), icon: z.string() }),
  baseAbilities: AbilitiesSchema,
});

export const CommandSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('join'), name: z.string().trim().min(1).max(24) }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('rename'), name: z.string().trim().min(1).max(24) }),
  z.object({ t: z.literal('createCharacter'), draft: CharacterDraftSchema }),
  z.object({ t: z.literal('gm/selectWorld'), worldType: z.string(), seed: z.number().int() }),
  z.object({ t: z.literal('gm/startGame') }),
  z.object({
    t: z.literal('moveToken'),
    tokenId: z.string(),
    to: z.object({ x: z.number().int(), y: z.number().int() }),
  }),
  z.object({ t: z.literal('endTurn') }),
  z.object({ t: z.literal('interact'), targetId: z.string() }),
  z.object({ t: z.literal('battle/chooseMove'), moveId: z.string() }),
  z.object({ t: z.literal('battle/dismiss') }),
  z.object({ t: z.literal('gm/rollDice'), sides: z.union([z.literal(6), z.literal(12), z.literal(20)]) }),
  z.object({ t: z.literal('gm/setHp'), tokenId: z.string(), hp: z.number() }),
  z.object({ t: z.literal('gm/applyStatus'), tokenId: z.string(), status: z.string() }),
  z.object({ t: z.literal('gm/removeStatus'), tokenId: z.string(), status: z.string() }),
  z.object({
    t: z.literal('gm/spawnEnemy'),
    enemyId: z.string(),
    tokenId: z.string(),
    at: z.object({ x: z.number().int(), y: z.number().int() }),
  }),
  z.object({ t: z.literal('gm/removeToken'), tokenId: z.string() }),
  z.object({ t: z.literal('gm/giveItem'), charId: z.string(), itemId: z.string() }),
  z.object({ t: z.literal('gm/advancePhase') }),
]);

export type Command = z.infer<typeof CommandSchema>;
