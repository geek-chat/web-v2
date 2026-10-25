"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { t } from "@/i18n";

/** Disappearing-message lifetimes the UI offers (WEBSOCKET.md §3.1); the server does not check the value. */
export const MESSAGE_TTL_SECONDS = [0, 30, 300, 3600, 86400] as const;
type Ttl = (typeof MESSAGE_TTL_SECONDS)[number];

interface MessageInputProps {
  onSend: (content: string, ttlSeconds: number) => void;
  onTyping: () => void;
}

/**
 * Enter sends and Shift+Enter breaks the line. An Enter that finishes a Korean
 * IME syllable is not a send: browsers flag it with isComposing, and Safari
 * sends one more Enter right after compositionend with keyCode 229.
 */
export function MessageInput({ onSend, onTyping }: MessageInputProps) {
  const [text, setText] = useState("");
  const [ttl, setTtl] = useState<Ttl>(0);

  function send() {
    const content = text.trim();
    if (!content) return; // the server rejects empty messages
    onSend(content, ttl);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    send();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border p-3">
      <select
        aria-label={t("chat.input.ttl")}
        value={ttl}
        onChange={(e) => setTtl(Number(e.target.value) as Ttl)}
        className="h-10 shrink-0 rounded-md border border-border bg-background px-2 text-sm"
      >
        {MESSAGE_TTL_SECONDS.map((seconds) => (
          <option key={seconds} value={seconds}>
            {t(`chat.ttl.${seconds}`)}
          </option>
        ))}
      </select>
      <textarea
        aria-label={t("chat.input.label")}
        placeholder={t("chat.input.placeholder")}
        rows={1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) onTyping();
        }}
        onKeyDown={onKeyDown}
        className="max-h-32 min-h-10 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={!text.trim()}>
        {t("chat.input.send")}
      </Button>
    </form>
  );
}
