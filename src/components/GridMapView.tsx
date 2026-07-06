import type { Coord, GridMap, Interactable, TerrainKind, Token, TokenId } from '@shared/entities';
import { getStatus } from '@shared/content/statuses';
import { CharacterToken } from './CharacterToken';

function interactableIcon(o: Interactable): string {
  if (o.kind === 'chest') return o.looted ? '📭' : '🧰';
  return o.open ? '🔓' : '🚪';
}

const TERRAIN_COLORS: Record<TerrainKind, string> = {
  wall: '#1f2530',
  floor: '#4b433a',
  grass: '#356a3f',
  tree: '#183b23',
  water: '#1e4f74',
};

const key = (x: number, y: number) => `${x},${y}`;

/**
 * Renders a grid map as a terrain layer with tokens positioned on top. Optional
 * click handlers + highlight sets turn it into an interactive board; without
 * them it's a static preview (as used on the setup screen).
 */
export function GridMapView({
  map,
  tokens,
  interactables = [],
  cell = 32,
  currentTokenId,
  selectedTokenId,
  reachable,
  onTileClick,
  onTokenClick,
  onObjectClick,
}: {
  map: GridMap;
  tokens: Token[];
  interactables?: Interactable[];
  cell?: number;
  currentTokenId?: TokenId;
  selectedTokenId?: TokenId;
  reachable?: Set<string>;
  onTileClick?: (coord: Coord) => void;
  onTokenClick?: (tokenId: TokenId) => void;
  onObjectClick?: (id: string) => void;
}) {
  return (
    <div className="max-w-full overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
      <div className="relative" style={{ width: map.width * cell, height: map.height * cell }}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${map.width}, ${cell}px)` }}>
          {map.tiles.map((terrain, i) => {
            const x = i % map.width;
            const y = Math.floor(i / map.width);
            const isReachable = reachable?.has(key(x, y)) ?? false;
            const style = { width: cell, height: cell, backgroundColor: TERRAIN_COLORS[terrain] };
            const ring = isReachable ? 'outline outline-2 -outline-offset-2 outline-emerald-400/70' : 'outline outline-1 -outline-offset-1 outline-black/10';
            return onTileClick ? (
              <button
                key={i}
                type="button"
                onClick={() => onTileClick({ x, y })}
                style={style}
                className={`${ring} ${isReachable ? 'cursor-pointer hover:brightness-125' : ''}`}
                aria-label={`tile ${x},${y}`}
              />
            ) : (
              <div key={i} style={style} className={ring} />
            );
          })}
        </div>

        {interactables.map((object) => {
          const content = <span style={{ fontSize: cell * 0.6 }}>{interactableIcon(object)}</span>;
          return (
            <div
              key={object.id}
              className="absolute grid place-items-center"
              style={{ left: object.coord.x * cell, top: object.coord.y * cell, width: cell, height: cell }}
              title={object.kind}
            >
              {onObjectClick ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onObjectClick(object.id);
                  }}
                  className="grid h-full w-full place-items-center hover:brightness-125"
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </div>
          );
        })}

        {tokens.map((token) => {
          const isCurrent = token.id === currentTokenId;
          const isSelected = token.id === selectedTokenId;
          const ring = isSelected
            ? 'ring-2 ring-white'
            : isCurrent
              ? 'ring-2 ring-amber-400'
              : '';
          const down = token.hp <= 0;
          const hpPct = Math.max(0, Math.round((token.hp / token.maxHp) * 100));
          const inner = <CharacterToken visual={token.visual} size={cell - 6} />;
          return (
            <div
              key={token.id}
              className={`absolute grid place-items-center transition-all ${down ? 'opacity-40 grayscale' : ''}`}
              style={{ left: token.coord.x * cell, top: token.coord.y * cell, width: cell, height: cell }}
              title={`${token.name} · ${token.hp}/${token.maxHp} HP`}
            >
              {onTokenClick ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTokenClick(token.id);
                  }}
                  className={`rounded-full ${ring}`}
                >
                  {inner}
                </button>
              ) : (
                <div className={`rounded-full ${ring}`}>{inner}</div>
              )}

              {token.statuses.length > 0 && (
                <div className="pointer-events-none absolute -top-1 right-0 flex text-[9px] leading-none">
                  {token.statuses.slice(0, 3).map((s) => (
                    <span key={s}>{getStatus(s)?.icon ?? '•'}</span>
                  ))}
                </div>
              )}

              {token.hp < token.maxHp && (
                <div className="pointer-events-none absolute bottom-0 left-1 right-1 h-1 overflow-hidden rounded-full bg-black/50">
                  <div
                    className={`h-full ${hpPct > 50 ? 'bg-emerald-500' : hpPct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
