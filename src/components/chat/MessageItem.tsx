"use client";

import { Timer } from "lucide-react";
import { ButtonBase } from "@/components/ui/ButtonBase";
import { useNow } from "@/hooks/useNow";
import { formatLeft } from "@/lib/time";
import type { ChatMessage } from "@/store/messages";
import { toEpochMs } from "@/store/messages";
import { t } from "@/i18n";

const timeFormat = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });

export function formatTime(iso: string): string {
  const at = toEpochMs(iso);
  return Number.isNaN(at) ? "" : timeFormat.format(at);
}

export interface MessageItemProps {
  message: ChatMessage;
  mine: boolean;
  /** Shown above someone else's message in a group; null hides it. */
  senderName: string | null;
  /** "읽음" or "2명 읽음" under my message once someone has read it. */
  readLabel: string | null;
  onRetry: (clientMessageId: string) => void;
}

/**
 * Time left on a disappearing message, by this device's clock and for display
 * only: message_expired removes the row, up to a minute after the deadline.
 */
function MessageExpiry({ expiresAt }: { expiresAt: string }) {
  const now = useNow(1000);
  const left = formatLeft(toEpochMs(expiresAt) - now);
  return (
    <span className="flex items-center gap-1">
      <Timer size={12} aria-label={t("chat.message.disappearing")} />
      {left ? t("chat.message.expiresIn", { left }) : t("chat.message.expiringNow")}
    </span>
  );
}

/** One bubble: mine on the right, others on the left, with send state and a retry for failures. */
export function MessageItem({ message, mine, senderName, readLabel, onRetry }: MessageItemProps) {
  if (message.type === "SYSTEM") {
    return <p className="py-1 text-center text-xs text-muted-foreground">{message.content}</p>;
  }
  return (
    <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
      {senderName && <span className="px-1 text-xs text-muted-foreground">{senderName}</span>}
      <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
        <p
          className={`max-w-[75vw] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm md:max-w-md ${
            mine ? "bg-primary text-primary-foreground" : "bg-muted"
          } ${message.status === "pending" ? "opacity-60" : ""}`}
        >
          {message.content}
        </p>
        <span className={`flex shrink-0 flex-col gap-0.5 text-[11px] text-muted-foreground ${mine ? "items-end" : "items-start"}`}>
          {readLabel && <span>{readLabel}</span>}
          {message.expiresAt && <MessageExpiry expiresAt={message.expiresAt} />}
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </span>
      </div>
      {message.status === "pending" && (
        <span className="text-xs text-muted-foreground">{t("chat.message.pending")}</span>
      )}
      {message.status === "failed" && message.clientMessageId && (
        <span className="flex items-center gap-2 text-xs text-destructive">
          {t("chat.message.failedLabel")}
          <ButtonBase
            onClick={() => onRetry(message.clientMessageId!)}
            className="rounded-sm underline underline-offset-2"
          >
            {t("chat.message.retry")}
          </ButtonBase>
        </span>
      )}
    </div>
  );
}
