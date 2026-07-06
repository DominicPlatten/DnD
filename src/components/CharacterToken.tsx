import type { CharacterVisual } from '@shared/entities';

/** The visual representation of a character/enemy: a colored disc with an emoji. */
export function CharacterToken({
  visual,
  size = 40,
}: {
  visual: CharacterVisual;
  size?: number;
}) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full border border-black/30 shadow"
      style={{ backgroundColor: visual.color, width: size, height: size, fontSize: size * 0.5 }}
    >
      <span>{visual.icon}</span>
    </div>
  );
}
