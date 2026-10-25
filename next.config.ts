import type { NextConfig } from "next";

// The Content-Security-Policy is not set here: it carries a per-request nonce,
// so src/proxy.ts builds it (src/lib/csp.ts, RULES.md R5). A static header
// from this file would block Next's inline bootstrap scripts.

const nextConfig: NextConfig = {
  // Quiet Turbopack workspace-root inference — pin to this dir to avoid
  // "multiple lockfiles detected" warning vs the parent geek-chat repo.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
