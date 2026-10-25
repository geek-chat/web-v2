# Architecture — Next.js 15 (App Router)

GeekChat v2 프론트엔드 폴더 구조 + 라이브러리 선택 + 데이터 흐름.

작성일: 2026-05-08

---

## 0. 핵심 결정 (Why 한 줄씩)

| 항목 | 선택 | Why |
|---|---|---|
| 프레임워크 | Next.js 15 App Router | Vercel 일급 지원 + RSC. Pages Router는 maintenance 모드 |
| 언어 | TypeScript strict | 백엔드 DTO 그대로 타입화. OAuth 토큰 분기 컴파일러가 강제 |
| 스타일 | TailwindCSS + `dark` class on `<html>` | 다크모드 기본 + 빠른 스캐폴딩 |
| 폼 | react-hook-form + zod + @hookform/resolvers | RHF는 상태, zod 스키마는 API DTO 파싱에 재사용 |
| 상태 | Zustand (slice 파일 분할) | Provider 트리 없음. 슬라이스로 리렌더 격리 |
| 데이터 페칭 | SWR | 채팅은 WS 주도. SWR은 방 목록/me/검색만. TanStack Query는 과함 |
| 토스트 | sonner | 단일 컴포넌트 + 접근성 + 기본 다크 |
| 아이콘 | lucide-react | 트리쉐이커블 + Tailwind 친화 |
| HTTP | native fetch + 커스텀 wrapper | App Router fetch 통합. axios 불필요 |
| i18n | `src/i18n/ko.ts` 단순 객체 맵 | 1차 한국어. next-intl은 과함 |
| 라우팅 인증 | 클라 사이드 `AuthGuard` + `/auth/me` 검증 | localStorage 토큰 stale 처리. middleware는 토큰 접근 불가 |
| Server/Client 비율 | 랜딩만 RSC, `(authed)/` 전부 client | 채팅 앱은 90%+ 클라이언트. 정직하게 인정 |
| WebSocket 관리 | Zustand에 싱글톤 인스턴스 보관 | React 트리 밖에서도 접근 (api wrapper 401 retry 등) |
| 토큰 저장 | localStorage | OAuth fragment → JS만 접근 가능. CSP로 XSS 보완 |

---

## 1. 전체 폴더 구조

```
geek-chat-web-v2/
├── .env.local               # gitignored (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL)
├── .env.example             # 커밋, 키만
├── .gitignore               # next-app 기본 + .env.local
├── next.config.ts
├── tailwind.config.ts       # darkMode: 'class'
├── tsconfig.json            # strict: true, "@/*" → "./src/*"
├── postcss.config.mjs
├── package.json
├── README.md
├── HANDOFF/                 # 이 폴더 — 핸드오프 문서 (코드와 별개)
└── src/
    ├── app/
    │   ├── layout.tsx                   # html.dark, <Toaster/>, <AppBoot/>
    │   ├── globals.css                  # tailwind directives + base
    │   ├── page.tsx                     # 랜딩 = 가입 폼 + OAuth 버튼
    │   ├── (public)/
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx
    │   │   └── auth/
    │   │       ├── success/page.tsx     # OAuth LoggedIn 콜백
    │   │       ├── oauth-link/page.tsx  # LinkingRequired
    │   │       ├── oauth-complete/page.tsx # SignupRequired
    │   │       └── error/page.tsx       # ?error=<code> (4종, §7)
    │   └── (authed)/
    │       ├── layout.tsx               # AuthGuard + ChatConnection (Sidebar는 2.2)
    │       ├── rooms/
    │       │   ├── layout.tsx           # 데스크톱: 사이드바(RoomsPanel) + 본문
    │       │   ├── page.tsx             # 모바일: 방 목록, 데스크톱: "대화를 고르세요"
    │       │   ├── new/page.tsx         # 새 대화 (CreateRoomForm)
    │       │   └── [id]/page.tsx        # 채팅 화면 (ChatRoom, 방마다 key로 새로 마운트)
    │       ├── me/page.tsx              # 프로필 + 로그아웃 + 탈퇴
    │       └── invite/[code]/page.tsx   # 초대 링크 join 처리
    ├── components/
    │   ├── AppBoot.tsx                  # /auth/me 검증, auth:logout, online 재시도, 다른 탭의 로그아웃과 계정 전환 감지 (WS는 ChatConnection)
    │   ├── auth/
    │   │   ├── AuthGuard.tsx
    │   │   ├── SignupForm.tsx           # rhf+zod
    │   │   ├── LoginForm.tsx
    │   │   └── OAuthButtons.tsx
    │   ├── chat/
    │   │   ├── ChatConnection.tsx       # 연결 수명 + 알림 토스트 (2.1)
    │   │   ├── ChatRoom.tsx             # 조립: 첫 페이지, 타이핑 줄, 읽음 전송, 못 찾은 방
    │   │   ├── ChatHeader.tsx           # 방 이름, 연결 상태, 만료 배너 (room_expiring)
    │   │   ├── MessageList.tsx          # 이전 페이지(감시 요소 + 버튼), 스크롤 보정, readLabelFor
    │   │   ├── MessageItem.tsx          # 말풍선, 보내는 중, 실패와 다시 보내기
    │   │   └── MessageInput.tsx         # Enter 전송(IME 조합 중 제외), 자동 삭제 시간
    │   ├── room/
    │   │   ├── RoomList.tsx             # RoomList + RoomsPanel(제목줄)
    │   │   ├── RoomListItem.tsx         # roomTitle, formatActivity
    │   │   ├── CreateRoomForm.tsx       # 검색, 선택, DIRECT 또는 GROUP 생성
    │   │   └── InviteLinkModal.tsx      # (3.1)
    │   └── ui/
    │       ├── Button.tsx
    │       ├── Input.tsx
    │       ├── Modal.tsx
    │       ├── Avatar.tsx
    │       └── Spinner.tsx
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts                # apiFetch + 단일-플라이트 refresh
    │   │   ├── auth.ts
    │   │   ├── users.ts
    │   │   ├── rooms.ts
    │   │   └── invite.ts
    │   ├── ws/
    │   │   ├── client.ts                # ChatWSClient: 백오프, 1008 원인별 분기 (RULES.md R2)
    │   │   └── events.ts                # 서버/클라이언트 이벤트 zod 계약
    │   ├── chat/
    │   │   ├── connection.ts            # 싱글턴 수명, 이벤트 → 스토어, 낙관적 전송 (R2, R6)
    │   │   └── backfill.ts              # 첫 페이지, 이전 페이지, 연결 수락 뒤 forward cursor 보충
    │   ├── auth/
    │   │   ├── storage.ts               # localStorage
    │   │   ├── jwt.ts                   # decode payload (만료 사전 체크)
    │   │   └── oauthCallback.ts         # window.location.hash 파싱
    │   ├── env.ts                       # NEXT_PUBLIC_* 검증
    │   ├── time.ts
    │   └── uuid.ts                      # crypto.randomUUID() wrapper
    ├── store/
    │   ├── auth.ts                      # status, user (토큰은 lib/auth/storage만)
    │   ├── rooms.ts                     # rooms, currentRoomId, stale, reads(멤버별 읽음 지점)
    │   ├── messages.ts                  # byRoom: 서버 시각 순 + 대기 행은 끝
    │   └── ws.ts                        # client, status, expiringRooms
    ├── hooks/
    │   ├── useRooms.ts                  # SWR(키에 사용자 id) → rooms 스토어, stale이면 다시 받음
    │   ├── useUserSearch.ts             # 300ms debounce, 키에 사용자 id
    │   ├── useRoomMessages.ts           # 첫 페이지 + 이전 페이지 (lib/chat/backfill)
    │   ├── useMarkRead.ts               # mark_read: 500ms 뒤, 보이는 화면에서만 (R6)
    │   └── useTyping.ts                 # typing_start 2초 간격, 표시 3초
    ├── test/
    │   ├── fakeWebSocket.ts             # 테스트용 WebSocket 대역
    │   └── fakeChatClient.ts            # ChatWSClient 대역 (send, on, emit)
    └── i18n/
        ├── ko.ts                        # 메시지 객체 맵
        └── index.ts                     # t(key) 헬퍼
```

---

## 2. 데이터 흐름

### 2.1 API 호출 — SWR + 단일-플라이트 fetch wrapper

- 정적 데이터(방 목록, /auth/me, 유저 검색)는 SWR로 fetch + cache.
- WS 이벤트는 `store/rooms.ts`를 바로 갱신한다. 목록에 없는 방의 `new_message`가 오면 `stale`을 세워 목록 쪽이 다시 받게 한다 (서버에 방 추가 이벤트가 없다. SWR 연결은 2.2).
- zod 스키마는 `src/types/`가 아니라 `src/lib/api/<domain>.ts`에 둔다 (RULES.md R7). WS 이벤트 스키마는 `src/lib/ws/events.ts`.
- 모든 fetch는 `lib/api/client.ts`의 `apiFetch()`를 거침 (refresh 자동 처리).

### 2.2 WebSocket — Zustand 싱글톤

```
(authed)/layout.tsx → AuthGuard(authenticated) → ChatConnection mount
  → lib/chat/connection.ts acquireChat(): ChatWSClient 1개를 만들어 store/ws.ts에 두고 이벤트를 연결
    → ws://...?token= 으로 연결 (토큰은 시도마다 storage에서 읽음)
    → 서버가 받아들이면 (onopen 1초 뒤 거부 없음, 또는 error가 아닌 첫 프레임) status "open" → backfill
    → onmessage → 이벤트별 스토어 갱신
      - new_message → store/messages.ts 병합, store/rooms.ts lastMessageAt (모르는 방이면 stale)
      - message_ack, clientMessageId가 실린 error → 대기 행을 확정하거나 failed로
      - room_expiring → store/ws.ts expiringRooms, room_expired → 방과 메시지 제거
      - read_update → store/rooms.ts reads (앞으로만 감). typing_indicator는 방 화면의 useTyping이 직접 받고 저장하지 않음
    → onclose (처리 규칙 정본: .claude/RULES.md R2)
      - close() (로그아웃, 인증 화면을 벗어남) → 재연결 X
      - 1008 → 직전 거부 코드로 분기 (인증 코드는 refresh 1회, RATE_LIMITED는 refresh 없이 백오프, MAX_CONNECTIONS는 수동 재시도)
      - 그 외 → 백오프 (2s → 4s → 8s → ... cap 30s, jitter)
  unmount (로그아웃 등) → releaseChat(): 다음 태스크에 close + 채팅 스토어 비움
```

**Why Zustand 싱글톤**: WebSocket은 글로벌 자원. Provider 패턴은 (1) React 트리 밖에서 접근 불가, (2) 이벤트마다 Provider 리렌더, (3) App Router 네비 시 unmount 영향. Zustand에 1개만 두고 모두 구독.

### 2.3 토큰 갱신 — 단일-플라이트

```typescript
let refreshPromise: Promise<string> | null = null

async function getValidAccessToken(): Promise<string> {
  const current = storage.getAccessToken()
  if (current && !isExpiringSoon(current)) return current
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}
```

여러 컴포넌트가 동시에 401을 받아도 refresh는 1번만. 다른 호출은 같은 promise를 await.

### 2.4 OAuth 콜백 hash 파싱

```typescript
// lib/auth/oauthCallback.ts
export function parseHash(): Record<string, string> {
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
  return Object.fromEntries(new URLSearchParams(hash).entries())
}
export function clearHash() {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
```

`/auth/success/page.tsx`:
```tsx
'use client'
export default function Page() {
  const router = useRouter()
  useEffect(() => {
    const { access_token, refresh_token } = parseHash()
    if (!access_token || !refresh_token) { router.replace('/auth/error'); return }
    storage.set(access_token, refresh_token)
    clearHash()
    useAuthStore.getState().hydrate()
    router.replace('/rooms')
  }, [])
  return <Spinner />
}
```

---

## 3. 페이지 라우트 표

| 경로 | Auth | 컴포넌트 타입 | 역할 |
|---|---|---|---|
| `/` | No | RSC + client form | 랜딩. 가입 폼 + 소셜 버튼 단일 화면 |
| `/login` | No | Client | 로그인 |
| `/signup` | No | Client | `/`와 동일 폼 직접 접근 |
| `/auth/success` | No | Client | OAuth LoggedIn (hash → token) |
| `/auth/oauth-link` | No | Client | LinkingRequired (link_token 보유) |
| `/auth/oauth-complete` | No | Client | SignupRequired (닉네임 입력) |
| `/auth/error` | No | Client | OAuth 실패 표시 |
| `/rooms` | Yes | Client | 방 목록 (SWR + WS 갱신) |
| `/rooms/new` | Yes | Client | 유저 검색 + DIRECT/GROUP 생성 |
| `/rooms/[id]` | Yes | Client | 채팅 화면 |
| `/me` | Yes | Client | 프로필 + 로그아웃 + 탈퇴 |
| `/invite/[code]` | Yes | Client | mount 시 join → `/rooms/[id]` redirect |

---

## 4. 환경 변수

| 변수 | 예시 (dev) | 예시 (prod) | 용도 |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | `https://api.<domain>` | REST base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8080/ws` | `wss://api.<domain>/ws` | WS endpoint (token은 코드에서 query 부착) |

`.env.example` (커밋용):
```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

`lib/env.ts`에서 부트 시 검증 (없으면 throw). Vercel은 프로젝트 설정 → Environment Variables.

---

## 5. CORS / 배포

- **REST CORS**: 백엔드 `SecurityConfig.corsConfigurationSource`가 `FRONTEND_URL`과 `frontendOriginPatterns`를 함께 허용한다. docker-compose는 `https://*.vercel.app`을 기본으로 넣어서 preview deploy도 REST는 통과한다. Render는 다르다. `render.yaml`에 패턴 키가 없고 기본값이 빈 목록이라(`AppProperties.frontendOriginPatterns`), 대시보드에서 `APP_FRONTEND_ORIGIN_PATTERNS`를 따로 넣지 않으면 REST도 `FRONTEND_URL` 하나만 허용한다.
- **WS는 다르다**: 핸드셰이크 Origin은 `FRONTEND_URL` 하나만 허용한다 (`WebSocketConfig`의 `setAllowedOrigins(appProperties.frontendUrl)`). preview deploy에서는 WS가 열리지 않는다.
- **OAuth 리다이렉트**도 `FRONTEND_URL` 하나로 간다 (`AuthController.kt:100-126`). 그래서 프론트를 v1 Expo에서 web-v2로 바꿀 때 백엔드 `FRONTEND_URL`도 같이 바꿔야 하고, 서버를 고치지 않는 한 두 프론트가 동시에 OAuth와 WS를 쓸 수 없다.
- **백엔드 배포 대상**: Render 무료(Docker) + Supabase Postgres (server-v2 `docs/MIGRATION.md` Phase 8). 서비스 URL은 아직 없다. Render 무료는 15분 동안 요청이 없으면 잠들어서 첫 요청이 느리다.
- Vercel 빌드 자동 (`next build`). Output `.next` 자동.
- main push → 자동 prod 배포. PR 브랜치 → preview 배포.
- **Vercel 프로젝트 (2026-10-25)**: `jungsehuis-projects/web` 프로젝트의 Git 연결을 v1 `geek-chat/web`에서 `geek-chat/web-v2`로 바꿨다(사용자 결정). 도메인은 `web-lac-one-89.vercel.app` 그대로이고, Framework Preset은 Next.js, v1(Expo)의 빌드와 출력 경로 덮어쓰기는 껐다. 처음에는 백엔드가 없어서 Production env에 자리표시 값(`api.invalid`)을 넣었다. server-v2가 Render(`https://geek-chat-server-api.onrender.com`)에 올라간 뒤 2026-10-25에 `NEXT_PUBLIC_API_URL=https://geek-chat-server-api.onrender.com`, `NEXT_PUBLIC_WS_URL=wss://geek-chat-server-api.onrender.com/ws`로 바꾸고 다시 배포했다. `NEXT_PUBLIC_*`는 빌드 때 코드에 박히므로 값을 바꾸면 Redeploy가 필요하다. Vercel은 env 값을 편집하기 전에 이메일 인증 코드를 요구한다. 백엔드 `FRONTEND_URL`은 `https://web-lac-one-89.vercel.app`이고, Render는 REST CORS와 WS Origin 모두 이 도메인만 받는다. v1로 되돌릴 때는 이전 운영 배포로 Instant Rollback하면 된다 (Production Deployments 보존 기간 30일).

---

## 6. 보안 (CSP)

CSP는 `src/proxy.ts`가 요청마다 만들어 응답과 전달 요청에 같이 싣는다. 정책 조립은 `src/lib/csp.ts`이고 규칙 정본은 `.claude/RULES.md` R5다.

```
default-src 'self'
script-src 'self' 'nonce-<요청마다 새 값>' 'strict-dynamic'   (개발 모드에만 'unsafe-eval' 추가)
style-src 'self' 'unsafe-inline'
font-src 'self' data:
connect-src 'self' <NEXT_PUBLIC_API_URL> <NEXT_PUBLIC_WS_URL>
img-src 'self' data: https:
frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

- App Router 페이지에는 Next가 넣는 인라인 부트스트랩 스크립트가 있다. 그래서 `script-src 'self'`만 두면 hydration이 막힌다. 2026-10-25 운영 배포에서 처음 확인했고, Phase 1.1부터 있던 문제다.
- Next는 렌더링할 때 요청의 CSP 헤더에서 nonce를 읽어 자기 스크립트에 모두 붙인다. 그래서 모든 페이지가 요청 시점에 렌더링돼야 하고, 루트 레이아웃이 `await connection()`을 한다. 빌드 출력에서 모든 경로가 `ƒ`(동적)로 나온다.
- `style-src`에는 nonce를 넣지 않는다. nonce가 있으면 브라우저가 `'unsafe-inline'`을 무시해서 React의 `style` 속성이 막힌다.
- `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`는 그대로 `next.config.ts`의 `headers()`에 있다.
- 사용자 입력은 React가 자동 escape한다. `dangerouslySetInnerHTML`은 금지한다. localStorage 토큰의 XSS 위험을 CSP가 보완한다.

---

## 7. 백엔드 컨트랙트 빠른 참조

REST 기본: `Authorization: Bearer <accessToken>`. 자세한 카탈로그는 `API_INTEGRATION.md` 참조.

WebSocket: `?token=<accessToken>` query. envelope `{type, data}`. 자세한 이벤트는 `API_INTEGRATION.md` §5.

OAuth 콜백 4종 (필수 구현):
- `/auth/success#access_token=...&refresh_token=...`
- `/auth/oauth-link#link_token=...&existing_nickname=...&new_provider=...`
- `/auth/oauth-complete#signup_token=...&suggested_nickname=...`
- `/auth/error?error=<code>` (query string, hash 아님). code는 `oauth_cancelled`, `missing_params`, `invalid_state`, `oauth_failed` 네 가지다 (`AuthController.kt:100-112`)

---

## 8. WebSocket 동시 연결 제한

- 백엔드: user당 max **3** 연결.
- 4개째 탭은 1008 + MAX_CONNECTIONS → 재연결하지 않고 토스트로 안내 (RULES.md R2).
- 재연결 rate limit: 2초 간격.

---

## 9. 다음 세션 첫 명령

> 아래는 부트스트랩 전 기준의 기록이다. 부트스트랩은 2026-05-08에 끝났으니 다시 실행하지 않는다. 지금 진입점은 `SESSION_PROGRESS.md`다.

```bash
cd ~/Work/geek-chat
# HANDOFF 폴더 보존 (이미 비어있는 폴더이므로 그대로 두고 위에 create-next-app)
mkdir -p /tmp/geekchat-handoff && cp -r geek-chat-web-v2/HANDOFF /tmp/geekchat-handoff/

# 빈 폴더에 Next.js 생성
rmdir geek-chat-web-v2 2>/dev/null || true
npx create-next-app@latest geek-chat-web-v2 \
  --typescript --tailwind --app --eslint \
  --src-dir --import-alias "@/*"

# HANDOFF 복원
mv /tmp/geekchat-handoff/HANDOFF geek-chat-web-v2/

cd geek-chat-web-v2
npm install zustand swr react-hook-form zod @hookform/resolvers sonner lucide-react
```

(또는 `pnpm` 사용 시 `--use-pnpm` 추가, 위 install 커맨드는 `pnpm add`로 변경.)
