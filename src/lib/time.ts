import { t } from "@/i18n";

/** The server warns a TTL room this long before it expires (room_expiring). */
export const ROOM_EXPIRING_SOON_MS = 10 * 60 * 1000;

/**
 * Time left until a deadline, as the UI words it: seconds under a minute,
 * then whole minutes, hours and days, rounded down. Null once the deadline
 * has passed. The server deletes on its own schedule (expired messages every
 * minute, rooms every 10 minutes), so a row can outlive its deadline: show
 * "soon" then, and never hide a row by the client clock (RULES.md R6).
 */
export function formatLeft(ms: number): string | null {
  if (!(ms > 0)) return null;
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return t("time.left.seconds", { n: String(seconds) });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("time.left.minutes", { n: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.left.hours", { n: String(hours) });
  return t("time.left.days", { n: String(Math.floor(hours / 24)) });
}

/** "9:05": minutes and seconds left, for a countdown under an hour. */
export function formatClock(ms: number): string {
  const total = ms > 0 ? Math.ceil(ms / 1000) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
