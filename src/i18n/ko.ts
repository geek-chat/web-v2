/**
 * Korean message map (M1 = single locale).
 *
 * Flat keyed strings. When we add English in M2, this file becomes
 * `ko.ts` next to `en.ts` and `index.ts` exports the active map.
 *
 * Convention: `<area>.<context>.<key>` — e.g. `auth.signup.title`.
 */
export const ko = {
  // Common
  "common.appName": "GeekChat",
  "common.loading": "불러오는 중…",
  "common.error": "오류가 발생했습니다",
  "common.retry": "다시 시도",
  "common.cancel": "취소",
  "common.confirm": "확인",
  "common.save": "저장",
  "common.delete": "삭제",
  "common.logout": "로그아웃",

  // Landing hero
  "landing.tagline": "프라이버시 우선 메신저",
  "landing.subtitle": "개인정보 수집 X · 종단간 메시지 · 임시 채팅방",
  "landing.privacy": "이메일·전화번호 없이 시작하세요",

  // Auth — shared
  "auth.or": "또는",
  "auth.haveAccount": "이미 계정이 있나요?",
  "auth.noAccount": "계정이 없나요?",
  "auth.goLogin": "로그인",
  "auth.goSignup": "가입하기",

  // Auth — signup
  "auth.signup.title": "GeekChat 시작하기",
  "auth.signup.username": "사용자명",
  "auth.signup.usernameHint": "영소문자/숫자/_ 3~20자",
  "auth.signup.password": "비밀번호",
  "auth.signup.passwordHint": "8자 이상, 문자와 숫자 포함",
  "auth.signup.nickname": "닉네임",
  "auth.signup.nicknameHint": "1~20자",
  "auth.signup.email": "이메일 (선택)",
  "auth.signup.submit": "가입",
  "auth.signup.success": "가입 완료",

  // Auth — login
  "auth.login.title": "로그인",
  "auth.login.username": "사용자명",
  "auth.login.password": "비밀번호",
  "auth.login.submit": "로그인",
  "auth.login.success": "환영합니다",

  // Auth — OAuth buttons
  "auth.oauth.google": "Google로 계속",
  "auth.oauth.naver": "네이버로 계속",

  // Auth — errors. Chosen by HTTP status + call context in src/lib/api/errorMessage.ts,
  // because the server's `error` field is the reason phrase, not the domain code.
  "auth.error.UsernameAlreadyTaken": "이미 사용 중인 사용자명입니다",
  "auth.error.EmailAlreadyInUse": "이미 사용 중인 이메일입니다",
  "auth.error.InvalidCredentials": "사용자명 또는 비밀번호가 올바르지 않습니다",
  "auth.error.WeakPassword": "비밀번호는 8자 이상이고 문자와 숫자를 함께 써야 합니다",
  "auth.error.AccountWithdrawn": "탈퇴한 계정입니다",
  "auth.error.ProviderAlreadyLinked": "이미 다른 계정에 연결된 소셜 로그인입니다",
  "auth.error.TokenExpired": "세션이 만료되었습니다. 다시 로그인하세요",
  "auth.error.oauthTokenExpired": "로그인 시간이 지났습니다. 처음부터 다시 시도하세요",
  "auth.error.invalidInput": "입력한 값을 다시 확인하세요",
  "auth.error.server": "서버에 문제가 생겼습니다. 잠시 후 다시 시도하세요",
  "auth.error.network": "네트워크 오류가 발생했습니다",
  "auth.error.unknown": "알 수 없는 오류가 발생했습니다",
} as const;

export type TranslationKey = keyof typeof ko;
