"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createRoom, MAX_GROUP_MEMBERS, ROOM_TTL_HOURS, toRoom } from "@/lib/api/rooms";
import type { UserSearchResult } from "@/lib/api/users";
import { describeApiError } from "@/lib/api/errorMessage";
import { useUserSearch } from "@/hooks/useUserSearch";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRoomsStore } from "@/store/rooms";
import { t } from "@/i18n";

type Ttl = (typeof ROOM_TTL_HOURS)[number] | "none";

/**
 * Pick people, then start a room (ChatRoomService.createRoom): one person and
 * no name opens the DIRECT room with them, or the one that already exists;
 * a name or more people make a GROUP room, which can expire.
 */
export function CreateRoomForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [name, setName] = useState("");
  const [ttl, setTtl] = useState<Ttl>("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results, searching } = useUserSearch(query);

  const isGroup = selected.length > 1 || name.trim() !== "";
  const isPicked = (user: UserSearchResult) => selected.some((u) => u.id === user.id);

  function toggle(user: UserSearchResult) {
    setSelected((list) => {
      if (list.some((u) => u.id === user.id)) return list.filter((u) => u.id !== user.id);
      return list.length < MAX_GROUP_MEMBERS - 1 ? [...list, user] : list;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const room = await createRoom({
        memberIds: selected.map((u) => u.id),
        name: name.trim() || undefined,
        ttlHours: isGroup && ttl !== "none" ? ttl : undefined,
      });
      useRoomsStore.getState().upsertRoom(toRoom(room));
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      setError(describeApiError(err, "createRoom"));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Input
        label={t("rooms.create.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {query.trim() !== "" && (
        <ul className="flex flex-col gap-1">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => toggle(user)}
                aria-pressed={isPicked(user)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted ${isPicked(user) ? "bg-muted" : ""}`}
              >
                <Avatar nickname={user.nickname} size="sm" />
                <span className="flex flex-col">
                  <span className="text-sm">{user.nickname}</span>
                  {user.username && <span className="text-xs text-muted-foreground">@{user.username}</span>}
                </span>
              </button>
            </li>
          ))}
          {!searching && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">{t("rooms.create.noResults")}</li>
          )}
        </ul>
      )}
      {selected.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm text-muted-foreground">{t("rooms.create.selected")}</h3>
          <ul className="flex flex-wrap gap-2">
            {selected.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => toggle(user)}
                  aria-label={t("rooms.create.remove", { name: user.nickname })}
                  className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-border/40"
                >
                  {user.nickname} ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Input
        label={t("rooms.create.name")}
        hint={t("rooms.create.nameHint")}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className="flex flex-col gap-1 text-sm">
        <span>{t("rooms.create.ttl")}</span>
        <select
          value={ttl}
          onChange={(e) => setTtl(e.target.value === "none" ? "none" : (Number(e.target.value) as Ttl))}
          disabled={!isGroup}
          className="h-10 rounded-md border border-border bg-background px-3 disabled:opacity-50"
        >
          <option value="none">{t("rooms.create.ttl.none")}</option>
          {ROOM_TTL_HOURS.map((hours) => (
            <option key={hours} value={hours}>
              {t(`rooms.create.ttl.${hours}`)}
            </option>
          ))}
        </select>
        {!isGroup && <span className="text-xs text-muted-foreground">{t("rooms.create.ttlHint")}</span>}
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={submitting} disabled={selected.length === 0}>
        {t("rooms.create.submit")}
      </Button>
    </form>
  );
}
