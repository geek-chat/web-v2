"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import { retryChatMessage, sendChatMessage } from "@/lib/chat/connection";
import { useMarkRead } from "@/hooks/useMarkRead";
import { useRoomMessages } from "@/hooks/useRoomMessages";
import { useTyping } from "@/hooks/useTyping";
import { roomTitle } from "@/components/room/RoomListItem";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthStore } from "@/store/auth";
import { useRoomsStore } from "@/store/rooms";
import { ChatHeader } from "./ChatHeader";
import { MessageInput } from "./MessageInput";
import { memberName, MessageList } from "./MessageList";
import { t } from "@/i18n";

/**
 * The chat screen for one room. Render it under `key={roomId}` so its paging,
 * typing and read state start over for each room.
 */
export function ChatRoom({ roomId }: { roomId: string }) {
  const userId = useAuthStore((s) => s.user?.id);
  const rooms = useRoomsStore((s) => s.rooms);
  const reads = useRoomsStore((s) => s.reads[roomId]);
  const room = rooms?.find((r) => r.id === roomId);
  const { messages, loaded, error, retry, loadOlder, loadingOlder, reachedStart } = useRoomMessages(roomId);
  const { typingUserIds, notifyTyping } = useTyping(roomId, userId);
  useMarkRead(roomId, messages, userId);

  // 403 and 404 mean the room is gone or no longer ours; the loaded list may say so first.
  const gone = (rooms && !room) || (error instanceof ApiError && (error.status === 403 || error.status === 404));
  if (gone) {
    return (
      <Notice text={t("chat.notFound")}>
        <Link href="/rooms" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("room.back")}
        </Link>
      </Notice>
    );
  }
  if (error && !loaded) {
    return (
      <Notice text={t("chat.loadError")}>
        <Button variant="secondary" size="sm" onClick={retry}>
          {t("common.retry")}
        </Button>
      </Notice>
    );
  }

  const typingNames = typingUserIds.map((id) => memberName(room, id) ?? t("chat.unknownSender"));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader title={room ? roomTitle(room, userId) : t("common.loading")} room={room} />
      {loaded ? (
        <MessageList
          messages={messages}
          userId={userId}
          room={room}
          reads={reads}
          reachedStart={reachedStart}
          loadingOlder={loadingOlder}
          onLoadOlder={() => void loadOlder()}
          onRetry={retryChatMessage}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size={20} label={t("common.loading")} />
        </div>
      )}
      <p aria-live="polite" className="h-5 px-4 text-xs text-muted-foreground">
        {typingNames.length === 1 && t("chat.typing", { name: typingNames[0] })}
        {typingNames.length > 1 && t("chat.typingMany")}
      </p>
      <MessageInput
        onTyping={notifyTyping}
        onSend={(content, ttlSeconds) => {
          if (userId) sendChatMessage({ roomId, senderId: userId, content, ttlSeconds: ttlSeconds || undefined });
        }}
      />
    </div>
  );
}

function Notice({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}
