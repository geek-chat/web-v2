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
});
