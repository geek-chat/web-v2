# API Integration — REST + WebSocket

GeekChat v2 백엔드와 Next.js 프론트엔드 연동 가이드.

작성일: 2026-05-08
백엔드 위치: `~/Work/geek-chat/geek-chat-server-v2/`

---

## 1. 환경 변수

`.env.local` (gitignored):
```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

`.env.production` (Vercel 환경변수로 관리):
```
NEXT_PUBLIC_API_URL=https://api.<your-domain>
NEXT_PUBLIC_WS_URL=wss://api.<your-domain>/ws
```

`NEXT_PUBLIC_*` prefix는 클라이언트 번들에 노출됨 (정상).

---

## 2. REST API 카탈로그 (전체)

### Auth (12)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/auth/signup` | No | `{username, password, nickname, email?}` | `{accessToken, refreshToken}` |
| POST | `/auth/login` | No | `{username, password}` | `{accessToken, refreshToken}` |
| POST | `/auth/withdraw` | Yes | `{}` | `{success: true}` |
| GET | `/auth/google` | No | — | 302 redirect to Google |
| GET | `/auth/naver` | No | — | 302 redirect to Naver |
| GET | `/auth/callback?code=&state=` | No | query | 302 to `/auth/{success\|oauth-link\|oauth-complete\|error}#...` |
| POST | `/auth/oauth/complete-signup` | No (signupToken) | `{signupToken, nickname}` | `{accessToken, refreshToken}` |
| POST | `/auth/link-provider` | No (linkToken) | `{linkToken, confirm: bool}` | `{accessToken, refreshToken}` 또는 `{signupToken, suggestedNickname}` |
| POST | `/auth/refresh` | No | `{refreshToken}` | `{accessToken, refreshToken}` |
| POST | `/auth/logout` | No | `{refreshToken}` | `{success: true}` |
| GET | `/auth/me` | Yes | — | `{id, nickname, username, profileImageUrl}` |
| GET | `/auth/dev-login?name=X` | No (dev only) | — | `{accessToken, refreshToken, message}` |

### User (2)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/users/search?q=X` | Yes | query | `[{id, nickname, username, profileImageUrl}]` (최대 10개) |
| PATCH | `/api/users/me/username` | Yes | `{username}` | `{username}` |

`q`가 `@`로 시작하면 username 정확 매칭. 그 외는 nickname ILIKE 부분 매칭.

### Room (3)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/rooms` | Yes | — | `[{id, type, name, lastMessageAt, expiresAt, members: [{userId, nickname, profileImageUrl, lastReadAt}]}]`. `lastReadAt`은 그 멤버가 마지막으로 읽은 메시지의 createdAt이고 읽은 적 없으면 null (server-v2 `bf2c85d`). 읽음 표시의 시작값이 된다 |
| POST | `/api/rooms` | Yes | `{memberIds, name?, ttlHours?}` | `{id, type, name, expiresAt, members: [{userId, nickname}]}` |
| GET | `/api/rooms/:id/messages?cursor=&limit=&direction=` | Yes | query | `[{id, clientMessageId, senderId, senderNickname, content, type, createdAt, expiresAt, replyToMessageId, burnAfterRead}]`. `clientMessageId`는 보낸 쪽의 멱등성 키 (`bf2c85d`). ack를 잃은 이 탭의 행을 서버 행으로 합치는 데 쓴다 |

POST 규칙:
- `memberIds.length == 1 && !name` → DIRECT
- 그 외 → GROUP
- `ttlHours`: null (영구) / 24 / 168 / 720 (GROUP만 적용)

GET messages 쿼리:
- `cursor`: ISO-8601 타임스탬프 (생략 시 최신부터)
- `limit`: 1-100, 기본 50
- `direction`: `forward` (cursor 이후) / `backward` (cursor 이전, 기본)

### Invite (2)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/rooms/:roomId/invite-link` | Yes | `{ttlHours?, maxUses?}` | `{code, roomId, expiresAt, maxUses, currentUses}` |
| POST | `/api/invite/:code/join` | Yes | — | `{id, type, name, members: [{userId, nickname}]}` (방 객체) |

### Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | No | `{status: "ok", db: "connected", uptime, timestamp}` |

---

## 3. HTTP Status 매핑 (에러 처리)

| ChatError | HTTP | 사용자에게 보여줄 처리 |
|---|---|---|
| `TokenNotProvided` / `TokenExpired` / `InvalidToken` / `InvalidCredentials` | 401 | 자동 refresh → 실패 시 로그인 화면 |
| `AccountWithdrawn` / `NotRoomMember` | 403 | "이 작업을 수행할 수 없습니다" |
| `UserNotFound` / `RoomNotFound` / `MessageNotFound` / `InviteLinkNotFound` | 404 | "찾을 수 없습니다" |
| `InviteLinkExpired` / `InviteLinkMaxUsesReached` | 410 | "이 초대 링크는 만료되었습니다" |
| `UsernameAlreadyTaken` / `EmailAlreadyInUse` / `AlreadyRoomMember` | 409 | 인라인 필드 에러 |
| `WeakPassword` / `InvalidUsername` / `NicknameRequired` / `RoomFull` | 400 | 인라인 필드 에러 |
| `OAuthExchangeFailed` | 502 | "소셜 로그인 실패. 잠시 후 재시도" |

응답 body 형식 (모든 에러 공통):
```json
{ "statusCode": 401, "message": "...", "error": "Unauthorized" }
```

---

## 4. fetch 래퍼 (단일-플라이트 refresh 패턴)

`src/lib/api.ts` 권장 구조:

```typescript
import { useAuthStore } from '@/store/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

let isRefreshing = false
let pendingRequests: Array<() => void> = []

async function fetchWithToken(path: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().accessToken
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  return fetch(`${API_URL}${path}`, { ...options, headers })
}

async function refresh(): Promise<void> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) throw new Error('no refresh token')

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) throw new Error('refresh failed')

  const { accessToken, refreshToken: newRefresh } = await res.json()
  useAuthStore.getState().setTokens(accessToken, newRefresh)
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await fetchWithToken(path, options)

  if (res.status !== 401) {
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  // 401 → refresh
  if (isRefreshing) {
    await new Promise<void>((resolve) => pendingRequests.push(resolve))
  } else {
    isRefreshing = true
    try {
      await refresh()
      pendingRequests.forEach((r) => r())
      pendingRequests = []
    } catch (e) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      throw e
    } finally {
      isRefreshing = false
    }
  }

  // 재시도 (1회만)
  res = await fetchWithToken(path, options)
  if (!res.ok) throw await toApiError(res)
  return res.json()
}

async function toApiError(res: Response): Promise<Error> {
  try {
    const body = await res.json()
    const err = new Error(body.message ?? res.statusText) as Error & {
      statusCode?: number
      apiError?: string
    }
    err.statusCode = body.statusCode ?? res.status
    err.apiError = body.error
    return err
  } catch {
    return new Error(res.statusText)
  }
}

// 사용 예시
export const auth = {
  signup: (req: SignupRequest) => api<TokenPair>('/auth/signup', { method: 'POST', body: JSON.stringify(req) }),
  login: (req: LoginRequest) => api<TokenPair>('/auth/login', { method: 'POST', body: JSON.stringify(req) }),
  me: () => api<UserMe>('/auth/me'),
  withdraw: () => api<{ success: true }>('/auth/withdraw', { method: 'POST', body: '{}' }),
}
```

---

## 5. WebSocket 클라이언트

### 연결 URL

```
ws://localhost:8080/ws?token=<access_token>     // dev
wss://api.<domain>/ws?token=<access_token>      // prod
```

### Envelope 형식

모든 메시지: `{"type": "<event>", "data": {...}}`

### Inbound (Client → Server)

| type | data | 응답 |
|---|---|---|
| `send_message` | `{roomId, content, clientMessageId, ttlSeconds?}` | `message_ack` (자기) + `new_message` (방) |
| `typing_start` | `{roomId}` | `typing_indicator` (방, 자기 제외) |
| `mark_read` | `{roomId, lastReadMessageId}` | `read_update` (방) |

### Outbound (Server → Client)

| type | data | 처리 |
|---|---|---|
| `connected` | `{userId, roomIds}` | 수락 신호. 서버가 연결을 받고 방에 등록한 뒤 한 번 보낸다 (`bf2c85d`). 이 프레임에서 `open`이 되고 backfill이 돈다 |
| `message_ack` | `{clientMessageId, serverId}` | optimistic UI에서 임시 메시지를 `serverId`로 교체 |
| `new_message` | `{id, roomId, senderId, content, type, createdAt, expiresAt, replyToMessageId, burnAfterRead}` | 메시지 리스트에 추가. `replyToMessageId`가 있으면 인용 표시 |
| `typing_indicator` | `{roomId, userId}` | 3초 동안 "입력 중..." 표시 |
| `read_update` | `{roomId, userId, lastReadAt}` | 읽음 표시 갱신 |
| `room_expiring` | `{roomId, roomName, expiresAt}` | 만료 10분 전 토스트 |
| `room_expired` | `{roomId, roomName}` | 방 목록에서 제거 |
| `message_expired` | `{roomId, messageIds}` | 해당 메시지 UI 제거 |
| `message_burned` | `{roomId, messageId}` | 해당 메시지 즉시 제거 (M2 Burn-on-Read, 발신자에게도 온다) |
| `error` | `{code, message}` | 에러별 처리 (아래 표) |

### 에러 코드

앞의 여섯 개(`NO_TOKEN`부터 `ACCOUNT_WITHDRAWN`까지)는 연결 수준 코드다. 서버는 이 `error`를 보낸 직후 1008로 닫는다. 연결 직후 검사(server-v2 `ChatWebSocketHandler.reject`)와, 탈퇴가 커밋된 뒤 그 사용자의 열린 연결(`WithdrawnUserDisconnector`)이 그렇다. 운영(Cloudflare → Render)에서는 이 close 프레임이 오지 않고 약 20초 뒤 1006으로 끊긴다(2026-10-28 실측). 그래서 클라이언트는 프레임을 받자마자 직접 닫고 그 코드로 판단한다. 나머지 코드가 오면 연결은 유지된다. 두 무리는 계약으로 겹치지 않는다(server-v2 `docs/WEBSOCKET.md` §4.9). 처리 규칙 정본은 `.claude/RULES.md` R2다.

| code | 의미 | 클라 처리 |
|---|---|---|
| `NO_TOKEN` | 토큰 없이 연결 | refresh 1회 시도, 실패하면 로그인 redirect |
| `TOKEN_EXPIRED` | JWT 만료 | 공용 single-flight refresh 후 재연결 |
| `INVALID_TOKEN` | JWT 변조 | refresh 1회 시도, 실패하면 `clearSession()` + 로그인 |
| `RATE_LIMITED` | 재연결 너무 빠름 (2초 미만) | refresh 없이 2초 이상 + jitter 대기 후 재연결 |
| `MAX_CONNECTIONS` | 동시 4개 시도 (상한 3) | 재연결하지 않음. 다른 탭을 닫으라는 안내 + 수동 재시도 |
| `ACCOUNT_WITHDRAWN` | 탈퇴한 계정. 열린 연결에도 온다 | 재연결하지 않음. 세션을 끝내고 로그인 화면으로 (같은 토큰은 만료까지 15분 동안 거부된다) |
| `NOT_AUTHENTICATED` | 연결에 사용자 정보가 없음 (서버 쪽 이상) | 연결은 유지된다. 클라이언트는 따로 처리하지 않는다 |
| `INVALID_FORMAT` | JSON 파싱 실패 | 클라 버그 — 로그 |
| `UNKNOWN_EVENT` | 미지의 type | 클라 버그 |
| `INVALID_DATA` | 필수 필드 누락 | 클라 버그. 요청에 `clientMessageId`가 있었으면 함께 오니 그 대기 메시지를 failed로 |
| `SEND_FAILED` | sendMessage 비즈니스 실패 (예: 방 멤버 아님) | `clientMessageId`가 항상 함께 온다. 그 대기 메시지를 바로 failed로 바꾸고 사용자에게 보여줌 (RULES.md R6) |

### WebSocket 클라이언트 (구현: `src/lib/ws/client.ts`)

재연결 규칙의 정본은 `.claude/RULES.md` R2이고, 구현은 `src/lib/ws/client.ts`의 `ChatWSClient`다. 예전에 여기 있던 샘플 클래스는 지웠다. `close()` 뒤에도 대기 중인 타이머나 끝나지 않은 refresh가 소켓을 다시 열 수 있었고, `sendMessage`가 매번 새 UUID를 만들어 재시도가 다른 메시지가 됐기 때문이다.

요점:
- 래퍼 하나가 리스너를 계속 들고 있고, 시도할 때마다 새 `WebSocket`에 콜백을 다시 단다. 교체된 소켓의 콜백은 무시한다.
- 토큰은 시도할 때마다 storage에서 읽는다. 곧 만료될 토큰이면 연결 전에 공용 `refreshOnce()`로 갱신한다.
- 연결 수준 오류 프레임을 받으면 그 자리에서 소켓을 닫고 코드로 나눈다. close 코드는 보지 않는다(운영에서는 1008 대신 1006이 온다). `MAX_CONNECTIONS`는 `retry()`를 기다리고, `RATE_LIMITED`는 refresh 없이 백오프하고, `ACCOUNT_WITHDRAWN`은 세션을 끝낸다. 인증 코드는 refresh를 한 번 하고, 다음 시도도 같은 이유로 거부되면 세션을 끝낸다. 프레임 없이 온 1008도 refresh를 한 번 한다.
- 수락은 `connected` 프레임으로 안다. 그 전 서버를 위해, 1초 동안 거부가 없으면 수락으로 보는 대비책을 남겼다.
- 백오프는 2초에서 시작해 30초까지 두 배씩 늘고 jitter가 붙는다. 10초 유지되거나 `error`와 `connected`가 아닌 프레임이 와야 되돌린다. 서버 heartbeat(25초마다 ping, 60초 무응답이면 4500으로 닫음)로 끊긴 연결도 백오프로 다시 붙는다.
- 상태는 `idle`, `connecting`, `open`(서버가 받아들임), `reconnecting`, `blocked`(`MAX_CONNECTIONS`), `closed` 여섯 가지다.
- `send()`는 열린 소켓이 없으면 `false`를 돌려준다.

### 연결 수명과 이벤트 연결 (구현: `src/lib/chat/connection.ts`)

- `(authed)` 레이아웃이 `ChatConnection`(`src/components/chat/ChatConnection.tsx`)을 `AuthGuard` 안에 둔다. 인증된 화면이 보이는 동안에만 연결이 살아 있다.
- `acquireChat()`과 `releaseChat()`이 보유 수를 센다. 마지막 해제는 다음 태스크에 닫으므로 Strict Mode의 mount, unmount, mount가 소켓 하나로 끝난다. 닫을 때 채팅 스토어도 비운다.
- 이벤트는 스토어로 간다(`new_message`, `message_ack`, `clientMessageId`가 실린 `error`, `message_expired`, `message_burned`, `room_expiring`, `room_expired`). 서버가 연결을 받아들일 때마다 backfill(`src/lib/chat/backfill.ts`)이 돈다.
- 컴포넌트에서 `new ChatWSClient()`를 만들지 않는다. 서버 상한이 사용자당 3개라서다.

---

## 6. Optimistic UI (메시지 전송)

구현은 `src/lib/chat/connection.ts`의 `sendChatMessage()`, `retryChatMessage()`와 `src/store/messages.ts`에 있다. 규칙 정본은 RULES.md R6이다.

1. `sendChatMessage()`가 `clientMessageId`를 만들고 대기(`pending`) 행을 바로 붙인 뒤 보낸다. 열린 소켓이 없으면 그 자리에서 `failed`가 된다.
2. `message_ack`와 `new_message`는 어느 쪽이 먼저 올지 모른다. ack는 핸들러 스레드에서 바로 나가고, `new_message`는 커밋 뒤 비동기 리스너에서 나가기 때문이다. 스토어는 두 순서를 모두 한 행으로 맞춘다.
3. `clientMessageId`가 실린 `error`(`SEND_FAILED`, `INVALID_DATA`)는 그 행을 바로 `failed`로 바꾼다. 5초 안에 ack가 없을 때도 `failed`다.
4. `retryChatMessage()`는 같은 `clientMessageId`로 다시 보낸다. 이미 저장된 메시지라면 서버가 저장된 것을 돌려준다(사전 조회, UNIQUE 제약, 경합 catch의 3중 방어). 이 경우 ack만 오고 `new_message`는 오지 않으니, 스토어는 ack만으로도 확정한다.
5. React key는 `clientMessageId ?? id`로 둔다. 그래야 ack 뒤에도 같은 행으로 남는다.

---

## 7. CORS 주의사항

백엔드 `SecurityConfig.kt`의 CORS:
- `allowedOriginPatterns`: `${FRONTEND_URL}` + `${FRONTEND_ORIGIN_PATTERNS}` (CSV)
- `allowCredentials: true`

따라서:
- Vercel preview 배포 (`*.vercel.app`)는 자동 허용
- 커스텀 도메인 사용 시 백엔드 `.env.docker`의 `FRONTEND_URL` 갱신 필요

쿠키 기반 인증은 안 쓰므로 `credentials: 'include'` 불필요. Authorization 헤더만 사용.

---

## 8. 자세한 백엔드 문서

- API 전체: `~/Work/geek-chat/geek-chat-server-v2/docs/API.md`
- WebSocket 전체: `~/Work/geek-chat/geek-chat-server-v2/docs/WEBSOCKET.md`
- 도메인 용어: `~/Work/geek-chat/geek-chat-server-v2/CLAUDE.md` §5
