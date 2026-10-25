"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createInviteLink, inviteUrl, type InviteLink } from "@/lib/api/invite";
import { toEpochMs } from "@/store/messages";
import { t } from "@/i18n";

const expiryFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatExpiry(iso: string): string {
  const at = toEpochMs(iso);
  return Number.isNaN(at) ? "" : expiryFormat.format(at);
}

/**
 * Makes an invite link for a GROUP room and shows it for copying. The link is
 * made only when asked: every request creates another one on the server.
 * An inline panel rather than <dialog>, which jsdom does not implement.
 */
export function InvitePanel({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [link, setLink] = useState<InviteLink | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<"yes" | "manual" | null>(null);

  async function create() {
    setPending(true);
    setFailed(false);
    try {
      setLink(await createInviteLink(roomId));
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("yes");
    } catch {
      setCopied("manual"); // no clipboard here (or permission denied): the field stays selectable
    }
  }

  const url = link ? inviteUrl(link.code) : null;
  return (
    <section aria-label={t("invite.title")} className="flex flex-col gap-2 border-t border-border bg-muted px-4 py-3">
      {link && url ? (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              aria-label={t("invite.linkLabel")}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
            />
            <Button size="sm" onClick={() => void copy(url)}>
              {t("invite.copy")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("invite.expiresAt", { time: formatExpiry(link.expiresAt) })}
          </p>
          {copied && (
            <p role="status" className="text-xs">
              {t(copied === "yes" ? "invite.copied" : "invite.copyManually")}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" loading={pending} onClick={() => void create()}>
            {t("invite.create")}
          </Button>
          {failed && (
            <p role="alert" className="text-xs text-destructive">
              {t("invite.error.create")}
            </p>
          )}
        </div>
      )}
      <Button variant="ghost" size="sm" className="self-end" onClick={onClose}>
        {t("invite.close")}
      </Button>
    </section>
  );
}
