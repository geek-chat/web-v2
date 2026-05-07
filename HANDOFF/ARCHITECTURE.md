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
    │   │       └── error/page.tsx       # ?error=oauth_failed
    │   └── (authed)/
    │       ├── layout.tsx               # AuthGuard + WS boot + Sidebar
    │       ├── rooms/
    │       │   ├── page.tsx             # 방 목록
    │       │   ├── new/page.tsx         # 새 방 만들기
    │       │   └── [id]/page.tsx        # 채팅 화면
    │       ├── me/page.tsx              # 프로필 + 로그아웃 + 탈퇴
    │       └── invite/[code]/page.tsx   # 초대 링크 join 처리
    ├── components/
    │   ├── AppBoot.tsx                  # /auth/me hydrate + WS connect
    │   ├── auth/
    │   │   ├── AuthGuard.tsx
    │   │   ├── SignupForm.tsx           # rhf+zod
    │   │   ├── LoginForm.tsx
    │   │   └── OAuthButtons.tsx
    │   ├── chat/
    │   │   ├── ChatRoom.tsx             # MessageList + MessageInput + Header
    │   │   ├── ChatHeader.tsx
    │   │   ├── MessageList.tsx
    │   │   ├── MessageItem.tsx
    │   │   ├── MessageInput.tsx         # send_message + UUID 발급
    │   │   ├── TypingIndicator.tsx
    │   │   ├── ReadReceipt.tsx
    │   │   └── ExpiringRoomBanner.tsx
    │   ├── room/
    │   │   ├── RoomList.tsx
    │   │   ├── RoomListItem.tsx
    │   │   ├── CreateRoomModal.tsx
    │   │   └── InviteLinkModal.tsx
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
    │   │   ├── client.ts                # ChatWSClient class
    │   │   ├── envelope.ts              # 타입 가드
    │   │   └── reconnect.ts             # 백오프 + 1008 refresh
    │   ├── auth/
    │   │   ├── storage.ts               # localStorage
    │   │   ├── jwt.ts                   # decode payload (만료 사전 체크)
    │   │   └── oauthCallback.ts         # window.location.hash 파싱
    │   ├── env.ts                       # NEXT_PUBLIC_* 검증
    │   ├── time.ts
    │   └── uuid.ts                      # crypto.randomUUID() wrapper
    ├── store/
    │   ├── auth.ts                      # user, accessToken, refreshToken, status
    │   ├── rooms.ts                     # rooms[], currentRoomId
    │   ├── messages.ts                  # byRoom: roomId → Message[]
    │   └── ws.ts                        # client 인스턴스 + status
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useRooms.ts
    │   ├── useMessages.ts
    │   ├── useWebSocket.ts
    │   └── useUserSearch.ts
    ├── types/
    │   ├── api.ts                       # 백엔드 DTO + zod 스키마
    │   ├── ws.ts                        # WS envelope union
    │   └── domain.ts                    # User, Room, Message
    └── i18n/
        ├── ko.ts                        # 메시지 객체 맵
        └── index.ts                     # t(key) 헬퍼
```

---

## 2. 데이터 흐름

### 2.1 API 호출 — SWR + 단일-플라이트 fetch wrapper

- 정적 데이터(방 목록, /auth/me, 유저 검색)는 SWR로 fetch + cache.
- WS 이벤트 수신 시 `mutate('/api/rooms', ...)`로 부분 갱신.
- 모든 fetch는 `lib/api/client.ts`의 `apiFetch()`를 거침 (refresh 자동 처리).

### 2.2 WebSocket — Zustand 싱글톤

```
(authed)/layout.tsx mount
  → useWebSocket() 훅 호출
    → store/ws.ts의 connect() — ChatWSClient 인스턴스 생성
      → ws://...?token= 으로 연결
      → onmessage → 이벤트 type별로 해당 store 업데이트
        - new_message → store/messages.ts append
        - room_expiring → store/ws.ts.expiringRooms 추가
      → onclose
        - code 1000 (정상) + intentionalClose → 재연결 X
        - code 1008 (POLICY_VIOLATION) → /auth/refresh → 재연결
        - 그 외 → 백오프 (1s → 2s → 4s → ... cap 30s)
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

- 백엔드 `SecurityConfig.kt`의 `allowedOriginPatterns`에 `https://*.vercel.app` 이미 포함됨 → 모든 Vercel preview deploy 자동 허용.
- 커스텀 도메인 추가 시 백엔드 `.env.docker`의 `FRONTEND_URL` 갱신 필요.
- Vercel 빌드 자동 (`next build`). Output `.next` 자동.
- main push → 자동 prod 배포. PR 브랜치 → preview 배포.

---

## 6. 보안 (CSP)

`next.config.ts`에 strict CSP:
```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL} ${process.env.NEXT_PUBLIC_WS_URL}`,
            "img-src 'self' data: https:",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
  ]
}
```

- 인라인 스크립트 금지
- eval 금지
- 사용자 입력은 React가 자동 escape — `dangerouslySetInnerHTML` 절대 금지
- localStorage XSS 위험 보완

---

## 7. 백엔드 컨트랙트 빠른 참조

REST 기본: `Authorization: Bearer <accessToken>`. 자세한 카탈로그는 `API_INTEGRATION.md` 참조.

WebSocket: `?token=<accessToken>` query. envelope `{type, data}`. 자세한 이벤트는 `API_INTEGRATION.md` §5.

OAuth 콜백 4종 (필수 구현):
- `/auth/success#access_token=...&refresh_token=...`
- `/auth/oauth-link#link_token=...&existing_nickname=...&new_provider=...`
- `/auth/oauth-complete#signup_token=...&suggested_nickname=...`
- `/auth/error?error=oauth_failed` (query string, hash 아님)

---

## 8. WebSocket 동시 연결 제한

- 백엔드: user당 max **3** 연결.
- 4개째 탭은 1008/MAX_CONNECTIONS → 토스트로 안내.
- 재연결 rate limit: 2초 간격.

---

## 9. 다음 세션 첫 명령

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
