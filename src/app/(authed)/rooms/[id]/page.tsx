"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { useRoomsStore } from "@/store/rooms";

/** The chat screen. It also marks the room as current, which room_expired uses to send the user back. */
export default function RoomPage() {
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    useRoomsStore.getState().setCurrentRoom(id);
    return () => useRoomsStore.getState().setCurrentRoom(null);
  }, [id]);

  return <ChatRoom key={id} roomId={id} />;
}
