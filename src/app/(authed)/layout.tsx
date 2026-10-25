import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";

/** Every route under (authed) needs a verified session (RULES.md R3). */
export default function AuthedLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
