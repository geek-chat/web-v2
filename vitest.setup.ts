import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library only auto-cleans when Vitest globals are on; we import
// test APIs explicitly, so unmount and reset shared browser state here.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
