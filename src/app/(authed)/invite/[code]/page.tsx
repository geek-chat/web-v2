"use client";

import { useParams } from "next/navigation";
import { JoinInvite } from "@/components/room/JoinInvite";

/** Where a shared invite link lands (server-v2 docs/API.md §4.2). */
export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  return <JoinInvite key={code} code={code} />;
}
