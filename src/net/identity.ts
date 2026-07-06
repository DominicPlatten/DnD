const CLIENT_ID_KEY = 'dnd:clientId';

/**
 * A stable per-TAB id, passed to PartyKit as the connection id so a refresh or a
 * dropped socket re-attaches to the same player (keeping character, GM role, and
 * turn).
 *
 * It lives in sessionStorage, NOT localStorage, on purpose: sessionStorage is
 * scoped to a single tab but survives reloads. localStorage is shared across all
 * tabs of a browser, which would make two tabs collapse into the same player
 * (both "GM", unable to see each other) — useful for testing multiplayer and
 * correct for two people sharing a machine in different tabs.
 */
export function getClientId(): string {
  let id = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}
