import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Setup follows node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md,
// except that Vite 8 resolves tsconfig `paths` natively, so the
// vite-tsconfig-paths plugin the guide suggests is not needed.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    // src/lib/env.ts validates these at import time and throws without them.
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:8080",
      NEXT_PUBLIC_WS_URL: "ws://localhost:8080/ws",
    },
  },
});
