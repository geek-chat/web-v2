import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});
vi.mock("next/navigation", () => ({ useRouter: () => nav.router }));
vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn(async () => {}) }));

import { verifySession } from "@/lib/auth/session";
import { useAuthStore, type AuthStatus } from "@/store/auth";
import { AuthGuard } from "./AuthGuard";

const USER = { id: "u1", nickname: "Alice", username: "alice", profileImageUrl: null };
const setStatus = (status: AuthStatus) =>
  useAuthStore.setState({ status, user: status === "authenticated" ? USER : null });
const renderGuard = () =>
  render(
    <AuthGuard>
      <p>secret</p>
    </AuthGuard>,
  );

beforeEach(() => {
  nav.replace.mockReset();
  vi.mocked(verifySession).mockClear();
});

describe("AuthGuard", () => {
  it("shows the children for an authenticated session", () => {
    setStatus("authenticated");

    renderGuard();

    expect(screen.getByText("secret")).toBeDefined();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it.each<AuthStatus>(["idle", "loading"])("shows a spinner, not the children, while %s", (status) => {
    setStatus(status);

    renderGuard();

    expect(screen.queryByText("secret")).toBeNull();
    expect(screen.getByRole("status")).toBeDefined();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("sends an unauthenticated visitor to /login", () => {
    setStatus("unauthenticated");

    renderGuard();

    expect(screen.queryByText("secret")).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith("/login");
  });

  it("offers a retry when offline instead of logging the user out", () => {
    setStatus("offline");

    renderGuard();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(screen.queryByText("secret")).toBeNull();
    expect(screen.getByRole("alert")).toBeDefined();
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("follows the session as it settles", () => {
    setStatus("loading");
    renderGuard();

    act(() => setStatus("authenticated"));

    expect(screen.getByText("secret")).toBeDefined();
  });

  it("sends the user to /login when the session ends, which logout and withdraw rely on", () => {
    setStatus("authenticated");
    renderGuard();

    act(() => setStatus("unauthenticated"));

    expect(nav.replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("secret")).toBeNull();
  });
});

describe("AuthGuard and an invite link opened while signed out", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("brings the user back to the invite after signing in", () => {
    window.history.replaceState(null, "", "/invite/AbC12dEf");
    setStatus("unauthenticated");
    renderGuard();
    expect(nav.replace).toHaveBeenCalledWith("/login");

    // Every way of signing in ends on /rooms, inside the guard.
    window.history.replaceState(null, "", "/rooms");
    act(() => setStatus("authenticated"));

    expect(nav.replace).toHaveBeenLastCalledWith("/invite/AbC12dEf");
  });

  it("remembers no other page", () => {
    window.history.replaceState(null, "", "/me");
    setStatus("unauthenticated");
    renderGuard();

    window.history.replaceState(null, "", "/rooms");
    act(() => setStatus("authenticated"));

    expect(nav.replace).toHaveBeenCalledTimes(1); // only the trip to /login
  });
});
