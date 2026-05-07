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
| GET | `/api/rooms` | Yes | — | `[{id, type, name, lastMessageAt, expiresAt, members: [{userId, nickname, profileImageUrl}]}]` |
| POST | `/api/rooms` | Yes | `{memberIds, name?, ttlHours?}` | `{id, type, name, expiresAt, members: [{userId, nickname}]}` |
| GET | `/api/rooms/:id/messages?cursor=&limit=&direction=` | Yes | query | `[{id, senderId, senderNickname, content, type, createdAt, expiresAt}]` |

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
| `message_ack` | `{clientMessageId, serverId}` | optimistic UI에서 임시 메시지를 `serverId`로 교체 |
| `new_message` | `{id, roomId, senderId, content, type, createdAt, expiresAt}` | 메시지 리스트에 추가 |
| `typing_indicator` | `{roomId, userId}` | 3초 동안 "입력 중..." 표시 |
| `read_update` | `{roomId, userId, lastReadAt}` | 읽음 표시 갱신 |
| `room_expiring` | `{roomId, roomName, expiresAt}` | 만료 10분 전 토스트 |
| `room_expired` | `{roomId, roomName}` | 방 목록에서 제거 |
| `message_expired` | `{roomId, messageIds}` | 해당 메시지 UI 제거 |
| `error` | `{code, message}` | 에러별 처리 (아래 표) |

### 에러 코드 (close 코드 1008과 함께 옴)

| code | 의미 | 클라 처리 |
|---|---|---|
| `NO_TOKEN` | 토큰 없이 연결 | 로그인 redirect |
| `TOKEN_EXPIRED` | JWT 만료 | refresh 후 재연결 |
| `INVALID_TOKEN` | JWT 변조 | localStorage clear + 로그인 |
| `RATE_LIMITED` | 재연결 너무 빠름 (2초) | 백오프 |
| `MAX_CONNECTIONS` | 동시 4개 시도 | "다른 기기에서 접속 중" 안내 |
| `NOT_AUTHENTICATED` | SecurityContext 없음 | 재연결 |
| `INVALID_FORMAT` | JSON 파싱 실패 | 클라 버그 — 로그 |
| `UNKNOWN_EVENT` | 미지의 type | 클라 버그 |
| `INVALID_DATA` | 필수 필드 누락 | 클라 버그 |
| `SEND_FAILED` | sendMessage 비즈니스 실패 | 사용자에게 보여줌 |

### WebSocket 클라이언트 클래스 (권장 구조)

```typescript
// src/lib/ws.ts
type Handler = (data: any) => void

export class ChatWebSocketClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<Handler>>()
  private reconnectMs = 1000
  private intentionalClose = false

  connect(token: string) {
    const url = `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectMs = 1000
    }

    this.ws.onmessage = (e) => {
      const { type, data } = JSON.parse(e.data)
      this.handlers.get(type)?.forEach((h) => h(data))
    }

    this.ws.onclose = (e) => {
      if (this.intentionalClose) return

      if (e.code === 1008) {
        // POLICY_VIOLATION → token issue
        this.refreshAndReconnect()
        return
      }

      // 일반 종료 → 백오프 재연결
      setTimeout(() => this.connect(token), this.reconnectMs)
      this.reconnectMs = Math.min(this.reconnectMs * 2, 30000)
    }
  }

  on(type: string, handler: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)!.delete(handler)
  }

  send(type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  sendMessage(roomId: string, content: string, ttlSeconds = 0) {
    this.send('send_message', {
      roomId,
      content,
      clientMessageId: crypto.randomUUID(),
      ttlSeconds,
    })
  }

  typingStart(roomId: string) {
    this.send('typing_start', { roomId })
  }

  markRead(roomId: string, lastReadMessageId: string) {
    this.send('mark_read', { roomId, lastReadMessageId })
  }

  close() {
    this.intentionalClose = true
    this.ws?.close()
  }

  private async refreshAndReconnect() {
    // refresh 후 재연결 — 자세한 구현은 store와 통합
  }
}
```

### 통합 패턴 (권장: Zustand store + 단일 인스턴스)

```typescript
// src/store/ws.ts
export const useWsStore = create<WsState>((set, get) => ({
  client: null,
  connect: (token) => {
    const c = new ChatWebSocketClient()
    c.connect(token)
    set({ client: c })
  },
  disconnect: () => {
    get().client?.close()
    set({ client: null })
  },
}))

// 사용
const ws = useWsStore((s) => s.client)
useEffect(() => {
  const off = ws?.on('new_message', (data) => addMessage(data))
  return off
}, [ws])
```

**Why Zustand 단일 인스턴스**: WebSocket은 글로벌 자원. 컴포넌트마다 connect하면 N개 연결 (서버 max 3 위반). Zustand store에 1개만 두고 모두 구독.

---

## 6. Optimistic UI (메시지 전송)

권장 패턴:

```typescript
function sendMessage(roomId: string, content: string) {
  const clientMessageId = crypto.randomUUID()
  const tempMessage = {
    id: clientMessageId,  // 임시
    roomId,
    senderId: currentUserId,
    content,
    type: 'TEXT',
    createdAt: new Date().toISOString(),
    pending: true,
  }

  // 1. 즉시 UI에 추가
  addMessageToRoom(roomId, tempMessage)

  // 2. WS로 전송
  ws.sendMessage(roomId, content)

  // 3. message_ack 받으면 임시 메시지를 serverId로 교체
  ws.on('message_ack', ({ clientMessageId: cmid, serverId }) => {
    if (cmid === clientMessageId) {
      replaceMessageId(roomId, clientMessageId, serverId)
      markMessageSent(roomId, serverId)
    }
  })

  // 4. 5초 내 ack 없으면 실패 표시
  setTimeout(() => {
    if (isMessagePending(roomId, clientMessageId)) {
      markMessageFailed(roomId, clientMessageId)
    }
  }, 5000)
}
```

서버는 `clientMessageId` 멱등성을 보장하므로 재전송도 안전 (3중 방어: 사전 조회 + UNIQUE 제약 + race-condition catch).

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
