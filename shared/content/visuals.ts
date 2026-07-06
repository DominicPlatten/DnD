/**
 * Preset appearance options for a character's token. Keeping visuals to a fixed
 * palette + icon set means no art pipeline and lets the server validate that a
 * submitted appearance is legal (no arbitrary values from clients).
 */
export const TOKEN_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // amber
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#a855f7', // violet
  '#ec4899', // pink
] as const;

export const TOKEN_ICONS = [
  '⚔️', '🏹', '🔮', '🛡️', '🗡️', '🪄', '🔨', '🐉', '🦊', '🐺', '🦅', '🐍',
] as const;

export function isValidColor(color: string): boolean {
  return (TOKEN_COLORS as readonly string[]).includes(color);
}

export function isValidIcon(icon: string): boolean {
  return (TOKEN_ICONS as readonly string[]).includes(icon);
}
