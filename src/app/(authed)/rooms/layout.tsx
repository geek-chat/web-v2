import type { ReactNode } from "react";
import { RoomsPanel } from "@/components/room/RoomList";

/**
 * Desktop: the room list beside the open view. Mobile: one screen at a time,
 * and the list is the /rooms page itself (see page.tsx).
 */
export default function RoomsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-80 shrink-0 border-r border-border md:block">
        <RoomsPanel />
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">{children}</section>
    </div>
  );
}
