# Development Plan — Phase 1/2/3 작업 분할

GeekChat v2 프론트엔드 개발 순서. 새 세션이 첫 commit부터 배포까지 따라갈 수 있도록.

작성일: 2026-05-08
참조: `ARCHITECTURE.md`, `COMPONENTS.md`, `AUTH_UX.md`, `API_INTEGRATION.md`

---

## 전체 개요

| Phase | 목표 | 예상 세션 수 | 결과물 |
|---|---|---|---|
| **Phase 1** | 인증 + 회원탈퇴 + 다크모드 골격 | 1-2 | 가입/로그인/OAuth/me 페이지 동작 |
| **Phase 2** | 채팅 핵심 (1:1, WS, 메시지) | 2-3 | 1:1 채팅 + 실시간 + 읽음 표시 |
| **Phase 3** | 그룹 + 초대 + 임시 방 + 자동삭제 | 1-2 | 모든 백엔드 기능 활용 |

총 4-7 세션 예상.

---

## Phase 1 — 인증 (1-2 sessions)

### Session 1.1 — 셋업 + 인증 폼

**작업**:

1. **프로젝트 생성** (15분)
   ```bash
   cd ~/Work/geek-chat
   # HANDOFF 폴더 임시 백업
   mv geek-chat-web-v2/HANDOFF /tmp/
   rmdir geek-chat-web-v2

   npx create-next-app@latest geek-chat-web-v2 \
     --typescript --tailwind --app --eslint \
     --src-dir --import-alias "@/*"

   mv /tmp/HANDOFF geek-chat-web-v2/

   cd geek-chat-web-v2
   npm install zustand swr react-hook-form zod @hookform/resolvers sonner lucide-react
   ```

2. **환경 + 기본 설정** (15분)
   - `.env.local`, `.env.example` 작성
   - `tailwind.config.ts` `darkMode: 'class'`
   - `src/app/layout.tsx`에 `<html lang="ko" className="dark">` + `<Toaster />`
   - `src/app/globals.css`에 다크모드 변수
   - `src/lib/env.ts` (검증 + export)
   - CSP 헤더 (ARCHITECTURE.md §6). 2026-10-25부터 `next.config.ts`가 아니라 `src/proxy.ts`가 요청마다 nonce를 넣어 만든다

3. **Storage + API client** (45분)
   - `src/lib/auth/storage.ts` (localStorage get/set/clear)
   - `src/lib/auth/jwt.ts` (decode + isExpiringSoon)
   - `src/lib/auth/oauthCallback.ts` (parseHash + clearHash)
   - `src/lib/uuid.ts` (crypto.randomUUID wrapper)
   - `src/lib/api/client.ts` (apiFetch + 단일-플라이트 refresh, API_INTEGRATION.md §4)
   - `src/lib/api/auth.ts` (signup/login/refresh/logout/me/withdraw + complete-signup + link-provider)

4. **Zustand store + Boot** (30분)
   - `src/store/auth.ts` (slice: user, accessToken, refreshToken, status, login, logout, hydrate)
   - `src/components/AppBoot.tsx` (mount 시 hydrate 호출, /auth/me 검증)
   - `src/app/layout.tsx`에 `<AppBoot />` 추가

5. **UI 컴포넌트 기초** (1시간)
   - `src/components/ui/Button.tsx`
   - `src/components/ui/Input.tsx`
   - `src/components/ui/Spinner.tsx`

6. **인증 폼** (2시간)
   - `src/components/auth/OAuthButtons.tsx`
   - `src/components/auth/SignupForm.tsx` (rhf + zod)
   - `src/components/auth/LoginForm.tsx`
   - `src/app/page.tsx` (랜딩 = SignupForm + OAuthButtons + hero)
   - `src/app/(public)/login/page.tsx` (LoginForm + OAuthButtons)
   - `src/app/(public)/signup/page.tsx` (랜딩과 동일 폼)

**검증**:
```bash
npm run dev
# 1. localhost:3000 → 랜딩 화면 표시
# 2. /login → 로그인 화면
# 3. 백엔드 띄우고 (./gradlew bootRun --args='--spring.profiles.active=dev')
# 4. /auth/dev-login?name=Alice 직접 호출해 토큰 받기 → localStorage에 수동 저장
# 5. /auth/me 호출 정상
```

### Session 1.2 — OAuth 콜백 + AuthGuard + /me

**작업**:

7. **OAuth 콜백 페이지 4개** (1.5시간)
   - `src/app/(public)/auth/success/page.tsx` (parseHash → store.set → /rooms)
   - `src/app/(public)/auth/oauth-link/page.tsx` (link_token + UI + POST /auth/link-provider)
   - `src/app/(public)/auth/oauth-complete/page.tsx` (signup_token + 닉네임 입력)
   - `src/app/(public)/auth/error/page.tsx` (?error=oauth_failed)
   - **모두 `'use client'`. mount 시 즉시 `clearHash()`.**

8. **AuthGuard + (authed) layout** (30분)
   - `src/components/auth/AuthGuard.tsx`
   - `src/app/(authed)/layout.tsx` (AuthGuard + Sidebar 자리만)

9. **/me 페이지** (1시간)
   - `src/app/(authed)/me/page.tsx`
   - 닉네임/유저네임/이메일 표시
   - username 변경 폼 (PATCH /api/users/me/username)
   - 로그아웃 버튼
   - 탈퇴 (이중 확인: "DELETE MY ACCOUNT")

10. **i18n 기초** (30분)
    - `src/i18n/ko.ts` (모든 텍스트 키-밸류)
    - `src/i18n/index.ts` (`t(key)` 헬퍼)
    - 폼/에러 메시지 한국어로 전환

**검증**:
- 일반 가입 → 로그인 → /me → 탈퇴 → 재로그인 시 `AccountWithdrawn` 403
- Google OAuth → 콜백 → /auth/oauth-complete (신규) 또는 /auth/success (기존)
- 토큰 만료 시뮬레이션: 5분 timeout 짧게 → 자동 refresh 확인

**Phase 1 완료 조건**:
- [ ] 가입/로그인/OAuth 4 콜백/탈퇴 모든 시나리오 동작
- [ ] 다크모드 + 한국어
- [ ] 401 자동 refresh
- [ ] CSP 헤더 적용

---

## Phase 2 — 채팅 핵심 (2-3 sessions)

### Session 2.1 — 타입 + WS 클라이언트

**상태 (2026-10-25)**: 완료 (`76bc9eb`부터 `7f464ee`까지). 아래 계획과 달라진 점:
- `src/types/`는 만들지 않았다. zod 스키마는 RULES.md R7대로 `src/lib/api/rooms.ts`(REST)와 `src/lib/ws/events.ts`(WS)에 있다.
- `envelope.ts`와 `reconnect.ts` 대신 `events.ts` 하나를 두고, 백오프는 `client.ts` 안에 넣었다.
- `useWebSocket` 훅 대신 `ChatConnection` 컴포넌트와 `src/lib/chat/connection.ts`를 썼다. Strict Mode에서도 소켓이 하나로 유지되고, React 밖에서 테스트할 수 있다.
- 2.3의 낙관적 전송 로직(`sendChatMessage`, `retryChatMessage`, 5초 타임아웃)을 앞당겨 넣었다. 2.3에는 UI만 남는다.
- `upsertRoom`은 방 생성과 함께 2.2에서 넣는다.

**작업**:

1. **타입 정의** (45분)
   - `src/types/api.ts` — 백엔드 DTO + zod 스키마 (User, Room, Message, TokenPair 등)
   - `src/types/ws.ts` — WS envelope union (NewMessageEvent | MessageAckEvent | TypingIndicatorEvent | ...)
   - `src/types/domain.ts` — 도메인 타입 + helpers

2. **WebSocket 클라이언트** (2시간)
   - `src/lib/ws/envelope.ts` — 타입 가드 (isNewMessage(data) 등)
   - `src/lib/ws/reconnect.ts`: 백오프 (2s → 4s → ... cap 30s, jitter). 서버가 2초 안의 재연결을 거부한다
   - `src/lib/ws/client.ts`: ChatWSClient 클래스 (API_INTEGRATION.md §5)
     - `connect()`, `send(type, data)`, `on(type, handler)`, `close()`
     - 1008 처리: close 직전 `error.code`로 분기 (정본: `.claude/RULES.md` R2)
     - close code 1011/그 외: 백오프 재연결

3. **Store: rooms / messages / ws** (1시간)
   - `src/store/rooms.ts` (rooms[], currentRoomId, upsertRoom, removeRoom)
   - `src/store/messages.ts` (byRoom: Record<roomId, Message[]>, append/prepend, replaceClientMessage)
   - `src/store/ws.ts` (client 인스턴스 + status + expiringRooms Set)

4. **WebSocket 부트스트랩** (1시간)
   - `src/hooks/useWebSocket.ts`
   - `src/app/(authed)/layout.tsx`에 useWebSocket() 호출
   - 이벤트 핸들러: new_message → store.messages.append, room_expiring → store.ws.expiringRooms.add 등

### Session 2.2 — 방 목록 + 1:1 채팅 화면

**상태 (2026-10-25)**: 완료 (`9b613bb`). 계획과 달라진 점:
- 방 만들기는 모달이 아니라 `/rooms/new` 페이지(`CreateRoomForm`)다. 사이드바는 `(authed)` 전체가 아니라 `(authed)/rooms/layout.tsx`에 두었다(`/me`에는 목록이 없음).
- `useMessages`와 `useAuth`는 만들지 않았다. 첫 페이지는 2.1의 `loadRoomMessages()`가 맡고, 사용자는 `useAuthStore` 셀렉터로 읽는다.
- `Avatar`는 이니셜만 그린다. 프로필 이미지는 OAuth 이미지 호스트를 next/image 설정에 넣을 때 붙인다.
- `/rooms/[id]`는 2.3 전까지 쓸 임시 화면이다.

**작업**:

5. **API 클라이언트 확장** (30분)
   - `src/lib/api/users.ts` (search, updateUsername)
   - `src/lib/api/rooms.ts` (list, create, messages)

6. **hooks** (1시간)
   - `src/hooks/useAuth.ts` (auth store 셀렉터)
   - `src/hooks/useRooms.ts` (SWR + WS 머지)
   - `src/hooks/useMessages.ts` (SWR 첫 페이지 + 무한 페이징)
   - `src/hooks/useUserSearch.ts` (debounced)

7. **방 목록 컴포넌트** (1.5시간)
   - `src/components/room/RoomList.tsx`
   - `src/components/room/RoomListItem.tsx`
   - `src/components/ui/Avatar.tsx`
   - `src/app/(authed)/rooms/page.tsx`
   - `(authed)/layout.tsx`에 Sidebar 추가 (RoomList)

8. **새 방 만들기** (1시간)
   - `src/components/room/CreateRoomModal.tsx` (UserSearch + 멤버 추가 + name + ttlHours)
   - `src/app/(authed)/rooms/new/page.tsx` (또는 모달만)

### Session 2.3 — 채팅 화면 + Optimistic UI

**상태 (2026-10-25)**: 완료. 계획과 달라진 점:
- `TypingIndicator`, `ReadReceipt`, `ExpiringRoomBanner`는 따로 만들지 않았다. 타이핑 줄은 `ChatRoom`, 읽음 표시는 `MessageList`의 `readLabelFor`, 만료 배너는 `ChatHeader` 안에 있다.
- 훅 세 개를 새로 뒀다. `useRoomMessages`는 첫 페이지와 이전 페이지, `useMarkRead`는 읽음 전송, `useTyping`은 타이핑 송수신을 맡는다.
- `mark_read`는 방 화면이 마운트돼 있고 페이지가 보일 때만 보낸다(`.claude/RULES.md` R6). 대상이 상대의 burn-after-read 메시지면 서버가 지우기 때문이다.
- 읽음 표시는 접속 뒤 받은 `read_update`로만 그린다. REST에 멤버별 읽음 시각이 없어서 새로 연 방에는 처음에 표시가 없다.

**작업**:

9. **채팅 화면** (2시간)
   - `src/components/chat/ChatHeader.tsx`
   - `src/components/chat/MessageList.tsx`
   - `src/components/chat/MessageItem.tsx`
   - `src/components/chat/MessageInput.tsx` (UUID + ttl select)
   - `src/components/chat/ChatRoom.tsx` (조립)
   - `src/app/(authed)/rooms/[id]/page.tsx`

10. **Optimistic UI** (1시간). 로직은 2.1에서 끝났다 (`src/lib/chat/connection.ts`). 남은 것은 대기, 실패 표시와 재시도 버튼 UI다
    - send_message 호출 시 즉시 store에 pending 메시지 추가
    - message_ack 수신 시 replaceClientMessage(clientMessageId, serverId)
    - 5초 내 ack 없으면 status: 'failed' + 재시도 버튼

11. **타이핑 + 읽음 표시** (1시간)
    - `src/components/chat/TypingIndicator.tsx` — 3초 안 추가 입력 없으면 사라짐
    - `src/components/chat/ReadReceipt.tsx`
    - mark_read debounced 500ms

**Phase 2 완료 조건** (2026-10-25, 로컬 server-v2 `07372dd`로 확인):
- [x] 1:1 방 생성 + 메시지 송수신 (실시간)
- [x] 두 사용자 동시 테스트. 한 브라우저의 두 탭으로는 할 수 없다(토큰을 탭끼리 공유하고, 다른 탭의 계정 전환을 감지한다). Alice는 앱 브라우저, Bob은 Node WebSocket 스크립트로 확인했다
- [ ] 메시지 페이징 (스크롤 위), 일부 확인: 버튼으로 불러오기와 스크롤 위치 보정은 확인했다. 감시 요소(IntersectionObserver) 자동 로딩은 창을 띄운 브라우저에서 다시 봐야 한다
- [x] typing indicator + read receipt
- [x] WS 재연결: 서버를 내렸다 올려 재연결과 backfill을 확인했다. 탭을 닫고 다시 여는 경우는 새로 접속하는 경로라서 방을 여는 확인과 같다

---

## Phase 3 — 그룹 + 초대 + 임시 방 + 자동삭제 (1-2 sessions)

### Session 3.1 — 그룹 + 초대

**작업**:

1. **그룹 채팅 지원** (1시간)
   - `CreateRoomModal`에서 멤버 ≥ 2 또는 name 입력 시 GROUP
   - `RoomListItem`에서 GROUP / DIRECT 구분 표시
   - `ChatHeader`에서 GROUP 멤버 수 + name 표시

2. **초대 링크** (1.5시간)
   - `src/lib/api/invite.ts` (createLink, join)
   - `src/components/room/InviteLinkModal.tsx`
   - 코드 + URL 표시 + 복사 버튼
   - `src/app/(authed)/invite/[code]/page.tsx` (mount 시 자동 join → /rooms/:id redirect)

### Session 3.2 — 임시 방 + 자동삭제

**작업**:

3. **임시 방 (TTL Room)** (1시간)
   - `CreateRoomModal`에 ttlHours select (null/24/168/720)
   - `RoomListItem`에 만료 임박 🔥 아이콘 + 남은 시간
   - `ChatHeader`에 ExpiringRoomBanner (10분 전 카운트다운)
   - WS room_expiring 수신 → store.ws.expiringRooms.add → UI 갱신
   - WS room_expired 수신 → store.rooms.remove + 토스트 + redirect

4. **자동삭제 메시지 (Disappearing)** (1시간)
   - `MessageInput`에 ttlSeconds select (0/30/300/3600/86400)
   - `MessageItem`에 expiresAt 있으면 "🔥 30s 후 사라짐" 표시 + 카운트다운
   - WS message_expired 수신 → store.messages 배치 제거 + 토스트

**Phase 3 완료 조건**:
- [ ] 그룹 채팅방 생성 + 멤버 3명 이상 동시 메시지
- [ ] 초대 링크로 새 멤버 참여
- [ ] 임시 방 만료 알림 정상 (10분 전)
- [ ] 자동삭제 메시지 만료 시 양쪽 화면에서 즉시 제거

---

## 출시 전 체크리스트

- [ ] **모든 페이지 한국어 + 다크모드**
- [ ] **401 자동 refresh** (Network 탭에서 확인)
- [ ] **WS 재연결** (네트워크 끊고 복구)
- [ ] **CSP 헤더** (`curl -I https://...` 또는 브라우저 dev tools)
- [ ] **Optimistic UI** (느린 네트워크에서도 즉시 메시지 표시)
- [ ] **에러 처리** (각 401/403/404/409/410/500 시나리오)
- [ ] **모바일 반응형** (375px 너비)
- [ ] **Vercel preview deploy** + 백엔드 CORS 통과
- [ ] **README.md** (프로젝트 설명 + 개발 명령)
- [ ] **`.env.example`** 커밋
- [ ] **`./gradlew test` 통과** (백엔드)

---

## 출시 후 (M2 마일스톤)

PRD-M2.md (`~/Work/geek-chat/geek-chat-server-v2/docs/PRD-M2.md`) 참조.

**P0 (반드시)**:
1. Web Push 알림 (FCM)
2. 메시지 답장 (reply)
3. 사용자 메시지 삭제
4. 메시지 수정
5. 채팅방 나가기 / 강퇴
6. 알림 끄기 (mute)
7. 친구 / 차단

**P1 (강력 추천)**:
8. 이미지 전송 (S3 presigned)
9. 이모지 리액션
10. @mention
11. 링크 미리보기
12. 차별화 spike (Burn-on-Read 또는 Markdown)

각 P0/P1 기능마다 백엔드 + 프론트 동시 작업.
