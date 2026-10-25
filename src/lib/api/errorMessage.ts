/**
 * User-facing message for a failed API call.
 *
 * geek-chat-server-v2 fills `error` with the HTTP reason phrase ("Conflict"),
 * not the domain error name (common/presentation/web/ChatErrorMapping.kt), so
 * the HTTP status plus the calling context picks the message. Where one status
 * covers two causes, the server message prefix breaks the tie: signup 409 is a
 * taken username or email, signup 400 a weak password or other input, and
 * link-provider 401 an expired link token or an already linked provider.
 */
import { t } from "@/i18n";
import { ApiError, AuthExpiredError } from "./client";

export type ErrorContext =
  | "login"
  | "signup"
  | "username"
  | "oauthLink"
  | "oauthComplete"
  | "createRoom"
  | "invite"
  | "generic";

export function describeApiError(err: unknown, context: ErrorContext): string {
  if (err instanceof AuthExpiredError) return t("auth.error.TokenExpired");
  if (!(err instanceof ApiError)) {
    // fetch rejects with a TypeError when the request never reached the server.
    return err instanceof TypeError ? t("auth.error.network") : t("auth.error.unknown");
  }
  if (err.status >= 500) return t("auth.error.server");
  return byContext(err.status, err.body?.message ?? "", context) ?? t("auth.error.unknown");
}

function byContext(status: number, message: string, context: ErrorContext): string | null {
  switch (context) {
    case "login":
      if (status === 401) return t("auth.error.InvalidCredentials");
      if (status === 403) return t("auth.error.AccountWithdrawn");
      return null;
    case "signup":
      if (status === 409) {
        return message.startsWith("Email")
          ? t("auth.error.EmailAlreadyInUse")
          : t("auth.error.UsernameAlreadyTaken");
      }
      if (status === 400) {
        // WeakPassword (AuthService) starts with "Password"; the length check on the
        // field comes as "password: …", joined with any other field errors (S10).
        return message.startsWith("Password") || message.includes("password:")
          ? t("auth.error.WeakPassword")
          : t("auth.error.invalidInput");
      }
      return null;
    case "username":
      if (status === 409) return t("auth.error.UsernameAlreadyTaken");
      if (status === 400) return t("auth.error.invalidInput");
      return null;
    case "oauthLink":
      if (status === 401) {
        return message.startsWith("Provider")
          ? t("auth.error.ProviderAlreadyLinked")
          : t("auth.error.oauthTokenExpired");
      }
      if (status === 403) return t("auth.error.AccountWithdrawn");
      return null;
    case "oauthComplete":
      if (status === 401) return t("auth.error.oauthTokenExpired");
      if (status === 400) return t("auth.error.invalidInput");
      return null;
    case "createRoom":
      if (status === 404) return t("rooms.error.UserNotFound");
      if (status === 400) {
        return message.startsWith("Room is full")
          ? t("rooms.error.RoomFull")
          : t("auth.error.invalidInput");
      }
      return null;
    case "invite":
      // Joining by code (InviteLinkService.joinByInviteCode). A 400 is a full room,
      // or a link to a DIRECT room made before the server refused those (S18).
      if (status === 404) return t("invite.error.notFound");
      if (status === 410) return t("invite.error.gone");
      if (status === 409) return t("invite.error.alreadyMember");
      if (status === 400) {
        return message.startsWith("Room is full") ? t("rooms.error.RoomFull") : t("invite.invalid");
      }
      return null;
    case "generic":
      return null;
  }
}
