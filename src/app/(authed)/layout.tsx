import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ChatConnection } from "@/components/chat/ChatConnection";

/**
 * Every route under (authed) needs a verified session (RULES.md R3). The chat
 * connection lives exactly as long as one of these screens is shown (R2).
 */
export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <ChatConnection />
      {children}
    </AuthGuard>
  );
}
