/** Status conditions the GM can toggle on any token. A registry, like races. */
export interface StatusDef {
  id: string;
  name: string;
  icon: string;
  blurb: string;
}

export const STATUSES: readonly StatusDef[] = [
  { id: 'poisoned', name: 'Poisoned', icon: '🤢', blurb: 'Disadvantage on attacks and checks.' },
  { id: 'stunned', name: 'Stunned', icon: '💫', blurb: 'Incapacitated; cannot move or act.' },
  { id: 'prone', name: 'Prone', icon: '⬇️', blurb: 'On the ground; melee attackers have advantage.' },
  { id: 'blinded', name: 'Blinded', icon: '🙈', blurb: 'Cannot see; attacks at disadvantage.' },
  { id: 'frightened', name: 'Frightened', icon: '😱', blurb: 'Disadvantage while the source is in sight.' },
  { id: 'restrained', name: 'Restrained', icon: '🕸️', blurb: 'Speed 0; disadvantage on attacks.' },
  { id: 'burning', name: 'Burning', icon: '🔥', blurb: 'Takes fire damage at the start of each turn.' },
  { id: 'blessed', name: 'Blessed', icon: '✨', blurb: 'A bonus to attack rolls and saving throws.' },
  { id: 'unconscious', name: 'Unconscious', icon: '💤', blurb: 'Incapacitated and prone.' },
];

const BY_ID = new Map<string, StatusDef>(STATUSES.map((s) => [s.id, s]));

export function getStatus(id: string): StatusDef | undefined {
  return BY_ID.get(id);
}
