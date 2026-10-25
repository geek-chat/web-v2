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
  "auth.provider.GOOGLE": "Google",
  "auth.provider.NAVER": "네이버",

  // Auth — OAuth callback pages
  "auth.callback.processing": "로그인 처리 중…",
  "auth.link.title": "계정 연결",
  "auth.link.body": "{nickname} 님의 계정이 이미 있습니다. {provider} 로그인을 이 계정에 연결할까요?",
  "auth.link.confirm": "연결하기",
  "auth.link.decline": "새 계정으로 시작",
  "auth.link.success": "계정을 연결했습니다",
  "auth.complete.title": "닉네임 정하기",
  "auth.complete.description": "GeekChat에서 쓸 닉네임을 정해 주세요",
  "auth.complete.submit": "시작하기",
  // Keyed by the backend's /auth/error?error=<code> values (AuthController.kt callback)
  "auth.callbackError.title": "로그인하지 못했습니다",
  "auth.callbackError.oauth_cancelled": "로그인을 취소했습니다",
  "auth.callbackError.missing_params": "로그인 요청에 필요한 정보가 빠졌습니다",
  "auth.callbackError.invalid_state": "보안 확인에 실패했습니다. 처음부터 다시 시도하세요",
  "auth.callbackError.oauth_failed": "소셜 로그인에 실패했습니다",
  "auth.callbackError.unknown": "알 수 없는 이유로 로그인하지 못했습니다",
  "auth.callbackError.back": "처음으로",

  // Session (AuthGuard)
  "session.offline.title": "서버에 연결할 수 없습니다",
  "session.offline.body": "로그인 정보는 그대로 있습니다. 잠시 후 다시 시도하세요",

  // Rooms (list, create)
  "rooms.title": "채팅",
  "rooms.new": "새 대화",
  "rooms.me": "내 정보",
  "rooms.empty.title": "아직 대화가 없습니다",
  "rooms.empty.body": "새 대화를 눌러 첫 대화를 시작해 보세요",
  "rooms.loadError": "채팅방 목록을 불러오지 못했습니다",
  "rooms.select": "왼쪽에서 대화를 고르세요",
  "rooms.members": "{count}명",
  "rooms.expiring": "곧 만료",
  "rooms.create.title": "새 대화",
  "rooms.create.search": "닉네임 또는 @아이디로 찾기",
  "rooms.create.noResults": "찾는 사람이 없습니다",
  "rooms.create.selected": "고른 사람",
  "rooms.create.remove": "{name} 빼기",
  "rooms.create.name": "방 이름 (선택)",
  "rooms.create.nameHint": "한 명만 고르고 이름을 비우면 1:1 대화가 됩니다",
  "rooms.create.ttl": "방 자동 삭제",
  "rooms.create.ttl.none": "사용 안 함",
  "rooms.create.ttl.24": "24시간 뒤",
  "rooms.create.ttl.168": "7일 뒤",
  "rooms.create.ttl.720": "30일 뒤",
  "rooms.create.ttlHint": "1:1 대화에는 적용되지 않습니다",
  "rooms.create.submit": "대화 시작",
  "rooms.error.UserNotFound": "고른 사람을 찾을 수 없습니다",
  "rooms.error.RoomFull": "한 방에는 최대 100명까지 들어갈 수 있습니다",
  "room.back": "목록으로",

  // Chat screen (src/components/chat)
  "chat.input.label": "메시지",
  "chat.input.placeholder": "메시지를 입력하세요",
  "chat.input.send": "보내기",
  "chat.input.ttl": "메시지 자동 삭제",
  "chat.ttl.0": "삭제 안 함",
  "chat.ttl.30": "30초",
  "chat.ttl.300": "5분",
  "chat.ttl.3600": "1시간",
  "chat.ttl.86400": "24시간",
  "chat.message.pending": "보내는 중",
  "chat.message.failedLabel": "보내지 못함",
  "chat.message.retry": "다시 보내기",
  "chat.message.disappearing": "자동 삭제되는 메시지",
  "chat.read": "읽음",
  "chat.readBy": "{count}명 읽음",
  "chat.typing": "{name} 님이 입력 중",
  "chat.typingMany": "여러 명이 입력 중",
  "chat.older": "이전 메시지 보기",
  "chat.start": "대화의 처음입니다",
  "chat.loadError": "메시지를 불러오지 못했습니다",
  "chat.notFound": "방을 찾을 수 없습니다",
  "chat.unknownSender": "알 수 없음",
  "chat.ws.connecting": "연결하는 중…",
  "chat.ws.reconnecting": "다시 연결하는 중…",
  "chat.ws.blocked": "다른 탭에서 열려 있어 연결하지 못했습니다",
  "chat.room.expiresAt": "이 방은 {time}에 만료됩니다",

  // Me (profile)
  "me.title": "내 정보",
  "me.back": "채팅방으로",
  "me.nickname": "닉네임",
  "me.username": "사용자명",
  "me.username.empty": "아직 정하지 않았습니다. 영소문자/숫자/_ 3~20자",
  "me.username.submit": "사용자명 저장",
  "me.username.success": "사용자명을 저장했습니다",
  "me.logout.success": "로그아웃했습니다",
  "me.withdraw.title": "회원 탈퇴",
  "me.withdraw.description": "탈퇴하면 계정이 익명 처리되고 되돌릴 수 없습니다. 계속하려면 {phrase}를 그대로 입력하세요",
  "me.withdraw.label": "확인 문구",
  "me.withdraw.submit": "탈퇴하기",
  "me.withdraw.success": "탈퇴했습니다",

  // Chat connection notices (src/components/chat/ChatConnection.tsx)
  "chat.room.unnamed": "이름 없는 방",
  "chat.room.expiring": "'{name}' 방이 {time}에 만료됩니다",
  "chat.room.expiringSoon": "'{name}' 방이 곧 만료됩니다",
  "chat.room.expired": "'{name}' 방이 만료되어 목록으로 돌아왔습니다",
  "chat.message.expired": "자동 삭제 메시지 {count}개가 사라졌습니다",
  "chat.message.sendFailed": "메시지를 보내지 못했습니다",
  "chat.ws.tooManyConnections": "다른 탭에서 채팅이 열려 있어 연결하지 못했습니다. 탭 하나를 닫고 다시 시도하세요",

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
