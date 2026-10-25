import type { ReactNode } from "react";

/** Centered single-column layout shared by the auth callback pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col gap-6">{children}</div>
    </main>
  );
}
