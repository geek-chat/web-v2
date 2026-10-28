# Session Progress — last updated 2026-10-28

> **다음 세션 진입자에게**: 이 파일이 첫 진입점입니다. 5분 안에 컨텍스트를 잡고 이어 작업하세요.

---

## Current state (one-liner)

**server-v2 `bf2c85d` 계약 반영 (2026-10-28)**: 운영에서 웹소켓 거부 처리가 돌지 않던 버그를 고쳤고(오류 프레임으로 판단), `connected`, `lastReadAt`, `clientMessageId`, `ACCOUNT_WITHDRAWN`을 반영했다. 아래 "2026-10-28" 절에 있다.

**디자인 시스템 완료 (2026-10-26)**: 드롭다운 칸이 입력칸과 어긋난 일을 계기로, 버튼과 폼 요소를 `src/components/ui/`의 공용 컴포넌트로만 쓰게 만들었다(사용자 선택: "자체 공용 컴포넌트 + lint 가드, 단계별"). 네 단계를 모두 커밋했고, 이제 그 밖에서 날 `<button>`, `<input>`, `<select>`, `<textarea>`를 쓰면 lint가 막는다(RULES.md R7). push는 운영 배포로 이어지므로 늘 사용자 승인을 받고 한다(`git log origin/main..HEAD`가 비어 있지 않으면 올리지 않은 커밋이 있다).

**Phase 3 완료 (2026-10-25)**: 초대 링크(만들기, 참여 화면, 로그인 뒤 돌아오기), 초대로 들어온 멤버의 이름 갱신, 임시 방과 자동 삭제 메시지의 남은 시간이 들어갔고, 로컬 백엔드로 5명(Alice, Bob, Carol, Dave, Erin) 확인까지 했다. Phase 1(인증)과 Phase 2(WS, 방 목록, 채팅 화면)는 앞서 마쳤다. 다음은 `DEVELOPMENT_PLAN.md`의 "출시 전 체크리스트"다. 사용자가 2026-10-25에 web-v2 재개를 지시해서(선택지 "지금 시작 + Vitest") 10-24부터의 보류를 풀었다. server-v2는 2026-10-25 Render(`https://geek-chat-server-api.onrender.com`)에 올라갔고, 운영 웹(`https://web-lac-one-89.vercel.app`)이 그 백엔드를 쓴다. Render는 이 운영 도메인만 받으므로(localhost Origin은 WS 403) 개발과 두 사용자 확인은 계속 로컬 백엔드로 한다.

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
| tailwind-merge | 3.7.0 (2026-10-26 도입, `src/lib/cn.ts`. 지원 범위는 Tailwind v4.0~v4.3) |
| vitest | 5.0.5 (jsdom 30.1.3, @testing-library/react 16.3.3, @vitejs/plugin-react 6.1.2) |
| @types/node | 24.19.2 (vitest 5의 peer 요구, 로컬 런타임 Node 24.21에 맞춤) |

---

## 2026-10-28 server-v2 `bf2c85d` 계약 반영

server-v2 세션이 PR #18~#24가 운영에 올라갔다고 알려 왔다(`bf2c85d`, 2026-10-26 02:09 KST). 계약은 `bf2c85d` 코드에서 확인했고, 사용자가 네 묶음을 모두 반영하기로 했다("1~4 모두").

### 운영에서 찾은 버그

운영 웹 페이지에서 토큰 없이 연결해 쟀다. 오류 프레임(`NO_TOKEN`)은 0.45초에 오는데 close는 20.45초 뒤 1006(`wasClean: false`)이었다. 오류 직후 클라이언트가 닫으면 0.6초에 1000으로 끝났다. 클라이언트는 close가 1008일 때만 거부 코드를 봐서, 운영에서는 거부 분기가 전혀 돌지 않았다. `MAX_CONNECTIONS`는 토스트 없이 재연결을 반복했고, `INVALID_TOKEN`은 세션을 끝내지 않고 재시도했고, `TOKEN_EXPIRED`는 20초를 기다렸다. server-v2는 원인을 운영 경로(Cloudflare → Render)로 보고 server-v2#25에 기록했다.

### 커밋

| 커밋 | 내용 |
|---|---|
| `837a81d` | 연결 수준 오류 프레임을 받으면 바로 닫고 그 코드로 판단한다. `ACCOUNT_WITHDRAWN`은 재연결 없이 세션을 끝낸다. 프레임 없는 1008은 refresh 한 번, 그 밖의 close(1006, 4500, 1011)는 백오프. RULES R2 |
| `9f24adf` | `connected` 프레임을 수락 신호로 쓴다. 안정 판정(백오프 초기화)에는 넣지 않는다. 1초 창은 이전 서버용 대비책. RULES R2 |
| `78ee4fc` | `GET /api/rooms` 멤버의 `lastReadAt`으로 읽음 표시를 시작한다(앞으로만). RULES R6 |
| `bdf702e` | REST 메시지의 `clientMessageId`로, ack를 잃은 대기 행이나 실패 행을 서버 행으로 합친다. RULES R6 |
| `2543590` | 내 탭에서 탈퇴할 때 `ACCOUNT_WITHDRAWN` 프레임이 탈퇴 응답보다 먼저 오면 "세션 만료"와 "탈퇴 완료" 토스트가 겹치던 경쟁(`837a81d`가 만듦). 두 토스트가 같은 id(`lib/auth/notices.ts`의 `SESSION_ENDED_TOAST_ID`)를 써서 나중 것이 앞의 것을 덮는다 |
| `4057be0` | `events.test`의 기존 케이스 제목만 "accepts only the connection-level codes"로 바꿨다(코드가 여섯 개가 됨, 사용자 승인) |

새 필드(`lastReadAt`, `clientMessageId`)는 스키마에서 없어도 되게 받는다. 기존 테스트 픽스처에 없고, 서버가 예전 버전이면 목록 전체가 파싱에 실패하기 때문이다. 기존 테스트는 고치지 않았다.

### 검증

- 묶음마다 `memguard -- npm test`, tsc, lint, build 모두 exit 0이었다(토스트 수정 뒤 마지막 53개 파일, 322개 테스트).
- 새 테스트는 바뀐 코드를 되돌리면 실패하는 것을 확인했다. 옛 `client.ts`에서는 거부 테스트 3개, `connected`가 백오프를 초기화하게 바꾸면 백오프 테스트, 합치기를 끄면 합치기 테스트 2개, 탈퇴 토스트의 id를 빼면 그 테스트가 실패했다.
- 로컬 server-v2 `bf2c85d`(scratchpad에서 빌드)로 앱 화면을 확인했다.

| 항목 | 결과 |
|---|---|
| `connected` | 서버가 수락 직후 보낸다. dev 콘솔에 버린 프레임 경고가 없다(콘솔 기록은 양성 대조로 확인) |
| 읽음 표시 시작값 | 밥이 읽은 뒤 새로 고쳐도 "1명 읽음"이 바로 보인다 |
| `MAX_CONNECTIONS` | 연결 3개를 붙잡고 브라우저를 붙이자 토스트와 "다시 시도"가 떴다. 서버의 거부 기록은 1번뿐(재연결 반복 없음). 붙잡은 연결이 닫힌 뒤 "다시 시도"로 다시 붙었다 |
| `ACCOUNT_WITHDRAWN` | 시험 사용자 Wanda를 탈퇴시키자 열린 탭이 3초 안에 `/login`으로 갔고 토큰이 지워졌다. 재연결은 없었고, 그 사이 REST 요청도 없었다(웹소켓 경로로 끝남) |

확인하지 못한 것: 운영 앱에서의 거부 처리(운영 로그인을 하지 않으므로 단위 테스트와 운영 원시 측정뿐), ack 유실 합치기와 내 탭 탈퇴 토스트 경쟁의 앱 화면(둘 다 단위 테스트만).

### 서버 쪽 남은 것

- `POST /api/rooms`와 `POST /api/invite/{code}/join`은 `CreateRoomResponse`(멤버는 `userId`, `nickname`)를 돌려줘서 `lastReadAt`이 없다. server-v2 세션이 처음엔 세 곳 모두 있다고 알렸는데, web-v2가 코드로 확인해 알리자 문서를 고쳤다(server-v2#25, `f3985ca`). 응답은 바꾸지 않는다. web-v2는 참여 뒤 목록을 다시 받아서 영향이 없다.
- 탈퇴 사용자 표시: 서버는 닉네임을 `deleted_user_<7hex>`로 바꾸는데, 일반 사용자도 같은 모양의 닉네임을 정할 수 있다(`@Size(1..20)`만 검사). 사용자가 명시 필드를 두기로 정했다(server-v2 세션이 전달, 2026-10-28). 멤버 객체(`GET /api/rooms`, `POST /api/rooms`, `POST /api/invite/{code}/join`)에 `withdrawn: Boolean`, 메시지(`GET /api/rooms/{id}/messages`)에 `senderWithdrawn: Boolean`이 생기고, WS 이벤트에는 넣지 않는다(탈퇴한 사용자는 연결이 거부됨). server-v2가 작업 중이고 배포되면 알려 오기로 했다. 그때까지 web-v2는 서버 값을 그대로 보인다.

---

## 2026-10-26 디자인 시스템

### 왜

`<select>`를 쓰는 곳마다 클래스를 따로 적어서, 드롭다운이 입력칸과 높이, 안쪽 여백, 테두리가 달랐고 브라우저 기본 화살표가 테두리에 붙었다. 사용자가 앞으로 이런 실수를 구조로 막는 방법을 요청했고, 선택지 중 "자체 공용 컴포넌트 + lint 가드, 단계별"을 골랐다. Storybook과 스크린샷 비교는 다음 층으로 미뤘다.

### 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 새 의존성 없이 `ui/Select`, `ui/Textarea`와 공통 모양(`ui/control.ts`의 `CONTROL`, `CONTROL_HEIGHT`)을 만들고, 드롭다운 2곳(`MessageInput`, `CreateRoomForm`)과 메시지 입력칸을 바꾼다 | ✅ `92cf89e` |
| 2 | tailwind-merge 하나만 들여 `cn()`(`src/lib/cn.ts`)을 만들고 공용 컴포넌트 4개(Button, Input, Select, Textarea)에 쓴다. 테마 토큰이 합쳐지는 결과를 단위 테스트로 고정하고 네이버 버튼의 `!`를 뺀다 | ✅ `150e5b4` |
| 3 | 남은 날 요소 4곳을 공용 컴포넌트로 바꾼다. Button 모양이 안 맞는 검색 결과 줄, 선택 칩, 다시 보내기 링크는 새 `ui/ButtonBase`(모양 없이 `type="button"` 기본값, focus ring, disabled 커서만)로, `InvitePanel`의 주소 칸은 `Input`으로 옮긴다(Input의 `className`이 Select처럼 바깥 상자를 가리키게 바꾸고, 그 줄은 md 높이). 개발 모드 전용 갤러리 `/dev/ui`를 만든다(운영은 `notFound()`) | ✅ `a203b66`, `3b1617f`, `b661f98` |
| 4 | ESLint `no-restricted-syntax`로 `src/components/ui/**` 밖(테스트 제외)의 `button`, `input`, `select`, `textarea` JSX를 막는다. RULES R7, `COMPONENTS.md` §3, ARCHITECTURE 폴더 구조를 고친다 | ✅ `f7357a6` |

### 커밋

| 커밋 | 내용 |
|---|---|
| `552dd87` | 에러 문구 두 가지. 초대 참여의 400은 "Room is full"일 때만 정원 초과이고, 나머지(S18 전에 1:1 방에서 만든 링크)는 쓸 수 없는 링크로 본다. 가입 400은 도메인의 WeakPassword와 필드 검사(`password: …`, S10 뒤 형식)를 모두 비밀번호 문구로 보인다 |
| `92cf89e` | 1단계 |
| `150e5b4` | 2단계. 공용 컴포넌트 4개가 `cn()`으로 클래스를 합치고, 네이버 버튼의 `!`를 뺐다(secondary의 hover 테두리도 `enabled:hover:border-transparent`로 지운다) |
| `a203b66` | 3단계. `ui/ButtonBase`와 `control.ts`의 `FOCUS_RING`. Button이 ButtonBase 위에 서고, 검색 결과 줄, 선택 칩, 다시 보내기가 원래 클래스 그대로 ButtonBase를 쓴다(다시 보내기만 `rounded-sm` 추가) |
| `3b1617f` | 3단계. Input의 `className`이 바깥 상자를 가리킨다(전에 넘기던 호출부는 0곳, `src`의 tsx를 TypeScript 파서로 훑어 확인). 초대 패널의 주소 칸이 Input이 되고 복사 버튼과 md 높이로 맞춘다 |
| `b661f98` | 3단계. `/dev/ui` 갤러리 |
| `f7357a6` | 4단계. lint 가드 |

2단계 검증: `memguard -- npm test`(49개 파일, 299개 테스트), tsc, lint, build 모두 exit 0. 개발 서버 `/signup`에서 계산된 색을 쟀다. 네이버는 쉴 때 `#03c75a`, hover `#02a94c`, 테두리는 둘 다 투명, 글자 흰색. Google은 `#18181b`, hover `#27272a`에 회색 반투명 테두리. primary는 `#818cf8`, hover `#a5b4fc`. 페이지에 `!` 클래스는 없고 CSP 오류도 없었다.

3, 4단계 검증: `memguard -- npm test`(52개 파일, 304개 테스트), tsc, lint, build 모두 exit 0. ButtonBase 테스트는 `type` 기본값을 빼면 폼이 제출되어 실패하는 것을 확인했다. lint 가드는 네 요소를 하나씩 넣은 임시 파일에서 오류 4건, 테스트 파일의 날 `<button>`에서 0건이었고, 두 파일은 지웠다. 운영 빌드(`npm run start`)에서 `/dev/ui`는 404, `/login`은 200. 개발 서버의 `/dev/ui`에서 한 줄에 놓인 Select, Input, md Button이 모두 40px로 위아래가 맞았다. 로컬 server-v2(`07372dd`)로 앱 화면도 쟀다. 초대 패널의 주소 칸과 복사 버튼은 둘 다 40px로 같은 줄, 검색 결과 줄은 48px에 왼쪽 정렬과 굵기 400 그대로, 선택 칩은 28px 둥근 모양 그대로, 다시 보내기는 16px 높이에 12px 빨간 밑줄 글자였다. 키보드 focus ring은 클래스만 확인했고 눈으로는 보지 않았다.

### 결정 기록: tailwind-merge (env-intake)

- 날짜: 2026-10-26
- 무엇: tailwind-merge 3.7.0, 들이기
- 왜: Tailwind는 같은 속성의 유틸리티를 클래스 순서가 아니라 이름 순으로 내보낸다. 공용 컴포넌트가 variant 클래스 뒤에 호출한 쪽 `className`을 이어 붙이기만 하면 호출한 쪽이 질 수 있다(네이버 버튼이 secondary의 회색으로 보여서 `!`로 막아 두었다). 버린 대안: `!` 유지(덮을 때마다 기억해야 한다), variant에서 색을 빼고 호출부가 모두 적기(같은 실수가 돌아온다), 직접 만든 병합 함수(토큰 분류를 새로 짜야 한다)
- 선언: `package.json`의 `"tailwind-merge": "^3.7.0"`, 층은 프로젝트. lock에는 이 패키지 하나만 더해졌다
- 감시: `src/lib/cn.test.ts`가 이 테마 토큰의 병합 결과를 고정하고, `src/components/auth/OAuthButtons.test.tsx`가 네이버 버튼에 variant 색이 남지 않는지 본다. 둘 다 `cn`을 그냥 이어 붙이기로 바꾸면 실패하는 것을 확인했다. CI는 없어서 `npm test`가 유일한 감시다
- 지원 범위: tailwind-merge 3.x는 Tailwind v4.0~v4.3을 지원한다(패키지 README). Tailwind를 그 너머로 올리기 전에 다시 확인한다
- 되돌리기: `npm uninstall tailwind-merge`와 2단계 커밋 revert(네이버 버튼의 `!`도 함께 돌아온다)

### server-v2 세션이 예고한 계약 (2026-10-28에 모두 반영, 위 절)

| 항목 | 예고 | 머지되면 web-v2가 할 일 |
|---|---|---|
| S11 | `message_expired`, `room_expired`를 커밋 뒤에 보낸다 | 없음. tombstone은 그대로 둔다 |
| S12 | `MessageResponse.clientMessageId` | REST 행과 failed 행을 `clientMessageId`로 한 행으로 맞춘다 |
| S13 | 연결을 받으면 `{type:"connected", data:{userId, roomIds}}` | `connected`를 수락 신호로 쓴다(`lib/ws/events.ts`에 추가). 지금은 모르는 type을 버리고 1초 창으로 수락을 추정한다 |
| S14 | 탈퇴하면 서버가 그 사용자의 소켓을 닫는다. heartbeat는 미정 | 닫힐 때의 코드와 `error.code`를 확인해 R2 표에 넣는다 |
| S15 | `RoomMemberResponse.lastReadAt` (문자열 또는 null) | 방을 열 때 읽음 표시를 이 값으로 시작한다 |
| S19 | server-v2 PR #18 (동시 참여) | 없음 예상. 오류 응답이 바뀌면 `describeApiError`의 `invite` 맥락을 확인한다 |

---

## 2026-10-25 Phase 3 결과

### 커밋

| 커밋 | 내용 |
|---|---|
| `e4f08a7` | 초대 API(`lib/api/invite.ts`), `/invite/[code]` 참여 화면(`JoinInvite`), 로그인 뒤 초대 화면으로 돌아오기(`lib/auth/returnPath.ts`, `AuthGuard`), `describeApiError`의 `invite` 맥락 |
| `b08dd2d` | 그룹 방 헤더의 초대 패널(`InvitePanel`), 모르는 보낸 사람이 오면 목록을 한 번 다시 받기(`touchRoom`의 `senderId`) |
| `52b28cd` | 남은 시간 표시: 자동 삭제 메시지, 임시 방(목록 배지, 헤더 줄, 마지막 10분 카운트다운 배너). `hooks/useNow.ts`, `lib/time.ts` |

### 계획과 달라진 점
- 참여는 버튼을 눌러야 한다(계획은 "mount 시 자동 join"). 링크를 열기만 해도 방에 들어가지는 일을 막고, 개발 모드에서 effect가 두 번 돌아 POST가 두 번 나가는 문제도 피한다. 서버에 미리보기 API가 없어서 방 이름은 보여 줄 수 없다.
- 초대 UI는 모달이 아니라 헤더 아래 펼침 패널이다(jsdom에 `<dialog>`의 `showModal`이 없음). 그룹 방에서만 보인다(S18).
- 그룹 표시(목록과 헤더의 멤버 수, 만료 배지)는 2.2에서 이미 들어가 있었다.

### 설계 근거 (server-v2 main `491247a`, 코드는 `07372dd`와 같음)

| 사실 | 근거 | 반영 |
|---|---|---|
| 링크 만들기는 방 존재와 호출자 멤버십만 보고 방 종류는 보지 않는다 | `InviteLinkService.createInviteLink` | 그룹 방에서만 초대 UI, S18 보고 |
| 코드는 영문 대소문자와 숫자 8자 | `InviteLink.generateCode` | 형식이 다르면 API를 부르지 않고, 경로는 `encodeURIComponent` |
| 참여 오류는 404(없음), 410(만료나 사용 횟수 초과), 409(이미 멤버, 본문에 방 id 없음), 400(정원 초과) | `joinByInviteCode`, `ChatErrorMapping` | 문구마다 처리하고 409는 목록으로 안내 |
| 참여를 다른 멤버에게 알리지 않고, `new_message`에는 보낸 사람 이름이 없다 | `ChatEventListener.onRoomMemberJoined`, `lib/ws/events.ts` | 모르는 보낸 사람이면 목록을 방과 사람마다 한 번 다시 받는다 |
| 방 만료는 10분마다(시작 직후 한 번) 확인하고 경고는 `now < expiresAt ≤ now+10분`에 한 번 보낸다. 메시지 만료는 1분마다 | `RoomExpirationScheduler`, `MessageExpirationScheduler` | 남은 시간 표시는 `expiresAt`으로도 바뀌고, 지우는 것은 서버 이벤트만 한다 |

### 검증 (2026-10-25)

단위마다 `memguard -- npm test`, tsc, lint, build를 돌려 모두 exit 0이었다(마지막 단위에서 46개 파일, 287개 테스트). AuthGuard의 새 테스트는 이전 코드에서 실패하는 것을 먼저 확인했다.

로컬 server-v2(`07372dd`, local 프로필)를 앱 브라우저와 Node 스크립트로 확인했다. 시험용으로 만든 방 두 개의 `expires_at`은 로컬 DB에서 다음 스케줄러 틱에 맞게 바꿨다.

| 항목 | 결과 |
|---|---|
| 방 목록의 남은 시간 | ✅ "15분 남음", 10분 안이면 "곧 만료", TTL 없는 방은 표시 없음 |
| 초대 패널 | ✅ 링크 만들기, 전체 주소와 만료 시각(24시간), 복사 |
| 초대로 들어온 사람의 메시지 | ✅ Carol이 API로 참여한 뒤 보낸 메시지가 Alice 화면에 "Carol"로 보이고, 헤더가 3명으로 바뀜 |
| 자동 삭제 메시지 | ✅ "29초 후 사라짐", 마감 뒤 "곧 사라짐"(행은 남음), 서버 틱(13:24:02Z) 뒤 Alice 화면에서 사라짐. Bob 스크립트도 같은 id의 `message_expired`를 받음 |
| 임시 방 카운트다운 배너 | ✅ "이 방은 3:20 뒤 만료됩니다"에서 줄어듦 |
| `room_expired` | ✅ 그 방에 있던 Alice가 `/rooms`로 이동, 알림, 목록에서 사라짐 |
| `room_expiring` | ✅ 알림 "'P3 경고 방' 방이 오후 10:36에 만료됩니다", 목록 배지 "곧 만료" |
| 참여 화면 | ✅ 누르기 전에는 참여하지 않음. Dave가 누르자 방으로 이동(4명), Dave의 메시지와 타이핑이 Carol 스크립트에 도착 |
| 이미 멤버(409) | ✅ 안내 문구가 뜨고 버튼이 사라짐 |
| 로그인 뒤 돌아오기 | ✅ 로그아웃 상태로 초대 링크를 열면 `/login`, 저장된 경로는 `/invite/<code>`. 로그인한 상태로 `/rooms`에 도착하자 초대 화면으로 돌아가고 저장값은 지워짐 |
| 경고 방의 `room_expired`(13:40 틱) | 보지 않음. 같은 경로를 만료 방(13:30 틱)으로 확인했다 |
| 로그인 폼을 거친 돌아오기 | dev-login 토큰을 넣고 `/rooms`로 이동해 같은 지점을 확인했다. 폼과 OAuth는 모두 `/rooms`로 끝난다 |

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

## 2026-10-25 운영 연결 뒤

| 항목 | 내용 |
|---|---|
| 운영 연결 | Vercel Production env를 Render(server-v2)로 바꾸고 재배포. 사용자가 Naver 로그인과 채팅을 운영에서 확인했다. Google은 S17로 막혀 있다 |
| 버튼 커서와 hover (`2c618bd`) | Tailwind v4 preflight는 버튼에 기본 화살표 커서를 둔다. `globals.css` base 층에서 활성 `button`, `[role=button]`, `select`에 pointer를 준다. hover는 활성 버튼에만, 눈에 띄는 색으로(primary는 `--primary-hover`). 네이버 버튼이 variant의 회색으로 그려지던 버그도 고쳤다(같은 속성 유틸리티는 이름순이라 `bg-muted`가 이김, `!`로 덮어씀). 운영에서 계산값 확인 |
| server-v2와 협업 | 사용자 지시(2026-10-25)로 server-v2 작업은 "Migrate GeekChat server to Kotlin Spring Boot" 세션이 맡는다. 서버 문제는 그 세션에 SendMessage로 넘기고, 이 저장소에서는 server-v2를 고치지 않는다. 넘긴 것: S17, S10, S16(상세는 메시지에만), S11~S15 |

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
| S16 | server-v2 | 보안 항목 1건. 2026-10-25에 사용자에게 직접 보고했다. 같은 이유로 상세는 적지 않는다. server-v2#16(`185fad0`)으로 고쳐져 2026-10-25 15:18Z 운영에 배포됐다 |
| S10 | server-v2 `SecurityConfig.securityFilterChain` | `/error`가 허용 목록에 없고 entry point가 본문 없는 401을 돌려준다. 그래서 공개 엔드포인트의 bean validation 실패(400)가 401로 바뀌어 보일 수 있다 (설정 기준, 실측 전). web-v2는 서버와 같은 검증을 폼에서 먼저 해서 영향이 작다. 2026-10-25 운영에서 실측(`GET /auth/login`이 405 대신 401). server-v2#14로 고쳐 운영에 배포됐다(2026-10-25, `GET /auth/login`이 405). 이제 400, 404, 405는 `{statusCode, message, error}`, 500과 403은 Spring 기본 본문으로 나온다. web-v2는 바꿀 것이 없음을 코드로 확인했다(`readErrorBody`가 계약 밖 본문을 버림) |
| S11 | server-v2 `ChatEventListener.onMessageExpired`, `MessageExpirationScheduler` | 스케줄러가 `@Transactional` 안에서 이벤트를 내고 리스너는 `@Async @EventListener`라서, `message_expired`가 삭제 커밋보다 먼저 나갈 수 있다. 그 사이 REST가 지운 메시지를 돌려준다. web-v2는 tombstone으로 막았다. `AFTER_COMMIT`으로 바꾸면 근본 해결 server-v2 `bf2c85d`부터 삭제 커밋 뒤에 보낸다. tombstone은 그대로 둔다. |
| S12 | server-v2 `MessageResponse` (`MessageDto.kt`) | `clientMessageId`가 없어서 ack를 잃은 메시지를 REST 행과 맞출 수 없다. failed 행과 서버 행이 함께 보인다 `bf2c85d`로 REST 메시지에 들어왔고 web-v2 `bdf702e`에서 반영했다. |
| S13 | server-v2 `ChatWebSocketHandler.afterConnectionEstablished` | 연결을 받아들여도 아무 프레임을 보내지 않아서, 클라이언트는 1초 동안 거부가 없으면 수락으로 본다. `connected` 같은 프레임이 있으면 추정할 필요가 없다 `bf2c85d`로 `connected` 프레임이 생겼고 web-v2 `9f24adf`에서 반영했다. |
| S14 | server-v2 websocket 모듈 | 로그아웃과 탈퇴 때 그 사용자의 소켓을 닫지 않는다(닫는 곳은 `reject` 하나). heartbeat 설정도 없어서 끊긴 연결이 열린 것처럼 남을 수 있다. 배포 환경 프록시의 idle timeout도 확인이 필요하다 `bf2c85d`로 탈퇴 때 `ACCOUNT_WITHDRAWN`을 보내고 닫으며, 25초 ping과 60초 무응답 4500 heartbeat가 생겼다. web-v2 `837a81d`에서 반영했다. |
| S15 | server-v2 `RoomMemberResponse`, 방 목록 API | 멤버의 읽음 시각(`lastReadAt`)을 주는 REST가 없다. 새로 연 화면은 접속 뒤 `read_update`가 올 때까지 읽음 표시를 그릴 수 없다 `bf2c85d`로 `GET /api/rooms` 멤버에 들어왔고(만들기와 참여 응답에는 없음) web-v2 `78ee4fc`에서 반영했다. |
| S17 | server-v2 `AuthController.googleStart` | `scope`에 공백이 든 `"openid email profile"`을 넣고 `.build(true)`로 만들어서 `IllegalArgumentException`이 난다. `/error`가 막혀 있어서(S10) 응답은 본문 없는 401이다. 2026-10-25 Render에서 `/auth/google`은 401, `/auth/naver`는 302였고, Spring 7.0.9 jshell로 예외를 재현했다. `.encode().build()`로 바꾸면 생성된다. 이 경로의 테스트가 없다. server-v2#15로 고쳐 운영에 배포됐다. 2026-10-25 13:13Z 뒤로 `/auth/google`이 302로 `accounts.google.com`에 보낸다(client_id 있음, redirect_uri는 Render 콜백, scope 인코딩됨). 그 전 몇 분은 #14만 떠 있어서 같은 예외가 500 Whitelabel 페이지로 보였다. Google 로그인 끝까지는 사용자가 확인한다 |
| S18 | server-v2 `InviteLinkService` | 초대 링크가 GROUP 방으로 제한되지 않는다. 링크는 그 방 멤버만 만들 수 있지만, 1:1 방 멤버가 만들면 세 번째 사람이 그 1:1 방에 들어올 수 있다. web-v2는 그룹 방에서만 초대 UI를 띄운다. server-v2#17(`d623483`)로 고쳐져 2026-10-25 15:24Z 운영에 배포됐다. 이제 1:1 방에서 만들면 400 "Invite links are only available for group rooms"이고, 그 전에 만든 1:1 방 링크로 참여하면 web-v2는 쓸 수 없는 링크로 안내한다(`552dd87`) |
| S19 | server-v2 `InviteLinkService.joinByInviteCode` | 확인한 뒤 넣는 방식이라 락이 없어서, 동시에 참여하면 `maxUses`나 정원을 넘을 수 있다(낮음). server-v2 PR #18로 운영에 반영됐다(`bf2c85d`) |
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

없음. 2026-10-28 계약 반영은 `837a81d`, `9f24adf`, `78ee4fc`, `bdf702e`와 그 문서 커밋으로 끝났다. 올라갔는지는 `git log origin/main..HEAD`로 본다(비어 있으면 올라간 것). 디자인 시스템 네 단계는 `92cf89e`부터 `f7357a6`까지로 끝나 2026-10-26에 올라갔다(`83f5baf`).

Phase 3은 `e4f08a7`, `b08dd2d`, `52b28cd`와 문서 커밋으로 끝났다.

---

## Next session — start here

> 지금 할 일: `git log origin/main..HEAD`가 비어 있지 않으면 push 승인부터 받는다 → 아래 3번(남은 확인과 출시 전 체크리스트). server-v2가 `withdrawn`, `senderWithdrawn` 필드를 배포했다고 알려 오면 탈퇴한 사람을 "탈퇴한 사용자"로 보이게 한다(위 2026-10-28 절). 새 화면에 버튼이나 폼 요소가 필요하면 `src/components/ui/`부터 본다(RULES.md R7, `/dev/ui`).

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

### 3. 출시 전 체크리스트

`HANDOFF/DEVELOPMENT_PLAN.md`의 "출시 전 체크리스트"를 따른다. 그 전에 남은 확인이 있다.
- 2.3의 "처음 열 때 한 번에 그리기"는 사용자가 운영에서 짧은 방을 열어 "대화의 처음입니다"가 뜬 화면을 보내 줘서 확인됐다(2026-10-25).
- 앱 브라우저 창을 띄운 상태(Cmd+Shift+B)에서 긴 방을 위로 스크롤해 이전 페이지가 자동으로 붙는지 본다(2.3의 미확인 항목).
- 실제 한글 IME로 입력하고 Enter를 눌러 마지막 글자가 잘리거나 두 번 전송되지 않는지 본다. 사용자가 운영에서 한글 메시지를 보냈지만 Enter로 보냈는지는 확인하지 않았다.
- Google 로그인을 운영에서 끝까지 해 본다(S17 배포 뒤, 사용자가 직접).

여러 사용자 확인은 한 브라우저로 할 수 없다. 토큰이 탭끼리 공유되고, 다른 탭의 계정 전환을 감지하기 때문이다. 한 사람은 앱 브라우저, 나머지는 Node 스크립트로 붙는다.
- 2026-10-25 Phase 3에 쓴 스크립트는 `login <이름>`(dev-login, 토큰 파일 저장), `api <이름> <METHOD> <경로> [json]`, `ws <이름> <roomId> send <text> [--ttl=N] [--listen=S]`, `ws ... listen`을 받았다.
- 브라우저 사용자를 바꿀 때는 페이지에서 `fetch('http://localhost:8080/auth/dev-login?name=…')`로 토큰을 받아 localStorage에 넣고 다시 연다. 토큰을 코드에 붙여 넣지 않는다.
- 스크립트는 세션 scratchpad에 있어서 다음 세션에는 남지 않는다. 필요하면 같은 방식으로 다시 만든다.
- 방 만료를 보려면 로컬 DB(`docker exec geekchat-dev-postgres psql -U geekchat -d geekchat`)에서 직접 만든 시험 방의 `chat_room.expires_at`만 바꾸고, 10분 틱을 기다린다. 첫 틱은 서버 시작 직후라 클라이언트가 못 받는다.

### 4. 세션 종료 직전

**`refresh-context` 스킬 호출** ("최신화" 트리거). Stop hook이 dirty tree 감지 시 자동 안내.

---

## Blockers / decisions needed

| 항목 | 상태 |
|---|---|
| web-v2 재개 | ✅ 2026-10-25 사용자 지시로 재개 |
| Vitest 도입 | ✅ `a1aa484` |
| 백엔드 서비스 URL | ✅ `https://geek-chat-server-api.onrender.com` (server-v2 `docs/DEPLOY-RENDER.md`, 기존 Render 서비스를 그 자리에서 v2로 전환). 2026-10-25 확인: `/health`가 `"db":"connected"`, Vercel 출처의 CORS와 WS(101) 허용, 토큰 없는 `/api/rooms`는 401. 무료 플랜이라 15분 쉬면 잠들고 첫 요청은 JVM 시작을 기다린다(문서 측정 3~4분) |
| D1: Expo 앱을 지금 낼지, 웹 → PWA → Expo 순서를 따를지 | 사용자 결정 대기. `MOBILE_STRATEGY.md`는 이 결정 전에 쓴 초안이다 |
| server-v2 PR #11 | ✅ 머지됨 (`07372dd`). 위 "다음 세션" 2번에서 문서에 반영함 |
| server-v2 PR #12 (S3, S4 문서) | 열림. web-v2 코드에는 영향 없음 |
| `style-src 'unsafe-inline'` | ✅ 유지로 정리 (2026-10-25, 위 "배포 후 발견") |
| CSP가 hydration을 막음 | ✅ nonce + `src/proxy.ts`로 고침 (사용자 선택, 위 "배포 후 발견") |
| 리뷰 MEDIUM: 콜백 링크 출처 확인 | ✅ web-v2 쪽은 `d0a9116` (사용자가 "둘 다" 선택). 서버 쪽 보완은 사용자가 따로 처리 |
| S8, S9 서버 보안 항목 | 사용자가 처리 담당을 정함. 운영 배포 전 처리 권장. S16은 2026-10-25에 고쳐져 배포됨 |
| S18 그룹 전용 초대 | ✅ server-v2#17 운영 배포(2026-10-25 15:24Z). web-v2는 `552dd87`에서 참여 400 문구만 맞췄다 |
| 리뷰 LOW-2: Next canonical URL에 hash 잔류 | 남김. 위 "코드 리뷰" 절의 수정 후보를 dev에서 실측한 뒤 적용 |
| Phase 2.1 실측 | ✅ 2.2와 2.3 확인 때 함께 했다 (WS 연결 1개, 다른 사용자의 `new_message` 수신, 서버 재시작 뒤 재연결과 backfill). 2026-10-28 로컬 server-v2 `bf2c85d`로 `MAX_CONNECTIONS` 토스트와 "다시 시도"도 확인했다. |
| 다른 탭의 로그아웃과 계정 전환 | ✅ `df2f4f0`. 리뷰 HIGH로 올라와서 고쳤다. 다른 탭이 로그아웃하면 이 탭도 로그아웃되고, 다른 계정으로 로그인하면 이 탭도 그 계정으로 바뀐다 |
| 리뷰 MEDIUM M4: 커서와 커밋 순서 | ✅ 첫 커서를 5초 겹쳐 잡음 (사용자 승인으로 기존 테스트 기대값 수정) |
| Vercel 배포 | `web` 프로젝트가 `geek-chat/web-v2`를 배포한다 (2026-10-25 사용자 결정, ARCHITECTURE.md §5). 2026-10-25 Production env를 Render 주소로 바꾸고 다시 배포했다(배포 `9txTEuXJM`, 소스 `501afef`). 확인한 것: CSP `connect-src`, 코드 묶음의 API 주소(`api.invalid` 없음), 로그인 화면의 검증 문구와 콘솔. 로그인 뒤 흐름은 사용자가 직접 확인한다 |

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
- **공용 컴포넌트**: 버튼과 폼 요소는 `src/components/ui/`에서만 쓴다. lint(`no-restricted-syntax`)가 그 밖의 날 요소를 막고, 클래스는 `cn()`(tailwind-merge)으로 합친다. 정본은 RULES.md R7, 목록은 COMPONENTS.md §3, 눈으로 볼 곳은 `/dev/ui`.

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

> **web-v2는 Phase 1(인증), Phase 2(WS, 방 목록, 채팅 화면), Phase 3(초대, 임시 방, 자동 삭제)를 마쳤고, 디자인 시스템(공용 컴포넌트와 lint 가드, 2026-10-26)과 server-v2 `bf2c85d` 계약 반영(2026-10-28)도 마쳤다. 다음은 출시 전 체크리스트다. 운영은 Vercel `web` 프로젝트이고 Render의 server-v2를 쓴다. 환경 복구 → 기준선 확인 → 로컬 백엔드(위 "로컬 백엔드 띄우는 법") → 남은 확인(위 "다음 세션" 3번) → 출시 전 체크리스트 순서로 진행한다. 끝날 때 refresh-context 스킬 호출 필수.**
