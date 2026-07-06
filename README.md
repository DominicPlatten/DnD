# D&D Online

A simplified, browser-based Dungeons & Dragons game. Players join a room by
code; the creator becomes the storyteller (Game Master) who picks a world and
runs the game while others build characters and play through a turn tracker.

## Architecture

The server is the **single source of truth**. Clients never mutate game state —
they send typed **Commands**; the server validates them, runs a **pure reducer**,
and broadcasts the resulting **snapshot** to everyone.

```
        Command (Zod-validated)                   Snapshot / Event
Client ─────────────────────────▶  Room (DO)  ──────────────────────▶ All clients
 React                            authoritative     WebSocket
                                       │
                                shared/rules/reducer  ← pure, unit-tested
```

To add a feature: add a `Command` variant, handle it in the reducer, dispatch it
from the UI. Nothing else in the pipeline changes.

### Layout

| Path        | Role                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| `shared/`   | Framework-free domain: state, entities, command/message protocol, reducer. |
| `party/`    | PartyKit server — one Durable Object per room, owns state, broadcasts.      |
| `src/`      | React client — socket hook, Zustand store mirror, screens.                 |

The client imports `shared/` via the `@shared/*` alias (Vite); the server uses
relative imports (its bundler resolves independently).

## Develop

```bash
npm install
npm run dev        # runs the Vite client (5173) and PartyKit server (1999) together
```

Open http://localhost:5173. Create a game in one tab, join with the same code in
another to see live presence.

```bash
npm test           # unit-test the pure game logic
npm run typecheck   # type-check everything
npm run build      # type-check + production client build
```

Set `VITE_PARTYKIT_HOST` (see `.env.example`) to point the client at a different
server host.

## Roadmap

- ✅ **Phase 0** — lobby + full command/event pipeline, join by code, live presence
- ✅ **Character creation** — 6 races, preset visuals, 6 abilities via 27-point point-buy,
  server-validated; GM sees party readiness in the setup phase
- ✅ **World generation** — pluggable `WorldGenerator` (dungeon, forest), seeded so all
  clients render an identical grid; GM picks a world, starts the game, party tokens spawn
- ✅ **Turn tracker & movement** — initiative rolled at start, turn-order strip with
  whose-turn highlight, `endTurn` to advance rounds, click-to-move (players in range on
  their turn; GM moves anyone anywhere)
- ✅ **GM combat controls** — adjust token HP, toggle status conditions, spawn enemies
  from a bestiary onto the grid, remove tokens, and hand items to characters
- ✅ **Dice, interactions & action economy** — GM rolls d6/d12/d20 (shown to all); each
  turn a player gets 1 move + 1 action; the action interacts with adjacent chests (loot),
  doors (open/close), and allies
- ✅ **Battle system** — Pokémon-style 1v1 vs enemies: engage an adjacent enemy to open a
  battle screen (board pauses), pick a move, enemy acts via AI, speed-ordered resolution;
  win/flee/defeat syncs back to the grid. Sides are arrays, ready for party/duo fights
- ✅ **Reconnection & persistence** — state is saved to Durable Object storage (survives the
  room hibernating/restarting); a stable browser id + saved session means a refresh or
  dropped connection rejoins as the same player, keeping character, GM role, and turn
- **Polish (optional)** — in-play activity log, more content, in-battle item/move effects

See the plan for details. Every feature follows the same seam: a `Command`, a reducer
case, and UI.
