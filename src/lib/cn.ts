import { twMerge, type ClassNameValue } from "tailwind-merge";

/**
 * Joins class names, letting a later class win over an earlier one that sets
 * the same property, which is how a caller expects an override to work.
 * Tailwind orders same-property utilities by name, not by where they appear,
 * so plain joining let a variant's bg-muted beat a caller's bg-[#03c75a]
 * (the Naver button rendered gray). Falsy values are skipped.
 *
 * tailwind-merge 3.x supports Tailwind v4.0 to v4.3 (its README); check
 * again before moving Tailwind past that. src/lib/cn.test.ts pins how this
 * theme's tokens merge.
 */
export function cn(...classes: ClassNameValue[]): string {
  return twMerge(...classes);
}
