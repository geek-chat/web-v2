import { vi } from "vitest";
import type { ChatWSClient } from "@/lib/ws/client";
import type { ServerEventMap, ServerEventType } from "@/lib/ws/events";

/**
 * Test double for ChatWSClient with only what views use: on() and send().
 * emit() plays the server. Put it in the ws store with
 * `useWsStore.setState({ client: fake.client, status: "open" })`.
 */
export function fakeChatClient() {
  const handlers = new Map<string, Set<(data: unknown) => void>>();
  const send = vi.fn<(type: string, data: unknown) => boolean>(() => true);
  const on = vi.fn((type: string, handler: (data: unknown) => void) => {
    const set = handlers.get(type) ?? new Set();
    set.add(handler);
    handlers.set(type, set);
    return () => {
      set.delete(handler);
    };
  });
  return {
    client: { send, on } as unknown as ChatWSClient,
    send,
    on,
    emit<K extends ServerEventType>(type: K, data: ServerEventMap[K]) {
      handlers.get(type)?.forEach((handler) => handler(data));
    },
    listeners: (type: string) => handlers.get(type)?.size ?? 0,
  };
}
