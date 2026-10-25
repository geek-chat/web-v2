import { useCallback, useEffect, useRef, useState } from "react";
import { useWsStore } from "@/store/ws";

/** typing_start goes out at most this often while the user types. */
export const TYPING_SEND_INTERVAL_MS = 2000;
/** Someone shows as typing this long after their last typing_indicator. */
export const TYPING_SHOW_MS = 3000;

/**
 * Typing in one room, both ways: notifyTyping() throttles typing_start, and
 * typingUserIds lists the other members typing now. Neither is stored on the
 * server (WEBSOCKET.md §3.2). A member stops showing once their message lands.
 */
export function useTyping(roomId: string, userId: string | undefined) {
  const client = useWsStore((s) => s.client);
  const [typing, setTyping] = useState<Record<string, true>>({});
  const lastSent = useRef(0);

  useEffect(() => {
    if (!client) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const stop = (who: string) => {
      clearTimeout(timers.get(who));
      timers.delete(who);
      setTyping((current) => {
        if (!current[who]) return current;
        const next = { ...current };
        delete next[who];
        return next;
      });
    };
    const offTyping = client.on("typing_indicator", ({ roomId: room, userId: who }) => {
      if (room !== roomId || who === userId) return;
      setTyping((current) => (current[who] ? current : { ...current, [who]: true }));
      clearTimeout(timers.get(who));
      timers.set(who, setTimeout(() => stop(who), TYPING_SHOW_MS));
    });
    const offMessage = client.on("new_message", ({ roomId: room, senderId }) => {
      if (room === roomId) stop(senderId);
    });
    return () => {
      offTyping();
      offMessage();
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [client, roomId, userId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < TYPING_SEND_INTERVAL_MS) return;
    if (client?.send("typing_start", { roomId })) lastSent.current = now;
  }, [client, roomId]);

  return { typingUserIds: Object.keys(typing), notifyTyping };
}
