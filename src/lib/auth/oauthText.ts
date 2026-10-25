/**
 * Display text for values the backend puts in OAuth redirects.
 * Typed allowlists: an unexpected value falls back instead of building a
 * message key from untrusted URL input.
 */
import { t } from "@/i18n";

// AuthController.kt callback: /auth/error?error=<code>
const ERROR_CODES = ["oauth_cancelled", "missing_params", "invalid_state", "oauth_failed"] as const;
type OAuthErrorCode = (typeof ERROR_CODES)[number];

// AuthController.kt callback: new_provider=<OAuthProvider enum name>
const PROVIDERS = ["GOOGLE", "NAVER"] as const;
type Provider = (typeof PROVIDERS)[number];

const includes = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value);

export function oauthErrorMessage(code: string | null): string {
  if (code && includes<OAuthErrorCode>(ERROR_CODES, code)) {
    return t(`auth.callbackError.${code}`);
  }
  return t("auth.callbackError.unknown");
}

export function providerLabel(provider: string): string {
  return includes<Provider>(PROVIDERS, provider) ? t(`auth.provider.${provider}`) : provider;
}
