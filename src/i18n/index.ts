import { ko, type TranslationKey } from "./ko";

/**
 * Translate a key to the user's language. M1 = ko only.
 * `{name}` placeholders are filled from `vars`; unknown ones are left as is.
 * We'll graduate to ICU MessageFormat when EN ships.
 * API failures go through describeApiError in src/lib/api/errorMessage.ts.
 */
export function t(key: TranslationKey, vars?: Record<string, string>): string {
  const template: string = ko[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => vars[name] ?? placeholder);
}

export type { TranslationKey };
