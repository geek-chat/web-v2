import { ko, type TranslationKey } from "./ko";

/**
 * Translate a key to the user's language. M1 = ko only.
 * For interpolation use template literals at the call site (this is fine
 * for a flat map; we'll graduate to ICU MessageFormat when EN ships).
 */
export function t(key: TranslationKey): string {
  return ko[key];
}

/** Map a backend error code (e.g. 'UsernameAlreadyTaken') to a Korean string. */
export function tError(code: string | undefined): string {
  if (!code) return ko["auth.error.unknown"];
  const key = `auth.error.${code}` as TranslationKey;
  if (key in ko) return ko[key];
  return ko["auth.error.unknown"];
}

export type { TranslationKey };
