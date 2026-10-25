import { ko, type TranslationKey } from "./ko";

/**
 * Translate a key to the user's language. M1 = ko only.
 * For interpolation use template literals at the call site (this is fine
 * for a flat map; we'll graduate to ICU MessageFormat when EN ships).
 * API failures go through describeApiError in src/lib/api/errorMessage.ts.
 */
export function t(key: TranslationKey): string {
  return ko[key];
}

export type { TranslationKey };
