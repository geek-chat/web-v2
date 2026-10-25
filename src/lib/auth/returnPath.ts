/**
 * Where to go after signing in, for an invite link opened while signed out.
 * AuthGuard remembers the path when it sends the visitor to /login and takes
 * it back the first time it sees them signed in. Login, signup and the OAuth
 * round trip all end on an AuthGuard route in the same tab, and
 * sessionStorage is per tab and per origin.
 */
const KEY = "return_path";
// A dropped invite must not redirect a later sign-in in this tab.
const TTL_MS = 10 * 60 * 1000;
// Invite pages only, with the code limited to letters and digits: no other
// path, no "//" or backslash that could leave this origin.
const RETURNABLE = /^\/invite\/[A-Za-z0-9]{1,64}$/;

export function isReturnablePath(path: string): boolean {
  return RETURNABLE.test(path);
}

/** Keeps `path` for after sign-in, if it is a page worth coming back to. */
export function rememberReturnPath(path: string): void {
  if (!isReturnablePath(path)) return;
  window.sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
}

/** The remembered path while it is fresh. Removes it either way: one sign-in, one return. */
export function takeReturnPath(): string | null {
  const raw = window.sessionStorage.getItem(KEY);
  if (raw === null) return null;
  window.sessionStorage.removeItem(KEY);
  try {
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    const age = Date.now() - Number(at);
    if (typeof path !== "string" || !isReturnablePath(path) || !(age >= 0 && age < TTL_MS)) return null;
    return path;
  } catch {
    return null;
  }
}
