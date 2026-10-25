import { useCallback, useSyncExternalStore } from "react";

/**
 * The current time, moving in steps of `stepMs`: the component re-renders
 * once a step, from its own timer. Put it in the small piece that shows a
 * countdown, so only that piece re-renders.
 */
export function useNow(stepMs: number): number {
  const subscribe = useCallback(
    (onStep: () => void) => {
      const timer = setInterval(onStep, stepMs);
      return () => clearInterval(timer);
    },
    [stepMs],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / stepMs) * stepMs,
    () => 0, // countdowns sit behind AuthGuard and never render on the server
  );
}
