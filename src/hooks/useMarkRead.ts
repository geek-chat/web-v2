import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/store/messages";
import { useWsStore } from "@/store/ws";

export const MARK_READ_DELAY_MS = 500;

/** The newest server row someone else sent: the only thing worth a mark_read. */
export function newestFromOthers(
  messages: readonly ChatMessage[] | undefined,
  userId: string | undefined,
): string | null {
  if (!messages || !userId) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const row = messages[i];
    if (row.serverTime && row.senderId !== userId) return row.id;
  }
  return null;
}

/**
 * Sends mark_read for the newest message from someone else, at most once per
 * message, while this room view is mounted and the page is visible.
 *
 * mark_read is not harmless: MessageService.markAsRead burns other people's
 * burn-after-read messages. So it never fires from a hidden tab or after the
 * view unmounts, and visibility is checked again when the delay ends.
 */
export function useMarkRead(
  roomId: string,
  messages: readonly ChatMessage[] | undefined,
  userId: string | undefined,
) {
  const client = useWsStore((s) => s.client);
  const status = useWsStore((s) => s.status);
  const sent = useRef<string | null>(null);
  const target = newestFromOthers(messages, userId);

  useEffect(() => {
    if (!client || status !== "open" || !target || target === sent.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState !== "visible") return; // retried on visibilitychange
        if (client.send("mark_read", { roomId, lastReadMessageId: target })) sent.current = target;
      }, MARK_READ_DELAY_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [client, status, roomId, target]);
}
