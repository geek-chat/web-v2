"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Room } from "@/lib/api/rooms";
import { Button } from "@/components/ui/Button";
import { compareInstants, type ChatMessage } from "@/store/messages";
import { MessageItem } from "./MessageItem";
import { t } from "@/i18n";

/** Who has read `message` (mine), from the read points read_update brought in. */
export function readLabelFor(
  message: ChatMessage,
  room: Room | undefined,
  reads: Record<string, string> | undefined,
  userId: string | undefined,
): string | null {
  if (!room || !reads || !message.serverTime) return null;
  const readers = room.members.filter((member) => {
    const readAt = reads[member.userId];
    return member.userId !== userId && readAt !== undefined && compareInstants(readAt, message.createdAt) >= 0;
  }).length;
  if (readers === 0) return null;
  return room.type === "DIRECT" ? t("chat.read") : t("chat.readBy", { count: String(readers) });
}

export function memberName(room: Room | undefined, userId: string): string | undefined {
  return room?.members.find((member) => member.userId === userId)?.nickname;
}

/** REST rows carry senderNickname, new_message rows don't: the room's members fill the gap. */
export function senderNameOf(message: ChatMessage, room: Room | undefined): string {
  return memberName(room, message.senderId) ?? message.senderNickname ?? t("chat.unknownSender");
}

interface MessageListProps {
  messages: ChatMessage[];
  userId: string | undefined;
  room: Room | undefined;
  reads: Record<string, string> | undefined;
  reachedStart: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (clientMessageId: string) => void;
}

/**
 * Oldest at the top. Follows new messages while the view is at the bottom,
 * keeps the view in place when an older page lands above it, and loads that
 * page when the top comes into view (or on the button).
 */
export function MessageList(props: MessageListProps) {
  const { messages, userId, room, reads, reachedStart, loadingOlder, onLoadOlder, onRetry } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const anchor = useRef<{ height: number; scrollTop: number } | null>(null);
  const firstKey = useRef<string | null>(null);
  const head = messages[0];
  const headKey = head ? (head.clientMessageId ?? head.id) : null;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (anchor.current && headKey !== firstKey.current) {
      // An older page landed above: keep the rows on screen where they were.
      el.scrollTop = el.scrollHeight - anchor.current.height + anchor.current.scrollTop;
      anchor.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    firstKey.current = headKey;
  }, [messages, headKey]);

  useEffect(() => {
    if (!loadingOlder) anchor.current = null;
  }, [loadingOlder]);

  const loadOlder = useCallback(() => {
    const el = scroller.current;
    if (el) anchor.current = { height: el.scrollHeight, scrollTop: el.scrollTop };
    onLoadOlder();
  }, [onLoadOlder]);

  useEffect(() => {
    const el = top.current;
    if (!el || reachedStart || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadOlder();
      },
      { root: scroller.current, rootMargin: "200px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reachedStart, loadOlder]);

  let lastMine = -1;
  messages.forEach((message, index) => {
    if (message.senderId === userId && message.serverTime) lastMine = index;
  });

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
    >
      <div ref={top} />
      {reachedStart ? (
        <p className="py-2 text-center text-xs text-muted-foreground">{t("chat.start")}</p>
      ) : (
        <div className="flex justify-center py-2">
          <Button variant="ghost" size="sm" loading={loadingOlder} onClick={loadOlder}>
            {t("chat.older")}
          </Button>
        </div>
      )}
      <ol className="flex flex-col gap-3">
        {messages.map((message, index) => {
          const mine = message.senderId === userId;
          const showName =
            !mine && room?.type === "GROUP" && messages[index - 1]?.senderId !== message.senderId;
          return (
            <li key={message.clientMessageId ?? message.id}>
              <MessageItem
                message={message}
                mine={mine}
                senderName={showName ? senderNameOf(message, room) : null}
                readLabel={index === lastMine ? readLabelFor(message, room, reads, userId) : null}
                onRetry={onRetry}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
