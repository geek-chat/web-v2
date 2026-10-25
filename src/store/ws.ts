/**
 * WebSocket store: the app's one ChatWSClient and what the UI shows about it
 * (RULES.md R2). Never construct a client in a component;
 * src/lib/chat/connection.ts owns its lifetime.
 */
import { create } from "zustand";
import type { ChatWSClient, WSStatus } from "@/lib/ws/client";

export interface ExpiringRoom {
  roomName: string | null;
  expiresAt: string;
}

interface WsState {
  client: ChatWSClient | null;
  status: WSStatus;
  /** Rooms that sent room_expiring, for the banner. Cleared when room_expired arrives. */
  expiringRooms: Record<string, ExpiringRoom>;

  setClient: (client: ChatWSClient | null) => void;
  setStatus: (status: WSStatus) => void;
  markRoomExpiring: (roomId: string, room: ExpiringRoom) => void;
  clearRoomExpiring: (roomId: string) => void;
  reset: () => void;
}

export const useWsStore = create<WsState>((set) => ({
  client: null,
  status: "idle",
  expiringRooms: {},

  setClient: (client) => set({ client, status: client?.getStatus() ?? "idle" }),

  setStatus: (status) => set({ status }),

  markRoomExpiring: (roomId, room) =>
    set((state) => ({ expiringRooms: { ...state.expiringRooms, [roomId]: room } })),

  clearRoomExpiring: (roomId) =>
    set((state) => {
      if (!Object.hasOwn(state.expiringRooms, roomId)) return state;
      const rest = { ...state.expiringRooms };
      delete rest[roomId];
      return { expiringRooms: rest };
    }),

  reset: () => set({ client: null, status: "idle", expiringRooms: {} }),
}));
