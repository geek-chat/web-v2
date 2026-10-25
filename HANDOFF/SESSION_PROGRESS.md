# Session Progress — last updated 2026-10-25

> **다음 세션 진입자에게**: 이 파일이 첫 진입점입니다. 5분 안에 컨텍스트를 잡고 이어 작업하세요.

---

## Current state (one-liner)

**Phase 2 완료 (2026-10-25)**: 2.3에서 채팅 화면(메시지 목록과 이전 페이지, 입력, 타이핑, 읽음, 실패 재시도)이 들어갔고 로컬 백엔드로 두 사용자 확인까지 했다. 그 전에 2.1(WebSocket 클라이언트, 스토어), 2.2(방 목록, 새 대화), 리뷰 반영, CSP nonce 수정, Vercel 전환을 마쳤다. 다음은 Phase 3(그룹과 초대, 임시 방, 자동 삭제)이다. 사용자가 2026-10-25에 web-v2 재개를 지시해서(선택지 "지금 시작 + Vitest") 10-24부터의 보류를 풀었다. 백엔드 전환은 아직 진행 중이고 배포 URL이 없어서 로컬 백엔드 기준으로 개발한다.

Phase 1 결과: 가입과 로그인, single-flight 토큰 갱신, OAuth 콜백 4페이지, AuthGuard, `/me`(유저네임 변경, 로그아웃, 탈퇴). Vitest 94개 테스트와 tsc, lint, build가 모두 통과한다. 독립 리뷰의 HIGH, MEDIUM, LOW-1은 고쳤다. 라우트는 `/`, `/login`, `/signup`, `/auth/{success,oauth-link,oauth-complete,error}`, `/rooms`(임시), `/me`다.

## Stack 실제 버전

| | 설치된 버전 |
|---|---|
| Next.js | 16.2.5 (App Router, Turbopack default) |
| React | 19.2.4 (RSC stable) |
| Tailwind | 4.2.4 (CSS-based config, `@custom-variant dark`) |
| TypeScript | 5.x (strict) |
| ESLint | v9 (flat config) |
| zustand | 5.0.13 |
| swr | 2.4.1 |
| react-hook-form | 7.75.0 |
| zod | 4.4.3 |
| @hookform/resolvers | 5.2.2 |
| sonner | 2.0.7 |
| lucide-react | 1.14.0 |
| vitest | 5.0.5 (jsdom 30.1.3, @testing-library/react 16.3.3, @vitejs/plugin-react 6.1.2) |
| @types/node | 24.19.2 (vitest 5의 peer 요구, 로컬 런타임 Node 24.21에 맞춤) |

---

## 2026-10-25 Phase 2.3 결과

### 커밋

| 커밋 | 내용 |
|---|---|
| `cc511ee` | `compareInstants`, 읽음 지점(`rooms.reads`, `read_update`), `loadOlderMessages`, 훅 `useRoomMessages`, `useMarkRead`, `useTyping` |
| `c99b33c` | `ChatRoom`, `ChatHeader`, `MessageList`, `MessageItem`, `MessageInput`, `/rooms/[id]` 교체 |
| `9924639` | 마무리 검증에서 찾은 순서 문제 수정: `useRoomMessages`는 직접 불러온 방을 `loadRoomMessages`가 답한 뒤에야 loaded로 본다 |
| `28e295c` | 위 수정의 빈틈 두 가지: 목록을 그리기 전에는 행을 내주지 않고(`useMarkRead` 보호), 병합 뒤 backfill이 실패해도 첫 페이지를 보여 준다 |

### 설계 근거 (server-v2 `07372dd`)

| 사실 | 근거 | 반영 |
|---|---|---|
| `mark_read`의 대상이 상대가 보낸 burn-after-read 메시지면 서버가 그 메시지를 영구 삭제한다 | `MessageService.markAsRead` | 방 화면이 마운트돼 있고, 소켓이 수락됐고, 페이지가 보일 때만 보낸다. 타이머가 끝날 때 다시 확인한다 |
| 읽음 시각은 그 메시지의 `createdAt`이고 앞으로만 간다. REST에는 멤버의 읽음 시각이 없다 | `markAsRead`, `RoomMemberResponse` | 읽음 표시는 접속 뒤 온 `read_update`로만 그린다 (S15) |
| 타이핑은 저장하지 않고 다른 멤버에게만 보낸다 | `handleTypingStart` | 보내기는 2초에 한 번, 표시는 마지막 이벤트 뒤 3초 |
| 메시지 길이와 `ttlSeconds` 값은 서버가 검사하지 않는다. 빈 메시지만 거부한다 | `MessageService.sendMessage` | 빈 메시지는 보내지 않고, TTL은 문서의 0, 30, 300, 3600, 86400초만 고른다 |

### 검증 (2026-10-25)

`28e295c` 기준으로 `memguard -- npm test`(38개 파일, 249개 테스트)를 두 번 돌려 모두 통과했고, tsc, lint, build도 exit 0이다. 그 전 `9924639`에서는 247개로 세 번 연달아 통과했다.

마무리 검증에서 `useRoomMessages.test.tsx`의 "loads the first page" 케이스가 세 번 중 두 번 실패했다(`reachedStart`가 false). 처음에는 시간이나 환경에 기대는 테스트라고 봤지만 기각했다. 원인은 프로덕션 순서였다. 스토어는 첫 페이지를 병합할 때 방을 loaded로 표시하는데, 훅은 promise가 풀린 뒤(소켓이 열려 있으면 backfill 요청 뒤)에야 시작에 닿았는지 알았다. 그 사이 화면은 "대화의 처음입니다" 대신 이전 페이지 버튼을 보여 주고, 감시 요소가 보이면 쓸모없는 backward 요청도 나갈 수 있었다. 훅이 직접 불러온 방은 답을 받은 뒤에 loaded로 보도록 고쳤다. 대가로 소켓이 열려 있을 때 방을 처음 열면 backfill 요청 한 번만큼 늦게 그린다(측정하지 않음). 이 순서를 고정하는 테스트를 새로 붙였고, 고치기 전에 실패하는 것을 확인했다.

이 수정은 빈틈 두 개를 남겼고, push 전 검토에서 찾아 `28e295c`로 막았다. 하나는 목록을 숨긴 동안에도 훅이 병합된 행을 내줘서, `ChatRoom`이 그 행을 받은 `useMarkRead`로 아무도 보지 않은 행에 `mark_read`를 보낼 수 있었던 것이다(첫 페이지보다 먼저 온 실시간 행도 같았다). 다른 하나는 병합 뒤 backfill이 실패하면 받아 둔 첫 페이지 대신 재시도 화면이 뜬 것이다. 두 경우 모두 테스트를 붙였고 고치기 전에 실패하는 것을 확인했다.

위 브라우저 확인은 `9924639`, `28e295c` 전의 코드로 했다. 방을 처음 열 때 목록을 그리는 시점이 바뀌었으니 다음 세션에서 한 번 다시 본다.

로컬 server-v2(`07372dd`)로 앱 브라우저에서 확인했다. Alice는 브라우저, Bob은 Node 스크립트(WebSocket)다.

| 항목 | 결과 |
|---|---|
| 방을 열면 첫 페이지와 상대 이름 | ✅ 헤더 "Bob", 기존 메시지, "대화의 처음입니다" |
| Alice가 보낸 메시지 | ✅ 바로 확정, Bob 쪽에 `new_message`와 `typing_indicator` 도착 |
| Bob의 타이핑 | ✅ "Bob 님이 입력 중"이 떴다가 3초 뒤 사라짐 |
| 읽음 (Alice → Bob) | ✅ Bob 메시지가 화면에 뜨자 Bob에게 Alice의 `read_update`가 감 |
| 읽음 (Bob → Alice) | ✅ Alice 메시지 아래 "읽음" (DOM 확인) |
| 이전 페이지 (버튼) | ✅ 123행이 되고 "대화의 처음입니다", `scrollTop` 0에서 128로 보정돼 보던 위치 유지 |
| 재연결과 backfill | ✅ 서버를 내리면 "다시 연결하는 중…", 다시 올린 뒤 Alice가 붙기 전에 Bob이 보낸 메시지가 재연결 뒤 나타남 |
| 이전 페이지 자동 로딩 (IntersectionObserver) | **미확인**. 아래 참고 |
| 실제 한글 IME 조합 중 Enter | **미확인**. 자동화 입력은 IME를 거치지 않는다. 단위 테스트는 `isComposing`과 `keyCode 229` 둘 다 확인한다 |

자동 로딩을 확인하지 못한 이유: 앱 브라우저 창이 숨겨진 동안에는 프레임이 돌지 않았다(`requestAnimationFrame`이 45초 동안 실행되지 않음). IntersectionObserver 판정도 그 단계에서 일어나서 콜백이 오지 않았다. 컴포넌트의 관찰자는 감시 요소와 스크롤 루트를 맞게 잡고 있었다(`observe` 기록). 창을 띄운 상태(Cmd+Shift+B)에서 위로 스크롤해 확인해야 한다.

기각한 가설: 처음에는 "숨겨진 창이라 렌더링이 멈췄다"고 봤다가, `requestAnimationFrame`이 한 번 실행되는 것을 보고 기각했다. 이어서 컴포넌트 쪽 문제를 의심해 fetch와 관찰자를 감시했다. 관찰자는 정상으로 만들어졌고, 이후 rAF가 45초 동안 오지 않아 다시 창 상태가 원인으로 좁혀졌다. 첫 rAF는 그 순간 프레임이 잠깐 돈 것으로 본다.

---

## 2026-10-25 Phase 2.2 결과

### 커밋

| 커밋 | 내용 |
|---|---|
| `7786c31` | 리뷰 M4: backfill 첫 커서를 5초 겹쳐 잡음 (사용자 승인으로 기존 테스트 기대값 수정) |
| `9b613bb` | `searchUsers`, `createRoom`(서버 규칙대로 검증), `useRooms`, `useUserSearch`, `Avatar`, `RoomList`, `/rooms`(모바일 목록, 데스크톱 사이드바), `/rooms/new`, 임시 `/rooms/[id]` |

### 설계 근거 (server-v2 `07372dd`)

| 사실 | 근거 | 반영 |
|---|---|---|
| 상대 1명이고 이름이 없으면 DIRECT. 이미 있으면 그 방을 돌려준다 | `ChatRoomService.createRoom`, `findOrCreateDirectRoom` | `upsertRoom`이 병합해서 기존 DM의 `lastMessageAt`과 아바타를 지킨다 |
| `ttlHours`는 서버가 값을 검사하지 않고 GROUP에만 적용한다. GROUP은 본인 포함 100명까지 (`RoomFull`, 400) | `createGroupRoom` | 화면은 24, 168, 720시간만 고르게 하고, zod로 1명 이상 99명 이하를 검사한다 |
| 검색: 빈 검색어는 빈 목록, `@아이디`는 정확히 1명, 그 밖에는 닉네임 10명. 본인은 빠진다 | `UserService.searchUsers` | 결과가 계정마다 달라서 SWR 키에 사용자 id를 넣었다 |
| 만들기 응답에는 `lastMessageAt`과 멤버 아바타가 없고 `_links`가 붙는다 | `CreateRoomResponse`, `RoomModelAssembler` | `toRoom()`으로 목록 행 모양을 만들고, zod가 `_links`를 버린다 |

### 검증 (2026-10-25)

`memguard -- npm test` (32개 파일, 208개 테스트), tsc, lint, build가 모두 exit 0이다.

로컬 server-v2(`07372dd`, local 프로필)를 띄워 앱 브라우저로 확인했다.
- Alice로 로그인했다(dev-login). 서버 로그에 `ws_connected ... totalConnections=1`이 찍혀 개발 모드 Strict Mode에서도 소켓이 하나였다.
- `/rooms`는 빈 목록 화면, `/rooms/new`에서 "Bob"을 검색해 고르고 시작하자 `/rooms/<id>`로 이동했고 제목이 "Bob"이었다.
- Bob이 WebSocket(Node 스크립트)으로 보낸 메시지가 새로고침 없이 사이드바의 방 시각("오후 6:13")으로 반영됐다.
- 콘솔 오류는 0건이었다.

### 로컬 백엔드 띄우는 법 (이번에 확인한 방식)

server-v2 작업 트리는 다른 세션이 쓸 수 있어서 건드리지 않았다. `git -C ~/Work/geek-chat/geek-chat-server-v2 archive <커밋> | tar -x -C <scratchpad 폴더>`로 내보낸 뒤 그 폴더에서 실행한다. DB는 이미 떠 있는 `geekchat-dev-postgres`(5433)를 쓴다.

1. `memguard -- ./gradlew :app:bootJar`로 jar를 한 번 빌드한다.
2. `java -jar app/build/libs/app-0.0.1-SNAPSHOT.jar --spring.profiles.active=local`를 백그라운드로 띄운다.

주의할 점이 있다. 훅이 서버 명령도 memguard로 감싸서, 서버가 떠 있는 동안에는 `npm test`, tsc, build가 잠금을 기다리며 멈춘다(`gradlew bootRun`으로 띄웠을 때 tsc가 3분 넘게 멈췄다). 브라우저 확인을 먼저 하고, 서버를 내린 뒤 검증 명령을 돌린다.

---

## 2026-10-25 Phase 2.1 결과

### 커밋 (`git log b296bfc..HEAD`)

| 커밋 | 내용 |
|---|---|
| `76bc9eb` | `src/lib/api/rooms.ts` (방 목록과 메시지 조회, zod 스키마). `client.ts`가 `refreshOnce`, `endSession`을 export해서 WS도 같은 single-flight 갱신을 쓴다 |
| `13db73b` | `src/lib/ws/events.ts`(이벤트 계약), `src/lib/ws/client.ts`(`ChatWSClient`, R2 재연결 규칙) |
| `0ff1288` | `src/store/{messages,rooms,ws}.ts` |
| `7f464ee` | `src/lib/chat/{connection,backfill}.ts`, `ChatConnection`, `(authed)` 레이아웃 연결, 알림 문구 |
| `df2f4f0` | 독립 리뷰 반영 (아래 "독립 리뷰" 표). 다른 탭 계정 전환 차단, 삭제 기록(tombstone), "로드된 방" 구분, 최신 페이지로 건너뛸 때 실시간 행 보존 |

계획(`DEVELOPMENT_PLAN.md` Session 2.1)과 달라진 점은 그 절의 "상태"에 적었다. 요약하면 `src/types/` 없음, `useWebSocket` 대신 `ChatConnection`, 2.3의 낙관적 전송 로직을 앞당김.

### 설계 근거 (server-v2 `07372dd` 코드에서 확인, 읽기만 함)

| 사실 | 근거 | 반영 |
|---|---|---|
| `message_ack`는 핸들러 스레드에서 바로, `new_message`는 커밋 뒤 `@Async`로 나간다. 도착 순서가 정해져 있지 않다 | `ChatWebSocketHandler.handleSendMessage`, `ChatEventListener.onMessageSent` | 스토어가 두 순서를 모두 한 행으로 맞춘다 (R6) |
| 같은 `clientMessageId`로 다시 보내면 저장된 메시지를 돌려주고 이벤트는 다시 내지 않는다 | `MessageService.sendMessage`의 `findByClientMessageId` 조기 반환 | ack만으로 확정한다. 재시도는 같은 id를 쓴다 |
| 연결을 받아들여도 서버는 아무것도 보내지 않는다. 거부는 핸드셰이크 콜백 안에서 error와 1008로 한다 | `afterConnectionEstablished`, `reject` | "수락"은 onopen 1초 뒤 거부 없음, 또는 error가 아닌 첫 프레임 (R2에 기록) |
| 재연결 2초 제한은 성공한 등록 시각만 기준으로 센다. 거부된 시도는 기록하지 않는다 | `WebSocketSessionManager.register` | 2초에서 시작하는 백오프와 jitter로 충분하다 |
| 방에 초대돼도 알림 이벤트가 없다 | `ChatEventListener.onRoomMemberJoined` (메모리 등록만) | 모르는 방의 `new_message`가 오면 `rooms.stale` |
| REST 메시지에는 `senderNickname`이 있고 `roomId`가 없다. `new_message`는 그 반대다 | `MessageDto.kt`, `ChatEventListener.onMessageSent` | `senderNickname`은 선택 필드. 없으면 방 멤버에서 찾는다 |
| 최신과 backward 페이지는 내림차순, forward 페이지는 오름차순으로 온다 | `SpringDataMessageRepository` | 스토어가 병합한 뒤 정렬한다 |
| `Instant.toString()`의 소수 자릿수가 일정하지 않다 | `MessageResponse.createdAt = createdAt.toString()` | 문자열 대신 시각으로 정렬한다. 커서는 받은 문자열 그대로 돌려준다 |

### 검증 (2026-10-25)

`memguard -- npm test` (24개 파일, 162개 테스트), `memguard -- npx tsc --noEmit`, `memguard -- npm run lint`, `memguard -- npm run build`가 모두 exit 0이다. 테스트가 실제로 잡는지 코드를 일부러 망가뜨려 7번 확인했고, 6번은 의도한 테스트가 실패했다. 남은 1번(오류 처리기에서 ack 타이머를 지우지 않게 바꿈)은 재시도 경로가 같은 타이머를 한 번 더 지워서 동작이 달라지지 않았다.

리뷰 반영(`df2f4f0`) 뒤에는 27개 파일, 182개 테스트와 tsc, lint, build가 모두 exit 0이다. 기존 테스트 케이스는 고치지 않았고, 새 케이스는 파일 끝에 붙이거나 새 파일로 썼다. 계정 확인과 tombstone을 일부러 빼 보니 새 테스트가 각각 실패했다.

### 배포 후 발견: CSP가 hydration을 막음 (2026-10-25)

Vercel에 처음 올린 운영 페이지(`2571ae8`)를 브라우저로 열자, CSP `script-src 'self'`가 Next의 인라인 스크립트 6개를 막아 hydration이 되지 않았다(콘솔: `Executing inline script violates ... 'script-src 'self''`, `Error: Connection closed.`). Phase 1.1(`ea0f041`)부터 있던 설정이다. 지금까지 검증이 test, tsc, lint, build뿐이고 브라우저에서 띄운 적이 없어서 드러나지 않았다. 개발 서버도 같은 이유로 막혀 있었다.

사용자가 "nonce + proxy.ts"를 골랐다. `src/proxy.ts`가 요청마다 nonce를 넣은 CSP를 만들고, 루트 레이아웃이 `await connection()`으로 모든 페이지를 동적 렌더링한다. 근거는 `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`의 "Nonces" 절이다. 브라우저에서 확인한 결과는 다음과 같다(앱 브라우저, `.claude/launch.json`).

| 환경 | 확인 |
|---|---|
| `next start` (운영 빌드) | 콘솔 오류 0. 빈 로그인 폼을 제출하면 "사용자명을 입력하세요"가 뜨고 주소가 그대로다(hydration 됨). `<script>` 19개 모두 응답 헤더와 같은 nonce |
| `next dev` | 콘솔 오류 0. 같은 검증 문구가 뜬다 |

`style-src 'unsafe-inline'` 재평가(1-bis의 LOW)도 이것으로 정리했다. nonce를 넣으면 브라우저가 `'unsafe-inline'`을 무시해 React의 `style` 속성이 막히므로 그대로 둔다.

### 독립 리뷰 (Phase 2.1, 2026-10-25)

판정은 REQUEST CHANGES였고 HIGH 1, MEDIUM 4, LOW 6건이었다. 서버 쪽 주장은 `07372dd` 코드로 다시 확인했다.

| 등급 | 지적 | 처리 |
|---|---|---|
| HIGH | 토큰이 모든 탭에 공유돼서, 다른 탭이 다른 계정으로 로그인하면 이 탭이 재연결 때 그 계정으로 붙어 이벤트가 섞인다. 다른 탭에서 로그아웃해도 이 탭은 그대로 남는다 | ✅ `df2f4f0`. 클라이언트를 사용자에 고정하고, 다른 계정 토큰이면 닫은 뒤 `verifySession()`. AppBoot가 `storage` 이벤트로 다른 탭의 로그아웃과 계정 전환을 감지 |
| MEDIUM | 최신 페이지로 건너뛸 때 그사이 실시간으로 온 행까지 지운다 | ✅ 그 페이지보다 오래된 서버 행만 버린다 |
| MEDIUM | 만료되거나 burn된 메시지가 늦게 도착한 REST 페이지로 되살아난다 | ✅ tombstone. 리뷰가 함께 제안한 `expiresAt` 시각 필터는 넣지 않았다. 시계가 빠른 클라이언트에서 30초짜리 새 메시지가 사라질 수 있어서다 |
| MEDIUM | 실시간 메시지 하나만 받은 방도 "로드됨"이 되어 backfill 대상이 되고, 빈 방은 backfill을 건너뛰며, 수락 뒤에 온 첫 페이지와 방 등록 사이가 빈다 | ✅ `loaded` 표시를 따로 두고, 빈 방은 최신 페이지를 받고, `loadRoomMessages()`가 수락 뒤 첫 페이지에 backfill을 한 번 더 돈다 |
| MEDIUM | 커서가 커밋 순서와 `createdAt` 순서를 같다고 본다. 같은 방에 동시에 보낸 두 메시지의 커밋 순서가 뒤바뀐 채 끊기면 하나가 빠질 수 있다 | ✅ 첫 커서를 5초 겹쳐 잡는다. 사용자가 "고치고 테스트 기대값도 수정"을 골라서, 기존 `backfill.test.ts`의 첫 커서 기대값 두 곳과 테스트 이름 하나를 바꿨다 |
| LOW | TOKEN_EXPIRED 뒤 재연결이 늘어난 백오프를 기다린다 | ✅ 최소 간격 뒤 재연결. refresh 1회 제한은 유지하고 R2에 적었다 |
| LOW | 같은 밀리초 안의 행을 무작위 UUID 순으로 정렬한다 | ✅ 마이크로초 자릿수를 먼저 비교 |
| LOW | ack만 받은 행은 서버 사본이 오기 전까지 클라이언트 시각으로 끝에 남는다 | 남김. 다음 backfill이나 방 재로딩 때 서버 사본으로 바뀐다 |
| LOW | ack를 잃은 뒤 backfill로 받은 서버 행과 failed 행이 둘 다 보인다 | 서버 보고 S12. 같은 id로 재시도하면 한 행으로 합쳐진다 |
| LOW | 계약 밖 프레임(새 `MessageType` 등)을 운영에서 조용히 버리고, REST는 페이지 전체가 실패한다 | 남김. 계약이 바뀔 때 어떻게 다룰지는 결정이 필요하다 |
| LOW | 아직 수락되지 않은 소켓에도 보낸다. 거부되면 5초 뒤에야 failed가 된다 | 남김. 5초 대비책으로 처리된다 |

리뷰가 남긴 확인 사항: 수락 창(1초) 설계는 타당하다는 의견이었다. 다만 서버가 `findAllByUserId`(DB) 뒤에 방을 등록하므로, DB가 1초보다 느리면 backfill이 방 등록보다 먼저 돌 수 있다. 근본 해결은 서버의 연결 완료 프레임이다(S13). heartbeat가 없어서 끊긴 연결이 계속 열린 것처럼 보일 수 있다(S14).

실제 백엔드에 붙인 2탭 확인은 아직 하지 않았다. 2026-10-25 기준 로컬 8080에 서버가 없었다 (`geekchat-dev-postgres` 컨테이너만 실행 중). 절차는 아래 "다음 세션" 1번에 있다.

---

## 2026-10-25 Phase 1.2 결과

### 커밋 (`git log 2a1f19b..HEAD`)

| 커밋 | 내용 |
|---|---|
| `a1aa484` | Vitest 도입, single-flight refresh 테스트 4개. Vite 8은 tsconfig paths를 기본 지원해서 `vite-tsconfig-paths`는 넣지 않았다 |
| `38fede8` | `src/lib/auth/session.ts` (`verifySession`, `startSession`). `/auth/me` 일시 실패는 `offline`, 401/403/404만 세션 종료. 로그인 직후 사용자 정보 로드 |
| `941c43b` | API 에러 문구를 HTTP 상태와 호출 맥락으로 선택 (`describeApiError`). 비밀번호 규칙을 서버와 맞춤 |
| `8fb02fc` | `useOAuthHash`로 콜백 hash를 한 번만 읽고 URL에서 지움. 운영 빌드에서 `devLogin` 차단 |
| `0f8f0dc` | OAuth 콜백 4페이지, `CompleteSignupForm`, 에러 코드와 제공자 이름 허용 목록, `t()` 치환 |
| `224ff8b` | AuthGuard (상태 5개 모두 처리), `(authed)` 레이아웃, 임시 `/rooms` |
| `f25ce77` | `/me`: 유저네임 변경 (`src/lib/api/users.ts`), 로그아웃, `DELETE MY ACCOUNT` 확인 후 탈퇴 |
| `ff6d3ff` | 리뷰 HIGH: 늦게 끝난 옛 요청이 새로 저장된 세션을 지우거나 덮어쓰지 않게 함 (`client.ts`의 `endSession`, `session.ts`의 세대 카운터) |
| `538cc09` | 리뷰 LOW: 닉네임 trim |
| `1b29829` | 리뷰가 지적한 빠진 테스트 (로그아웃 후 `/login`, AppBoot 리스너, oauth-complete, 실제 hydration 경로) |
| `d0a9116` | 리뷰 MEDIUM: 콜백은 이 탭에서 시작한 OAuth 흐름의 hash만 받음 (`src/lib/auth/oauthFlow.ts`) |

### Phase 1.1 코드에서 새로 찾아 고친 문제

| 문제 | 근거 | 고친 커밋 |
|---|---|---|
| 로그인과 가입 실패가 모두 "알 수 없는 오류"로 표시됨. 서버 에러 본문의 `error`는 도메인 코드가 아니라 HTTP reason phrase("Conflict")인데 이를 코드로 찾았다 | server-v2 `ChatErrorMapping.kt` (`error = status.reasonPhrase`) | `941c43b` |
| 클라이언트 비밀번호 검증이 길이만 봐서 `abcdefgh`가 폼을 통과한 뒤 서버 400을 받음 | server-v2 `AuthService.validatePassword` (숫자와 문자 각 1개 이상) | `941c43b` |
| 로그인 후 클라이언트 이동만 일어나서 스토어가 `authenticated`인데 `user`가 비어 있음 | `LoginForm.tsx`가 `/auth/me` 없이 `/rooms`로 이동, AppBoot는 마운트 때만 검증 | `38fede8` |
| `/auth/me`가 네트워크나 5xx로 실패하면 토큰은 남긴 채 로그아웃 화면이 됨 (이월 MEDIUM) | `AppBoot.tsx`의 기존 catch 분기 | `38fede8` |

### 검증 (2026-10-25)

`memguard -- npm test` (16개 파일, 94개 테스트), `memguard -- npx tsc --noEmit`, `memguard -- npm run lint`, `memguard -- npm run build`가 모두 exit 0이다. 실제 백엔드에 붙이는 확인(dev-login, OAuth)은 아직 하지 않았다. 아래 "다음 세션" 1번을 따른다.

### 코드 리뷰 (독립 컨텍스트)

판정은 REQUEST CHANGES였고 HIGH 1, MEDIUM 1, LOW 2건이었다. 모두 원본 코드로 확인했다.

| 등급 | 지적 | 처리 |
|---|---|---|
| HIGH | 콜백이나 로그인 페이지에서 부팅 검증(옛 토큰)과 새 세션 시작이 겹치면, 옛 refresh의 401이 새 토큰을 지우거나 옛 계정의 회전 토큰이 새 토큰을 덮어씀. 늦게 끝난 `/auth/me`가 화면의 사용자를 정함 | ✅ `ff6d3ff` |
| MEDIUM | 콜백 페이지가 OAuth 흐름의 출처를 확인하지 않아, 남이 만든 링크의 토큰으로도 로그인되거나 가입이 끝남 | ✅ `d0a9116` (이 탭에서 시작한 흐름만 받음). 서버 쪽 보완은 사용자가 따로 처리 |
| LOW | 공백만 있는 닉네임이 폼을 통과함 | ✅ `538cc09` |
| LOW | `useOAuthHash`의 hash 지우기가 Next의 history 패치(`app-router.js`의 `useEffect`)보다 먼저 실행되어, Next 내부의 canonical URL에 hash가 남음. 같은 URL에서 라우터 상태가 바뀌면(개발 중 HMR 등) `HistoryUpdater`가 토큰이 든 URL을 주소창에 다시 쓸 수 있음. 지금 운영 경로에는 이를 일으키는 동작이 없음 | 남김. 수정 후보는 아래 |

HIGH 수정의 첫 버전은 요청 자신의 refresh 회전까지 "세션이 바뀜"으로 보는 버그가 있었고, 기존 테스트가 잡아냈다. 지금 버전은 성공한 refresh 뒤 회전된 토큰을 기준으로 삼는다.

LOW-2 수정 후보 (미실측): 지금처럼 즉시 지운 뒤 `queueMicrotask`로 `history.replaceState(null, "", path)`를 한 번 더 부른다. 그때는 Next의 패치가 걸려 있어서 Next가 깨끗한 URL을 canonical URL로 기록한다. 기존 테스트는 그대로 통과한다. 적용 전에 dev에서 콜백 URL을 열고 파일을 고쳐 HMR을 일으킨 뒤 주소창에 hash가 돌아오는지 본다.

---

## 2026-10-24 세션 간 협업 결과

### 전환 계획과 역할 분담

출처: 조율 세션("Complete project prompt with technical specifications")이 보낸 메시지. 사용자 결정 인용은 "전환 계획 승인할게" (2026-10-24).

| 세션 | 저장소 | 역할 |
|---|---|---|
| Migrate GeekChat server to Kotlin Spring Boot | `geek-chat-server-v2` | 백엔드 운영 전환 |
| Complete geek-chat-web-internal tasks 1-12 | `geek-chat-web` (v1 Expo) | v1 통신 계층을 v2 계약(순수 WebSocket `/ws?token=`, `type` JSON)에 맞춤 |
| Complete project prompt with technical specifications | (조율) | 데이터 이관과 전환 조율 |
| 이 저장소 (web-v2) | `geek-chat-web-v2` | 10-24 보류, 10-25 사용자 지시로 재개. 다른 저장소는 읽기만 함 |

### 직접 검증한 계약 사실 (server-v2 `0ccf5c2`에서 검증, 읽기만 함)

2026-10-25에 server-v2 `a0995cc`에서 다시 봤다. 아래에 인용한 Kotlin 파일은 바뀌지 않았다. 문서만 바뀌었는데, `API.md`가 OAuth 에러 코드 4종을 적게 됐고 `WEBSOCKET.md`에서는 코드에 없던 `AUTH_ERROR` 행이 빠졌다.

같은 날 PR #11 머지(`07372dd`) 뒤에 WS 항목을 다시 봤다. 바뀐 Kotlin 파일은 websocket 모듈뿐이라(`git diff --stat a0995cc 07372dd`) 인증 항목의 행 번호는 그대로 맞다. 행이 자주 밀리는 server-v2 인용은 클래스와 함수 이름으로 바꿨다.

| 항목 | 근거 | web-v2 영향 |
|---|---|---|
| 5월 이후 문서 변경은 API.md 2건(`b4ba708` HATEOAS `_links`, `a389f0c` 관리자 AI)뿐, WEBSOCKET.md 0건 | `git log 96aa85c..HEAD` | 단일 방 응답에 `_links`가 붙음. zod `z.object`는 모르는 키를 버리므로 깨지지 않음 |
| 인증 응답과 OAuth hash 형식 그대로 | `AuthController.kt:112-126` | Phase 1.2 콜백 설계 유효 |
| `/auth/error?error=` 값은 4종: `oauth_cancelled`, `missing_params`, `invalid_state`, `oauth_failed` | `AuthController.kt:100-112` | 에러 페이지가 4종을 모두 매핑해야 함 |
| JWT에 role 클레임 추가 | 커밋 `035ad30` | 영향 없음 (`jwt.ts:49`는 `exp`만 읽음) |
| WS 연결 거부 5가지(NO_TOKEN, TOKEN_EXPIRED, INVALID_TOKEN, RATE_LIMITED, MAX_CONNECTIONS)가 모두 close 1008 | `ChatWebSocketHandler.afterConnectionEstablished`가 검사하고 `reject` 한 곳에서 닫는다 (`07372dd`) | 1008은 직전 `error.code`로 분기. 정본은 `.claude/RULES.md` R2 |
| 연결 중 `error`에 `clientMessageId`가 실린다 (PR #11). `SEND_FAILED`는 항상, `INVALID_DATA`는 요청에 있었을 때 | `ChatWebSocketHandler.handleSendMessage`, `sendError`, `docs/WEBSOCKET.md` §4.9 | 대기 메시지를 바로 `failed`로. 정본은 RULES.md R6 |
| 방 멤버가 아닌 `typing_start`는 조용히 버린다 (PR #11) | `ChatWebSocketHandler.handleTypingStart` | 에러가 오지 않으니 클라이언트가 따로 처리할 것은 없음 |
| 연결 상한 3, 재연결 최소 간격 2초 | `WebSocketSessionManager`의 `MAX_CONNECTIONS_PER_USER`, `MIN_CONNECTION_INTERVAL_MS` | 백오프는 2초부터 |
| WS Origin과 OAuth 리다이렉트 대상이 `FRONTEND_URL` 하나 | `WebSocketConfig`의 `setAllowedOrigins(appProperties.frontendUrl)`, `AuthController.kt:100-126` | preview 배포에서 WS 불가. v1 Expo에서 web-v2로 바꿀 때 `FRONTEND_URL`도 같이 바꿔야 함 |
| Render에서는 REST CORS도 `FRONTEND_URL` 하나 | `AppProperties.frontendOriginPatterns` 기본값이 빈 목록, `render.yaml`(a0995cc)에 패턴 키 없음 | preview에서 REST를 쓰려면 Render에 `APP_FRONTEND_ORIGIN_PATTERNS`를 따로 넣어야 함 |
| 배포 대상은 Render 무료 + Supabase Postgres, 아직 배포 전 | `docs/MIGRATION.md:166-175` | `connect-src`는 이미 env로 만듦 (`next.config.ts:6-7, 18`). URL이 정해지면 Vercel env만 넣으면 됨 |

### v1 세션이 알려 준 인증 함정 (web-v2 반영 상태)

| v1 함정 | web-v2 상태 |
|---|---|
| linkToken을 `access_token` 키에 실어 보냄 | 구현함 (`0f8f0dc`). 콜백 페이지는 `useOAuthHash`로 자기 키만 읽고, 일회용 토큰은 컴포넌트 상태에만 둔다. localStorage에 들어가지 않음을 테스트가 확인한다 |
| REST와 WS가 따로 refresh해서 회전 토큰이 경합 | WS도 apiFetch의 single-flight refresh를 쓴다 (RULES.md R2에 규칙 추가, 구현은 Phase 2) |
| 저장소와 스토어의 토큰이 어긋남 | 피함. `setSession`을 없애서 스토어는 토큰을 아예 다루지 않고 (`38fede8`), 실패는 `clearSession()`으로 모인다 |
| `/auth/me` 실패를 조용히 삼킴 | 해결 (`38fede8`). 일시 장애는 `offline` 상태로 두고, AuthGuard가 재시도 화면을 보여 준다 |

### RULES.md R2 교차 검토 (2026-10-25, web-internal 세션 검토를 조율 세션이 전달)

원본 코드와 다른 사실은 없었고, 보완점 3개를 받았다. 4번째는 이쪽에서 server-v2 문서를 다시 읽다가 찾았다.

| 항목 | 반영 |
|---|---|
| 백오프를 `onopen`에서 되돌리면 거부될 연결도 먼저 열리므로 백오프가 2초에 묶이고, refresh 1회 제한도 매번 풀린다 | R2에 "10초 유지되거나 error가 아닌 메시지가 오면 되돌린다" 규칙 추가, `API_INTEGRATION.md` 샘플 수정 |
| 서버는 연결을 받을 때만 토큰을 검사하므로 연결 전에 exp를 보고 미리 갱신하면 TOKEN_EXPIRED 왕복이 준다 | R2에 선택 규칙으로 추가 |
| `room_expired`, `message_burned` 처리가 R2에 없다 | R2에 추가. `burnAfterRead`는 누구나 보낼 수 있어서 web-v2가 보내지 않아도 처리해야 한다 |
| 재연결 직후 놓친 메시지를 forward cursor 조회로 채워야 한다 (`WEBSOCKET.md` §6) | R2에 추가 |

### 사용자에게 보고만 한 것 (다른 저장소, 담당은 사용자가 정함)

| # | 위치 | 문제 |
|---|---|---|
| S1 | server-v2 `docs/WEBSOCKET.md` §6 샘플 (`07372dd`에서도 그대로) | 샘플이 1008을 일괄 refresh로 안내하고, `onopen`에서 백오프를 0으로 되돌린다 |
| S2 | server-v2 `WebSocketConfig` (`setAllowedOrigins`) | WS Origin이 `FRONTEND_URL` 하나라 preview 배포에서 WS 불가 |
| S3 | 워크스페이스 `geek-chat/CLAUDE.md` | MySQL, 친구 클라우드, Next.js 15로 적혀 있어 낡음. server-v2 PR #12(`docs/sync-stale-docs`, 10-25 기준 열림)가 다룬다 |
| S4 | server-v2 `README.md:30` | `local` 프로필을 MySQL로 설명하지만 `application-local.yml:11-14`은 PostgreSQL. PR #12가 다룬다 |
| S5 | server-v2 `render.yaml`, `AppProperties.frontendOriginPatterns` | Render에서는 REST CORS도 `FRONTEND_URL` 하나만 허용한다 (패턴 기본값이 빈 목록). preview 배포는 REST도 실패한다 |
| S6 | server-v2 `SpringDataMessageRepository.findByRoomIdAfter` | 메시지 cursor 페이징에 id 보조 정렬이 없어서, 같은 `createdAt`을 가진 메시지가 페이지 경계에서 빠질 수 있다 (가능성 낮음) |
| S8, S9 | server-v2 인증 | 보안 항목 2건. 2026-10-25에 사용자에게 직접 보고했다. 이 저장소는 공개라서 고쳐질 때까지 상세는 적지 않는다. **운영 배포 전 처리 권장** |
| S16 | server-v2 | 보안 항목 1건. 2026-10-25에 사용자에게 직접 보고했다. 같은 이유로 상세는 적지 않는다. **운영 배포 전 처리 권장** |
| S10 | server-v2 `SecurityConfig.securityFilterChain` | `/error`가 허용 목록에 없고 entry point가 본문 없는 401을 돌려준다. 그래서 공개 엔드포인트의 bean validation 실패(400)가 401로 바뀌어 보일 수 있다 (설정 기준, 실측 전). web-v2는 서버와 같은 검증을 폼에서 먼저 해서 영향이 작다 |
| S11 | server-v2 `ChatEventListener.onMessageExpired`, `MessageExpirationScheduler` | 스케줄러가 `@Transactional` 안에서 이벤트를 내고 리스너는 `@Async @EventListener`라서, `message_expired`가 삭제 커밋보다 먼저 나갈 수 있다. 그 사이 REST가 지운 메시지를 돌려준다. web-v2는 tombstone으로 막았다. `AFTER_COMMIT`으로 바꾸면 근본 해결 |
| S12 | server-v2 `MessageResponse` (`MessageDto.kt`) | `clientMessageId`가 없어서 ack를 잃은 메시지를 REST 행과 맞출 수 없다. failed 행과 서버 행이 함께 보인다 |
| S13 | server-v2 `ChatWebSocketHandler.afterConnectionEstablished` | 연결을 받아들여도 아무 프레임을 보내지 않아서, 클라이언트는 1초 동안 거부가 없으면 수락으로 본다. `connected` 같은 프레임이 있으면 추정할 필요가 없다 |
| S14 | server-v2 websocket 모듈 | 로그아웃과 탈퇴 때 그 사용자의 소켓을 닫지 않는다(닫는 곳은 `reject` 하나). heartbeat 설정도 없어서 끊긴 연결이 열린 것처럼 남을 수 있다. 배포 환경 프록시의 idle timeout도 확인이 필요하다 |
| S15 | server-v2 `RoomMemberResponse`, 방 목록 API | 멤버의 읽음 시각(`lastReadAt`)을 주는 REST가 없다. 새로 연 화면은 접속 뒤 `read_update`가 올 때까지 읽음 표시를 그릴 수 없다 |
| S7 | server-v2 `ChatErrorMapping.kt` | 에러 본문의 `error`가 HTTP reason phrase라서 같은 상태 코드를 쓰는 도메인 에러(예: 가입 409의 유저네임과 이메일)를 구분하려면 영어 메시지 앞부분을 봐야 한다. 안정적인 `code` 필드가 있으면 클라이언트가 메시지 문구에 기대지 않아도 된다 |
| T1 | `geek-chat-web` main `559d170` | v2가 리다이렉트하는 `/auth/oauth-link`, `/auth/oauth-complete`, `/auth/error` 라우트 파일이 없음. v1 연동은 `/auth/success#linking_required=true` 형식 (`app/auth/success.tsx:18-33`). web-internal 세션에 공유함. 10-25 기준 v1 `feat/v2-transport` 브랜치(`76cb0b1`)에서 처리 중이고 아직 머지 전 |

---

## Done this session (Phase 1.1)

| Step | 산출물 |
|---|---|
| 백엔드 컨트랙트 스캔 | Explore agent (read-only) — `AuthDto.kt`, `AuthController.kt`, error mapping, OAuth hash format(snake_case), WS 시그니처 모두 확보 |
| Step 1 — env + CSP | `next.config.ts` (CSP + Turbopack root), `src/lib/env.ts` (zod 검증) |
| Step 2 — 테마 | `src/app/globals.css` (Tailwind v4 `@custom-variant dark`, CSS 변수 light/dark) |
| Step 3 — 인증 헬퍼 | `src/lib/auth/{storage,jwt,oauthCallback}.ts`, `src/lib/uuid.ts` |
| Step 4 — API + 단일-플라이트 | `src/lib/api/client.ts` (executor opus 위임, 246라인) + `src/lib/api/auth.ts` (8개 함수 + zod 스키마, backend 컨트랙트 verbatim) |
| Step 5 — 클라이언트 기반 | `src/store/auth.ts` (Zustand slice), `src/i18n/{ko,index}.ts`, `src/components/ui/{Button,Input,Spinner}.tsx`, `src/components/AppBoot.tsx`, `src/app/layout.tsx` (lang=ko, dark, fonts, Toaster, AppBoot) |
| Step 6 — 폼 + 페이지 | `src/components/auth/{SignupForm,LoginForm,OAuthButtons}.tsx`, `src/app/page.tsx` (랜딩 hero), `src/app/(public)/{login,signup}/page.tsx` |
| 검증 | `npx tsc --noEmit` ✅ / `npm run lint` ✅ / `npm run build` ✅ (모두 exit 0) |
| 코드 리뷰 | code-reviewer sub-agent 호출 (백그라운드, 결과는 다음 세션에서도 확인) |
| 커밋 | 6개 atomic commit (`ea0f041` … `dc4e4c6`) |

### Atomic commit 로그

```
dc4e4c6 feat(auth): signup/login/OAuth forms + landing/login/signup pages
968cf86 feat(client-foundation): Zustand auth store, i18n ko, UI primitives, AppBoot
6279515 feat(api): fetch wrapper with single-flight refresh + auth REST module
d9a1393 feat(auth/lib): token storage, JWT decode, OAuth hash parsing, uuid
0dce70a feat(theme): Tailwind v4 class-based dark mode + base CSS variables
ea0f041 feat(env): add env validation + strict CSP headers + Turbopack root pin
```

---

## In-flight

없음. Phase 2.3은 `cc511ee`, `c99b33c`, `9924639`, `28e295c`와 문서 커밋으로 끝났다.

---

## Next session — start here

### 0. 환경 복구 (5분)

```bash
cd "$(git rev-parse --show-toplevel)"   # worktree 경로는 재활용될 때마다 바뀐다

# 한눈에 상태
bash .claude/skills/refresh-context/update.sh | head -40

# worktree가 새로 만들어졌다면 node_modules와 .env.local이 없다
memguard -- npm ci
cp .env.example .env.local               # 값을 http://localhost:8080, ws://localhost:8080/ws로 바꾼다

# 기준선 확인 (memguard로 하나씩)
memguard -- npm test
memguard -- npx tsc --noEmit

# dev 서버 띄워보기
npm run dev
# → http://localhost:3000 (랜딩) / /login / /signup / /rooms / /me
# Ctrl+C로 종료
```

앱 브라우저로 볼 때는 `.claude/launch.json`의 `web-v2 dev`(또는 `npm run build` 뒤 `web-v2 prod`)를 쓴다. 화면을 바꿨으면 브라우저 콘솔에 CSP 오류가 없는지와, 빈 로그인 폼 제출 때 검증 문구가 뜨는지(hydration)를 확인한다. 단위 테스트와 빌드로는 막힌 스크립트를 잡지 못한다.

읽을 문서 (Phase 3 기준, 총 ~30분):
1. **이 파일**, 특히 "2026-10-25 Phase 2.3 결과"와 서버 보고 표 (5분)
2. **`.claude/RULES.md`** R2 (WS 처리 정본, `room_expiring`, `room_expired`, `message_expired`), R6 (낙관적 UI, 읽음) (10분)
3. **`HANDOFF/API_INTEGRATION.md`** §5 (WS 이벤트와 클라이언트 샘플) (10분)
4. **server-v2 `docs/API.md`** §3.2 (방 생성, `ttlHours`)와 §4 (초대 링크), **`docs/WEBSOCKET.md`** (5분). 문서와 코드가 다르면 코드가 맞다

### 1. 백엔드 로컬 실행 + 수동 검증 (Phase 1 통합 확인, 사용자 환경 필요)

별도 터미널에서 (server-v2 `docker-compose.dev.yml` 머리말의 절차와 같다. 2026-10-25에 a0995cc 기준으로 compose의 Postgres 5433과 `application-local.yml` 기본값이 맞는지 읽어서 확인했고, 실행은 하지 않았다. README의 MySQL 설명은 낡았다, S4):
```bash
cd ~/Work/geek-chat/geek-chat-server-v2
docker compose -f docker-compose.dev.yml up -d
./gradlew bootRun --args='--spring.profiles.active=local'   # dev-login은 dev, local 프로필에서만 열린다
```

브라우저 콘솔에서 dev-login 토큰을 넣고 새로고침하면 `/rooms`, `/me`가 실제 `/auth/me`로 열리는지 확인한다:
```javascript
const r = await fetch('http://localhost:8080/auth/dev-login?name=Alice').then(r => r.json())
localStorage.setItem('access_token', r.accessToken)
localStorage.setItem('refresh_token', r.refreshToken)
location.reload()
```

확인할 흐름: 가입과 로그인 실패 문구(중복 유저네임, 틀린 비밀번호), `/me`의 유저네임 변경과 로그아웃, 탈퇴 후 재로그인 시 "탈퇴한 계정입니다". 백엔드를 끄고 새로고침하면 로그아웃되지 않고 재시도 화면이 떠야 한다. 실제 Google/Naver 로그인은 OAuth 콘솔에 redirect URL을 등록해야 확인할 수 있다.

Phase 2.1 WS 확인 (화면은 2.2부터라 개발자 도구로 본다): `/rooms`를 열면 Network 탭의 WS에 `/ws?token=` 연결 하나가 생기고, 서버 로그에 `ws_connected`가 찍힌다. 서버를 껐다 켜면 2초, 4초, 8초 간격으로 다시 붙는다. 같은 사용자로 탭을 4개 열면 4번째 탭에 "다른 탭에서 채팅이 열려 있어" 토스트가 뜨고, 탭 하나를 닫은 뒤 "다시 시도"를 누르면 붙는다. `/me`에서 로그아웃하면 WS가 1000으로 닫힌다.

빠른 시각 검증 (CSP 헤더):
```bash
curl -I http://localhost:3000 | grep -i 'content-security'
```

### 1-bis. 2026-05 code-review 이월 항목 상태

| 우선순위 | 항목 | 상태 |
|---|---|---|
| MEDIUM | `/auth/me` 일시 실패 시 "로그아웃 화면 + 토큰 남음" | ✅ `38fede8` (`offline` 상태와 재시도) |
| LOW | 콜백 페이지가 hash 지우기를 빠뜨리지 않게 강제 | ✅ `8fb02fc` (`useOAuthHash` 훅. 순수 함수 대신 훅으로 강제한 이유는 그 커밋 메시지 참고) |
| LOW | `next.config.ts`의 `style-src 'unsafe-inline'` 재평가 | ✅ 유지하기로 정리 (2026-10-25). CSP는 이제 `src/proxy.ts`가 만들고, `style-src`에 nonce를 넣으면 React `style` 속성이 막힌다. 위 "배포 후 발견" 참고 |
| LOW | `devLogin` 운영 빌드 차단 | ✅ `8fb02fc` |
| NIT | AppBoot의 `console.error` | ✅ 사라짐. 로깅 추상화(Sentry 등)는 운영 배포 때 따로 정한다 |
| NIT | `tError` 키 조회를 허용 목록으로 | ✅ `tError`를 없앴고 (`941c43b`), 콜백 에러 코드와 제공자 이름은 허용 목록으로 바꿨다 (`0f8f0dc`) |
| NIT | `SignupForm`의 이중 zod parse | 그대로 둠 (안전망) |
| NIT | Button 로딩 spinner가 글자 옆에 나란히 뜸 | 그대로 둠 (UX 검토 때 결정) |

### 2. server-v2 PR #11 반영 ✅ (2026-10-25, 문서만)

PR #11(`fix/ws-contract-gaps`)은 `07372dd`로 머지됐고, 이 세션에서 두 가지를 반영했다.
- R6(낙관적 UI): `error`에 `clientMessageId`가 오면 그 대기 메시지를 바로 `failed`로 바꾸고, 5초 ack 타임아웃은 대비책으로 남긴다. `API_INTEGRATION.md`의 에러 코드 표도 맞췄다.
- R2, `API_INTEGRATION.md`, `ARCHITECTURE.md`, 이 파일의 server-v2 인용을 행 번호 대신 이름으로 바꿨다. R2에는 "연결 중에도 `error`가 오니, 재연결은 1008 직전의 `error`로만 정한다"를 더했다.

R2의 1008 분기는 바뀌지 않는다. PR #11에서도 close는 `reject`의 `POLICY_VIOLATION` 하나이고, 1008은 연결할 때만 온다.

### 3. Phase 3: 그룹, 초대, 임시 방, 자동 삭제

`HANDOFF/DEVELOPMENT_PLAN.md`의 Session 3.1부터 따른다. 먼저 남은 확인 세 가지를 한다.
- 방을 처음 열면 스피너 뒤에 목록과 "대화의 처음입니다"(짧은 방)가 한 번에 뜨는지 본다. `9924639`, `28e295c`가 그리는 시점을 바꿨는데 브라우저로는 아직 보지 않았다.
- 앱 브라우저 창을 띄운 상태(Cmd+Shift+B)에서 방을 위로 스크롤해 이전 페이지가 자동으로 붙는지 본다(2.3의 미확인 항목).
- 실제 한글 IME로 입력하고 Enter를 눌러, 마지막 글자가 잘리거나 두 번 전송되지 않는지 본다.

두 사용자 확인은 한 브라우저로 할 수 없다. 토큰이 탭끼리 공유되고, 다른 탭의 계정 전환을 감지하기 때문이다. 한쪽은 앱 브라우저, 다른 쪽은 Node 스크립트로 WebSocket에 붙는다.
- 2026-10-25에 쓴 스크립트는 `send`, `flood`, `typing`, `read`, `listen` 명령을 받았다.
- 스크립트는 세션 scratchpad에 있어서 다음 세션에는 남지 않는다. 필요하면 같은 방식으로 다시 만든다.

### 4. 세션 종료 직전

**`refresh-context` 스킬 호출** ("최신화" 트리거). Stop hook이 dirty tree 감지 시 자동 안내.

---

## Blockers / decisions needed

| 항목 | 상태 |
|---|---|
| web-v2 재개 | ✅ 2026-10-25 사용자 지시로 재개 |
| Vitest 도입 | ✅ `a1aa484` |
| 백엔드 서비스 URL | 없음. Supabase 생성과 Render 연결은 사용자 계정으로만 할 수 있다 (`MIGRATION.md:175`). URL이 정해지면 Vercel env(`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`)와 백엔드 `FRONTEND_URL`을 함께 바꾼다 |
| D1: Expo 앱을 지금 낼지, 웹 → PWA → Expo 순서를 따를지 | 사용자 결정 대기. `MOBILE_STRATEGY.md`는 이 결정 전에 쓴 초안이다 |
| server-v2 PR #11 | ✅ 머지됨 (`07372dd`). 위 "다음 세션" 2번에서 문서에 반영함 |
| server-v2 PR #12 (S3, S4 문서) | 열림. web-v2 코드에는 영향 없음 |
| `style-src 'unsafe-inline'` | ✅ 유지로 정리 (2026-10-25, 위 "배포 후 발견") |
| CSP가 hydration을 막음 | ✅ nonce + `src/proxy.ts`로 고침 (사용자 선택, 위 "배포 후 발견") |
| 리뷰 MEDIUM: 콜백 링크 출처 확인 | ✅ web-v2 쪽은 `d0a9116` (사용자가 "둘 다" 선택). 서버 쪽 보완은 사용자가 따로 처리 |
| S8, S9, S16 서버 보안 항목 | 사용자가 처리 담당을 정함. 운영 배포 전 처리 권장 |
| 리뷰 LOW-2: Next canonical URL에 hash 잔류 | 남김. 위 "코드 리뷰" 절의 수정 후보를 dev에서 실측한 뒤 적용 |
| Phase 2.1 실측 | ✅ 2.2와 2.3 확인 때 함께 했다 (WS 연결 1개, 다른 사용자의 `new_message` 수신, 서버 재시작 뒤 재연결과 backfill). `MAX_CONNECTIONS` 토스트는 아직 브라우저로 보지 않았다 |
| 다른 탭의 로그아웃과 계정 전환 | ✅ `df2f4f0`. 리뷰 HIGH로 올라와서 고쳤다. 다른 탭이 로그아웃하면 이 탭도 로그아웃되고, 다른 계정으로 로그인하면 이 탭도 그 계정으로 바뀐다 |
| 리뷰 MEDIUM M4: 커서와 커밋 순서 | ✅ 첫 커서를 5초 겹쳐 잡음 (사용자 승인으로 기존 테스트 기대값 수정) |
| Vercel 배포 | `web` 프로젝트가 `geek-chat/web-v2`를 배포한다 (2026-10-25 사용자 결정, ARCHITECTURE.md §5). env는 자리표시 값이라 로그인과 채팅은 백엔드 배포 뒤에 동작한다 |

---

## Important context

### 주요 결정사항

- **백엔드 컨트랙트는 verbatim**: `accessToken`/`refreshToken` (camelCase) — REST DTO. **단, OAuth URL 프래그먼트는 `access_token`/`refresh_token` (snake_case)** — 콜백 페이지에서 변환.
- **단일-플라이트 refresh**: `src/lib/api/client.ts`의 module-level `refreshPromise`. 동시 401 N개가 와도 refresh는 1번. 실패 시 `auth:logout` window event 발사 → AppBoot에서 catch.
- **다크모드**: `<html className="dark">` 고정, Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *))` 등록. next-themes는 M2까지 미도입.
- **i18n**: `src/i18n/ko.ts` flat key/value, `t(key, vars)`가 `{name}` 자리를 채운다. API 에러 문구는 `describeApiError(err, context)`가 HTTP 상태와 호출 맥락으로 고른다 (서버 `error` 필드는 reason phrase라 도메인 코드로 쓸 수 없다).
- **세션**: `src/lib/auth/session.ts`의 `verifySession`과 `startSession`이 스토어 상태를 정한다. 401/403/404만 세션을 끝내고, 그 밖의 실패는 토큰을 남긴 채 `offline`이다.
- **OAuth 콜백**: hash는 `useOAuthHash`로만 읽는다. 일회용 토큰은 컴포넌트 상태에만 둔다.
- **WS 연결**: `ChatConnection`(`(authed)` 레이아웃, `AuthGuard` 안)이 `src/lib/chat/connection.ts`로 클라이언트 하나를 잡고 놓는다. 마지막으로 놓으면 다음 태스크에 닫고 채팅 스토어를 비운다. 재연결 규칙은 `src/lib/ws/client.ts`, 정본은 RULES.md R2.
- **메시지 스토어**: 서버 행은 시각과 id 순, 클라이언트 시각만 있는 행은 끝에 둔다. ack와 `new_message`의 도착 순서와 상관없이 한 행으로 맞춘다 (RULES.md R6).
- **OAuth 흐름 표시**: 버튼을 누를 때 sessionStorage에 10분짜리 표시를 남기고, 콜백은 그 표시가 있을 때만 hash를 쓴 뒤 표시를 지운다 (`src/lib/auth/oauthFlow.ts`). 다른 탭으로 돌아오는 OAuth 흐름은 거절되는데, 이건 감수하기로 한 트레이드오프다.
- **CSP**: 엄격. `script-src 'self'` (no inline/eval), `connect-src` 환경변수만, `frame-ancestors 'none'`.
- **localStorage 토큰 + CSP** 조합으로 XSS 표면 최소화 (RULES.md R5).

### 백엔드 (참고만, 수정 절대 금지)

위치: `~/Work/geek-chat/geek-chat-server-v2/` (멀티 모듈. 남은 행 번호는 `0ccf5c2` 기준이고 `07372dd`에서도 그대로다. websocket 모듈은 행이 자주 밀려서 이름으로 적는다)
- `auth/.../presentation/web/AuthController.kt`: OAuth 콜백 리다이렉트 조립은 100-126행 (에러 4종, hash 3종)
- `AuthDto.kt`: 모든 DTO (camelCase)
- `ChatErrorMapping.kt`: HTTP 상태 코드 매핑
- `websocket/.../infrastructure/config/WebSocketConfig.kt`: `/ws` 경로, 허용 Origin은 `setAllowedOrigins(appProperties.frontendUrl)` 하나
- `websocket/.../infrastructure/WebSocketSessionManager.kt`: `MAX_CONNECTIONS_PER_USER = 3`, `MIN_CONNECTION_INTERVAL_MS = 2000L`
- `user/.../presentation/web/UserController.kt`: `PATCH /api/users/me/username` (`{username}` 요청, `{username}` 응답)
- `common/.../presentation/web/ChatErrorMapping.kt`: 에러 본문의 `error`는 HTTP reason phrase (S7)
- `websocket/.../presentation/ChatWebSocketHandler.kt`: `afterConnectionEstablished`가 연결 거부 5가지를 검사하고 모두 `reject`에서 close 1008. `sendError`는 `clientMessageId`를 실을 수 있다 (PR #11)

### refresh-context 스킬

세션 종료 직전 또는 컨텍스트 압축 직전에:
- 트리거 키워드: "최신화", "refresh-context", "/refresh-context", "핸드오프"
- 자동: Stop hook (`.claude/hooks/refresh-context-reminder.sh`)이 dirty tree에서 안내 메시지 출력 (exit 0)
- 수동 인벤토리: `bash .claude/skills/refresh-context/update.sh`

### Worktree 정보

- 위치: 앱이 만든 worktree (`.claude/worktrees/<이름>`). 이름은 재활용될 때마다 바뀌니 `git rev-parse --show-toplevel`로 확인한다.
- 브랜치: `claude/fervent-bell-35addf`. 메인 체크아웃(`~/Work/geek-chat/geek-chat-web-v2`)의 `main`에 fast-forward로 반영한 뒤 `origin`(`geek-chat/web-v2`, 공개 저장소)에 push한다.
- 2026-10-25 세션에서는 사용자가 git 명령(병합, push 포함)을 에이전트에게 맡겼다 ("git 명령어 전부 승인할게 너가 해"). 이 승인은 그 세션 한정이라, 다음 세션에서 push하기 전에는 다시 확인받는다.
- 공개 저장소라서 고쳐지지 않은 서버 보안 문제의 상세(S8, S9, S16)는 문서와 커밋 메시지에 쓰지 않는다.

---

## 한 줄 요약

> **web-v2는 Phase 1(인증)과 Phase 2(WS, 방 목록, 채팅 화면)를 마쳤고 다음은 Phase 3(그룹, 초대, 임시 방, 자동 삭제)이다. 운영은 Vercel `web` 프로젝트(자리표시 env)에 올라가 있다. 환경 복구 → 기준선 확인 → 로컬 백엔드(위 "로컬 백엔드 띄우는 법") → 2.3 미확인 세 항목 → Phase 3 순서로 진행한다. 끝날 때 refresh-context 스킬 호출 필수.**
