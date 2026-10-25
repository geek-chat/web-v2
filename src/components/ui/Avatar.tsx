/**
 * The first letter of a nickname on a color picked from it, so one person keeps
 * one color everywhere. Profile images come later: an <img> needs next/image
 * settings for the OAuth providers' hosts.
 */
const COLORS = [
  "bg-rose-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-sky-600",
  "bg-violet-600",
  "bg-fuchsia-600",
] as const;

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

function colorFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function Avatar({ nickname, size = "md" }: { nickname: string; size?: keyof typeof SIZES }) {
  const initial = Array.from(nickname.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZES[size]} ${colorFor(nickname)}`}
    >
      {initial}
    </span>
  );
}
