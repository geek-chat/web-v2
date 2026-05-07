# Components — 핵심 컴포넌트 명세

GeekChat v2 프론트엔드 컴포넌트 트리 + props + 책임.

작성일: 2026-05-08
참조: `ARCHITECTURE.md` §1 폴더 구조 + `API_INTEGRATION.md` 백엔드 컨트랙트

---

## 0. 컴포넌트 트리 전체

```
RootLayout (<html class="dark">, server)
├── <Toaster /> (sonner)
└── AppBoot (client)                  # /auth/me 검증 + WS connect 부트스트랩
    │
    ├── (public)/
    │   ├── page.tsx → LandingHero + SignupForm + OAuthButtons
    │   ├── login/page → LoginForm + OAuthButtons
    │   ├── signup/page → SignupForm + OAuthButtons
    │   └── auth/
    │       ├── success/page → SuccessHandler (parseHash → store.set → /rooms)
    │       ├── oauth-link/page → LinkConfirmCard
    │       ├── oauth-complete/page → SignupCompleteForm
    │       └── error/page → ErrorMessage
    │
    └── (authed)/layout (AuthGuard + WebSocket connect + Sidebar)
        ├── <Sidebar>
        │   └── RoomList → RoomListItem (multiple)
        ├── <main>{children}</main>
        │
        ├── rooms/page → RoomListMain (full-page version)
        ├── rooms/[id]/page → ChatRoom
        │   └── ChatRoom
        │       ├── ChatHeader
        │       │   ├── Avatar
        │       │   ├── RoomTitle
        │       │   └── ExpiringRoomBanner (만료 임박 시)
        │       ├── MessageList
        │       │   ├── MessageItem (multiple, sender/mine/system 분기)
        │       │   ├── ReadReceipt
        │       │   └── TypingIndicator
        │       └── MessageInput
        │           ├── TextArea (auto-resize)
        │           ├── TtlSelect (자동삭제 시간 선택)
        │           └── SendButton
        ├── rooms/new/page → CreateRoomForm (UserSearch + GroupOptions)
        ├── me/page → ProfileForm + WithdrawConfirm
        └── invite/[code]/page → InviteJoinHandler (mount 시 자동 join)
```

---

## 1. 핵심 컴포넌트 명세

### 1.1 AppBoot (`src/components/AppBoot.tsx`)

```typescript
type Props = { children: React.ReactNode }

// 동작:
// 1. localStorage에서 토큰 확인
// 2. 있으면 GET /auth/me 호출 → store.auth.user 설정
// 3. 토큰 만료 / 401 → store.logout()
// 4. 인증 상태 확정 후 children 렌더
```

**Why**: SSR에서는 localStorage 접근 불가. mount 후 client에서 hydrate.

### 1.2 AuthGuard (`src/components/auth/AuthGuard.tsx`)

```typescript
type Props = { children: React.ReactNode }

// 동작:
// 1. store.auth.status === 'loading' → <Spinner />
// 2. status === 'guest' → router.replace('/')
// 3. status === 'authed' → children
```

`(authed)/layout.tsx`에서 사용. `(public)/`에는 사용 안 함.

### 1.3 SignupForm (`src/components/auth/SignupForm.tsx`)

```typescript
type Props = {} // 자체 완결

// 폼:
// - username (required, 3-20자, lowercase + digit + _)
// - password (required, 8자 이상 + 영문/숫자)
// - nickname (required, 1-20자)
// - email (optional)

// rhf + zod 검증:
const schema = z.object({
  username: z.string().regex(/^[a-z0-9_]{3,20}$/),
  password: z.string().min(8).regex(/(?=.*[a-zA-Z])(?=.*\d)/),
  nickname: z.string().min(1).max(20),
  email: z.string().email().optional().or(z.literal('')),
})

// 제출 → POST /auth/signup → 토큰 저장 → /rooms redirect
// 에러 매핑:
//   409 + UsernameTaken → setError('username', ...)
//   409 + EmailAlreadyInUse → setError('email', ...)
//   400 + WeakPassword → setError('password', ...)
```

### 1.4 LoginForm (`src/components/auth/LoginForm.tsx`)

```typescript
type Props = {}

// 폼: username + password
// 제출 → POST /auth/login
// 401 InvalidCredentials → 폼 상단 배너 (어떤 필드인지 노출 X)
// 403 AccountWithdrawn → 폼 상단 배너 + "탈퇴된 계정입니다"
```

### 1.5 OAuthButtons (`src/components/auth/OAuthButtons.tsx`)

```typescript
type Props = {} // 자체 완결

// 두 버튼:
// [G Google] → window.location = `${API_URL}/auth/google`
// [N Naver] → window.location = `${API_URL}/auth/naver`
// (302 redirect to provider)
```

### 1.6 ChatRoom (`src/components/chat/ChatRoom.tsx`)

```typescript
type Props = { roomId: string }

// 자식:
// - ChatHeader (room 정보)
// - MessageList (messages)
// - MessageInput (send)

// store 구독:
// - store.rooms.byId[roomId] → 방 정보
// - store.messages.byRoom[roomId] → 메시지 배열
// - store.ws.expiringRooms.has(roomId) → 만료 배너
```

### 1.7 MessageList (`src/components/chat/MessageList.tsx`)

```typescript
type Props = { roomId: string }

// 동작:
// 1. mount 시: GET /api/rooms/:id/messages?direction=backward (첫 50개)
// 2. 스크롤 위로 → cursor 기반 추가 로드 (직전 메시지의 createdAt)
// 3. WS new_message 수신 → 배열에 append + 스크롤 자동 하단
// 4. 메시지마다 MessageItem 렌더 (sender / mine / system 분기)
// 5. 마지막 본 메시지에 mark_read send (debounced 500ms)
```

**최적화** (선택): 메시지 100개 이상이면 가상 스크롤 (react-virtual). 초기는 단순 렌더 OK.

### 1.8 MessageItem (`src/components/chat/MessageItem.tsx`)

```typescript
type Props = {
  message: Message
  isMine: boolean
  showAvatar: boolean      // 같은 발신자 연속 시 false
  showTime: boolean         // 같은 분 안의 마지막만 true
}

// 분기:
// - type === 'SYSTEM' → 중앙 정렬 회색 텍스트
// - isMine → 오른쪽 정렬 + 액센트 색
// - else → 왼쪽 + Avatar
// - status === 'pending' → 회색 + 시계 아이콘
// - status === 'failed' → 빨강 + 재시도 버튼
// - expiresAt 있음 → "🔥 30s 후 사라짐" 표시
```

### 1.9 MessageInput (`src/components/chat/MessageInput.tsx`)

```typescript
type Props = { roomId: string }

// 상태:
// - text (string)
// - ttlSeconds (0 / 30 / 300 / 3600 / 86400)
// - composing (IME 한글 조합)

// 동작:
// 1. textarea 입력 → typing_start 발송 (debounced 1초)
// 2. Enter (Shift 없이) → send_message
// 3. clientMessageId = crypto.randomUUID()
// 4. store.messages.append(roomId, { ..., status: 'pending', clientMessageId })
// 5. ws.send('send_message', { roomId, content, clientMessageId, ttlSeconds })
// 6. message_ack 수신 시 store.messages.replaceClientMessage(clientMessageId, serverId)
```

### 1.10 RoomList / RoomListItem

```typescript
// RoomList
type Props = {} // 자체 완결

// 동작:
// 1. SWR으로 GET /api/rooms
// 2. lastMessageAt DESC 정렬
// 3. 각 방마다 RoomListItem 렌더
// 4. WS new_message 수신 시 mutate('/api/rooms') 또는 store 직접 업데이트

// RoomListItem
type Props = {
  room: Room
  onClick: () => void
  isActive: boolean
}

// 표시:
// - DIRECT: 상대방 nickname + Avatar
// - GROUP: name + 멤버 수
// - 마지막 메시지 시간 + 미리보기 (있으면)
// - 만료 임박: 🔥 아이콘
```

### 1.11 CreateRoomModal (`src/components/room/CreateRoomModal.tsx`)

```typescript
type Props = {
  isOpen: boolean
  onClose: () => void
  onCreated: (room: Room) => void
}

// 폼:
// - 멤버 검색/추가 (UserSearch 컴포넌트)
// - 방 이름 (멤버 ≥ 2명 또는 GROUP일 때만)
// - ttlHours select (null/24/168/720)

// 제출 → POST /api/rooms → onCreated 콜백
```

### 1.12 InviteLinkModal

```typescript
type Props = {
  roomId: string
  isOpen: boolean
  onClose: () => void
}

// 폼:
// - ttlHours select (default 24)
// - maxUses input (optional)

// 제출 → POST /api/rooms/:roomId/invite-link
// 응답 받으면 코드 + URL 표시 + 복사 버튼
//   URL = `${window.location.origin}/invite/${code}`
```

### 1.13 ProfileForm + WithdrawConfirm (`/me`)

```typescript
// ProfileForm
// - 닉네임 표시 (변경 X — 도메인에서 username만 변경 가능)
// - username 변경 폼 (PATCH /api/users/me/username)
// - 로그아웃 버튼

// WithdrawConfirm
// - "DELETE MY ACCOUNT" 입력 받기
// - 입력 일치 시에만 탈퇴 버튼 활성화
// - POST /auth/withdraw → store.logout() → / redirect
```

---

## 2. 핵심 hooks

### 2.1 useAuth

```typescript
function useAuth() {
  return {
    user: useAuthStore(s => s.user),
    status: useAuthStore(s => s.status),
    login: useAuthStore(s => s.login),
    logout: useAuthStore(s => s.logout),
  }
}
```

### 2.2 useRooms

```typescript
function useRooms() {
  const { data, error, mutate } = useSWR('/api/rooms', () => api.rooms.list())
  return { rooms: data ?? [], error, refresh: mutate }
}
```

### 2.3 useMessages

```typescript
function useMessages(roomId: string) {
  const messages = useMessageStore(s => s.byRoom[roomId] ?? [])
  // 첫 페이지는 SWR
  const { data, error } = useSWR(
    roomId ? `/api/rooms/${roomId}/messages` : null,
    () => api.rooms.messages(roomId, { limit: 50 })
  )
  // 첫 로드 시 store에 시드
  useEffect(() => { if (data) store.messages.setInitial(roomId, data) }, [data, roomId])
  return { messages, error }
}
```

### 2.4 useWebSocket

```typescript
function useWebSocket() {
  const status = useWsStore(s => s.status)
  const connect = useWsStore(s => s.connect)
  const disconnect = useWsStore(s => s.disconnect)
  const accessToken = useAuthStore(s => s.accessToken)

  useEffect(() => {
    if (accessToken && status === 'idle') connect(accessToken)
    return () => disconnect()
  }, [accessToken])

  return status
}
```

`(authed)/layout.tsx`에서 1회 호출.

### 2.5 useUserSearch

```typescript
function useUserSearch(query: string) {
  const debounced = useDebounce(query, 300)
  const { data } = useSWR(
    debounced ? `/api/users/search?q=${debounced}` : null,
    () => api.users.search(debounced)
  )
  return data ?? []
}
```

---

## 3. UI 컴포넌트 (재사용)

### Button
```typescript
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>
```

### Input
```typescript
type InputProps = {
  label?: string
  error?: string
  hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>
```

### Modal
```typescript
type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}
// Portal + ESC + backdrop click 종료
```

### Avatar
```typescript
type AvatarProps = {
  src?: string | null
  nickname: string  // initial 표시용
  size?: 'sm' | 'md' | 'lg'
}
// src 없으면 nickname 첫 글자 + 색상 (deterministic by nickname hash)
```

### Spinner
```typescript
type SpinnerProps = { size?: 'sm' | 'md' | 'lg' }
// 회전 애니메이션 lucide-react Loader2 사용
```

---

## 4. 컴포넌트 작성 우선순위 (Phase 1 시작)

Phase 1 (인증)에서 필요한 컴포넌트:
1. ui/Button, Input, Spinner (1시간)
2. AppBoot, AuthGuard (1시간)
3. SignupForm, LoginForm, OAuthButtons (2-3시간)
4. SuccessHandler, LinkConfirmCard, SignupCompleteForm, ErrorMessage (2-3시간)
5. ProfileForm, WithdrawConfirm (1-2시간)

Phase 2 (채팅) 컴포넌트는 `DEVELOPMENT_PLAN.md` Phase 2 참조.
