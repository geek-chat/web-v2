import { useEffect, useState } from "react";
import useSWR from "swr";
import { searchUsers } from "@/lib/api/users";
import { useAuthStore } from "@/store/auth";

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Users matching `query` once typing settles. The SWR key carries the user id:
 * the server leaves the caller out of the results, so they differ by account.
 */
export function useUserSearch(query: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const trimmed = query.trim();
  const settled = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const { data, error, isLoading } = useSWR(
    userId && settled ? (["/api/users/search", userId, settled] as const) : null,
    ([, , q]) => searchUsers(q),
    { keepPreviousData: true },
  );
  return {
    results: settled ? (data ?? []) : [],
    error,
    searching: trimmed !== settled || isLoading,
  };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
