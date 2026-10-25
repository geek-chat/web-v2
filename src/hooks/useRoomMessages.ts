import { useCallback, useEffect, useState } from "react";
import { loadOlderMessages, loadRoomMessages } from "@/lib/chat/backfill";
import { type ChatMessage, useMessagesStore } from "@/store/messages";

const NO_MESSAGES: ChatMessage[] = [];

/**
 * One room's messages for its view: loads the first page when the room is not
 * loaded yet, and older pages on demand. Render it under a key of the room id
 * (ChatRoom does), so the paging state starts over for each room.
 */
export function useRoomMessages(roomId: string) {
  const messages = useMessagesStore((s) => s.byRoom[roomId]);
  const stored = useMessagesStore((s) => Object.hasOwn(s.loaded, roomId));
  // The store marks the room loaded when the first page merges, before the
  // backfill and before loadRoomMessages says whether that page reached the
  // start. A room this view loads itself counts as loaded once that answer is
  // in, so the first render that shows the list already has reachedStart.
  const [answered, setAnswered] = useState(() => Object.hasOwn(useMessagesStore.getState().loaded, roomId));
  const [error, setError] = useState<unknown>(null);
  const [reachedStart, setReachedStart] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loaded = stored && answered;

  const loadFirst = useCallback(() => {
    loadRoomMessages(roomId).then(
      (atStart) => {
        if (atStart) setReachedStart(true);
        setAnswered(true);
      },
      (err: unknown) => {
        setError(err);
        setAnswered(true); // a backfill that failed after the merge still leaves the page to show
      },
    );
  }, [roomId]);

  useEffect(() => {
    if (!stored) loadFirst();
  }, [stored, loadFirst]);

  const retry = useCallback(() => {
    setError(null);
    setAnswered(false);
    loadFirst();
  }, [loadFirst]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || reachedStart) return;
    setLoadingOlder(true);
    try {
      if (await loadOlderMessages(roomId)) setReachedStart(true);
    } catch {
      // The button stays, so the user can try again.
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, loadingOlder, reachedStart]);

  // Rows stay out until the list shows them: useMarkRead reads these, and a
  // mark_read can delete a burn-after-read message (RULES.md R6).
  const shown = loaded && messages ? messages : NO_MESSAGES;
  return { messages: shown, loaded, error, retry, loadOlder, loadingOlder, reachedStart };
}
