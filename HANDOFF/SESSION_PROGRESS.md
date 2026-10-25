# Session Progress — last updated 2026-10-25

> **다음 세션 진입자에게**: 이 파일이 첫 진입점입니다. 5분 안에 컨텍스트를 잡고 이어 작업하세요.

---

## Current state (one-liner)

**Phase 1 인증 완료 (2026-10-25)**. 사용자가 2026-10-25에 web-v2 재개를 지시해서(선택지 "지금 시작 + Vitest") 10-24부터의 보류를 풀었다. 백엔드 전환은 아직 진행 중이고 배포 URL이 없어서 로컬 백엔드 기준으로 개발한다. 다음은 Phase 2(채팅, WebSocket)다.

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

| 항목 | 근거 | web-v2 영향 |
|---|---|---|
| 5월 이후 문서 변경은 API.md 2건(`b4ba708` HATEOAS `_links`, `a389f0c` 관리자 AI)뿐, WEBSOCKET.md 0건 | `git log 96aa85c..HEAD` | 단일 방 응답에 `_links`가 붙음. zod `z.object`는 모르는 키를 버리므로 깨지지 않음 |
| 인증 응답과 OAuth hash 형식 그대로 | `AuthController.kt:112-126` | Phase 1.2 콜백 설계 유효 |
| `/auth/error?error=` 값은 4종: `oauth_cancelled`, `missing_params`, `invalid_state`, `oauth_failed` | `AuthController.kt:100-112` | 에러 페이지가 4종을 모두 매핑해야 함 |
| JWT에 role 클레임 추가 | 커밋 `035ad30` | 영향 없음 (`jwt.ts:49`는 `exp`만 읽음) |
| WS 연결 거부 5가지(NO_TOKEN, TOKEN_EXPIRED, INVALID_TOKEN, RATE_LIMITED, MAX_CONNECTIONS)가 모두 close 1008 | `ChatWebSocketHandler.kt:36-65` | 1008은 직전 `error.code`로 분기. 정본은 `.claude/RULES.md` R2 |
| 연결 상한 3, 재연결 최소 간격 2초 | `WebSocketSessionManager.kt:16-17` | 백오프는 2초부터 |
| WS Origin과 OAuth 리다이렉트 대상이 `FRONTEND_URL` 하나 | `WebSocketConfig.kt:20`, `AuthController.kt:100-126` | preview 배포에서 WS 불가. v1 Expo에서 web-v2로 바꿀 때 `FRONTEND_URL`도 같이 바꿔야 함 |
| Render에서는 REST CORS도 `FRONTEND_URL` 하나 | `AppProperties.kt:11` 기본값이 빈 목록, `render.yaml`(a0995cc)에 패턴 키 없음 | preview에서 REST를 쓰려면 Render에 `APP_FRONTEND_ORIGIN_PATTERNS`를 따로 넣어야 함 |
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
| S1 | server-v2 `docs/WEBSOCKET.md:163-167` (a0995cc) | 샘플이 1008을 일괄 refresh로 안내하고, `onopen`에서 백오프를 0으로 되돌린다 |
| S2 | server-v2 `WebSocketConfig.kt:20` | WS Origin이 `FRONTEND_URL` 하나라 preview 배포에서 WS 불가 |
| S3 | 워크스페이스 `geek-chat/CLAUDE.md` | MySQL, 친구 클라우드, Next.js 15로 적혀 있어 낡음 |
| S4 | server-v2 `README.md:30` | `local` 프로필을 MySQL로 설명하지만 `application-local.yml:11-14`은 PostgreSQL |
| S5 | server-v2 `render.yaml`, `AppProperties.kt:11` | Render에서는 REST CORS도 `FRONTEND_URL` 하나만 허용한다 (패턴 기본값이 빈 목록). preview 배포는 REST도 실패한다 |
| S6 | server-v2 `SpringDataMessageRepository.kt:22-29` | 메시지 cursor 페이징에 id 보조 정렬이 없어서, 같은 `createdAt`을 가진 메시지가 페이지 경계에서 빠질 수 있다 (가능성 낮음) |
| S8, S9 | server-v2 인증 | 보안 항목 2건. 2026-10-25에 사용자에게 직접 보고했다. 이 저장소는 공개라서 고쳐질 때까지 상세는 적지 않는다. **운영 배포 전 처리 권장** |
| S10 | server-v2 `SecurityConfig.kt:36-47` | `/error`가 허용 목록에 없고 entry point가 본문 없는 401을 돌려준다. 그래서 공개 엔드포인트의 bean validation 실패(400)가 401로 바뀌어 보일 수 있다 (설정 기준, 실측 전). web-v2는 서버와 같은 검증을 폼에서 먼저 해서 영향이 작다 |
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

없음. Phase 1.2는 커밋까지 끝났다. 진행 중이던 코드 변경은 없다.

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

읽을 문서 (Phase 2 기준, 총 ~30분):
1. **이 파일**, 특히 "2026-10-25 Phase 1.2 결과"와 "2026-10-24 세션 간 협업 결과" (5분)
2. **`.claude/RULES.md`** R2 (WS 처리 정본), R6 (낙관적 UI) (10분)
3. **`HANDOFF/API_INTEGRATION.md`** §5 (WS 이벤트와 클라이언트 샘플) (10분)
4. **server-v2 `docs/WEBSOCKET.md`와 `ChatWebSocketHandler.kt`** (5분). 문서와 코드가 다르면 코드가 맞다

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

빠른 시각 검증 (CSP 헤더):
```bash
curl -I http://localhost:3000 | grep -i 'content-security'
```

### 1-bis. 2026-05 code-review 이월 항목 상태

| 우선순위 | 항목 | 상태 |
|---|---|---|
| MEDIUM | `/auth/me` 일시 실패 시 "로그아웃 화면 + 토큰 남음" | ✅ `38fede8` (`offline` 상태와 재시도) |
| LOW | 콜백 페이지가 hash 지우기를 빠뜨리지 않게 강제 | ✅ `8fb02fc` (`useOAuthHash` 훅. 순수 함수 대신 훅으로 강제한 이유는 그 커밋 메시지 참고) |
| LOW | `next.config.ts`의 `style-src 'unsafe-inline'` 재평가 | **남음**. Sonner가 인라인 스타일을 쓰는지 브라우저에서 확인해야 한다 |
| LOW | `devLogin` 운영 빌드 차단 | ✅ `8fb02fc` |
| NIT | AppBoot의 `console.error` | ✅ 사라짐. 로깅 추상화(Sentry 등)는 운영 배포 때 따로 정한다 |
| NIT | `tError` 키 조회를 허용 목록으로 | ✅ `tError`를 없앴고 (`941c43b`), 콜백 에러 코드와 제공자 이름은 허용 목록으로 바꿨다 (`0f8f0dc`) |
| NIT | `SignupForm`의 이중 zod parse | 그대로 둠 (안전망) |
| NIT | Button 로딩 spinner가 글자 옆에 나란히 뜸 | 그대로 둠 (UX 검토 때 결정) |

### 2. server-v2 PR #11이 머지되면 (문서만)

PR #11(`fix/ws-contract-gaps`)은 2026-10-25 기준 열려 있다. 머지되면 두 가지를 반영한다.
- R6(낙관적 UI): `error`에 `clientMessageId`가 오면(`SEND_FAILED`는 항상, `INVALID_DATA`는 요청에 있었을 때) 해당 대기 메시지를 바로 `failed`로 바꾸고, 5초 ack 타임아웃은 대비책으로 남긴다.
- R2와 이 파일의 server-v2 인용을 행 번호 대신 이름(`afterConnectionEstablished`, `MIN_CONNECTION_INTERVAL_MS`, `WEBSOCKET.md §6`)으로 바꾼다. PR #10 때문에 `WebSocketSessionManager.kt`의 상수가 이미 23-24행으로 밀렸고, #11이 `ChatWebSocketHandler.kt`와 `WEBSOCKET.md`를 또 바꾼다.

R2의 1008 분기는 바뀌지 않는다. PR #11에서도 close는 `POLICY_VIOLATION` 하나이고, 1008은 연결할 때만 온다.

### 3. Phase 2.1: 타입과 WebSocket 클라이언트

`HANDOFF/DEVELOPMENT_PLAN.md`의 Session 2.1을 따르되, 연결과 재연결 규칙은 `.claude/RULES.md` R2가 정본이다. 특히 지킬 것:
- WS도 `apiFetch`와 같은 single-flight refresh를 쓴다 (`src/lib/api/client.ts`의 `refreshOnce`를 export).
- 백오프와 refresh 1회 제한은 연결이 안정된 뒤에만 되돌린다 (`onopen`에서 되돌리지 않는다).
- 재연결이 받아들여진 뒤 열린 방의 놓친 메시지를 forward cursor 조회로 채운다.

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
| server-v2 PR #11 | 열림. 머지되면 위 "다음 세션" 2번 |
| `style-src 'unsafe-inline'` | 남은 LOW. 브라우저 확인 필요 |
| 리뷰 MEDIUM: 콜백 링크 출처 확인 | ✅ web-v2 쪽은 `d0a9116` (사용자가 "둘 다" 선택). 서버 쪽 보완은 사용자가 따로 처리 |
| S8, S9 서버 보안 항목 | 사용자가 처리 담당을 정함. 운영 배포 전 처리 권장 |
| 리뷰 LOW-2: Next canonical URL에 hash 잔류 | 남김. 위 "코드 리뷰" 절의 수정 후보를 dev에서 실측한 뒤 적용 |

---

## Important context

### 주요 결정사항

- **백엔드 컨트랙트는 verbatim**: `accessToken`/`refreshToken` (camelCase) — REST DTO. **단, OAuth URL 프래그먼트는 `access_token`/`refresh_token` (snake_case)** — 콜백 페이지에서 변환.
- **단일-플라이트 refresh**: `src/lib/api/client.ts`의 module-level `refreshPromise`. 동시 401 N개가 와도 refresh는 1번. 실패 시 `auth:logout` window event 발사 → AppBoot에서 catch.
- **다크모드**: `<html className="dark">` 고정, Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *))` 등록. next-themes는 M2까지 미도입.
- **i18n**: `src/i18n/ko.ts` flat key/value, `t(key, vars)`가 `{name}` 자리를 채운다. API 에러 문구는 `describeApiError(err, context)`가 HTTP 상태와 호출 맥락으로 고른다 (서버 `error` 필드는 reason phrase라 도메인 코드로 쓸 수 없다).
- **세션**: `src/lib/auth/session.ts`의 `verifySession`과 `startSession`이 스토어 상태를 정한다. 401/403/404만 세션을 끝내고, 그 밖의 실패는 토큰을 남긴 채 `offline`이다.
- **OAuth 콜백**: hash는 `useOAuthHash`로만 읽는다. 일회용 토큰은 컴포넌트 상태에만 둔다.
- **OAuth 흐름 표시**: 버튼을 누를 때 sessionStorage에 10분짜리 표시를 남기고, 콜백은 그 표시가 있을 때만 hash를 쓴 뒤 표시를 지운다 (`src/lib/auth/oauthFlow.ts`). 다른 탭으로 돌아오는 OAuth 흐름은 거절되는데, 이건 감수하기로 한 트레이드오프다.
- **CSP**: 엄격. `script-src 'self'` (no inline/eval), `connect-src` 환경변수만, `frame-ancestors 'none'`.
- **localStorage 토큰 + CSP** 조합으로 XSS 표면 최소화 (RULES.md R5).

### 백엔드 (참고만, 수정 절대 금지)

위치: `~/Work/geek-chat/geek-chat-server-v2/` (멀티 모듈. 행 번호는 `0ccf5c2` 기준이고 `a0995cc`에서도 그대로다)
- `auth/.../presentation/web/AuthController.kt`: OAuth 콜백 리다이렉트 조립은 100-126행 (에러 4종, hash 3종)
- `AuthDto.kt`: 모든 DTO (camelCase)
- `ChatErrorMapping.kt`: HTTP 상태 코드 매핑
- `websocket/.../infrastructure/config/WebSocketConfig.kt`: `/ws` 경로, 허용 Origin은 `FRONTEND_URL` 하나 (20행)
- `websocket/.../infrastructure/WebSocketSessionManager.kt`: `MAX_CONNECTIONS_PER_USER = 3`, `MIN_CONNECTION_INTERVAL_MS = 2000L` (`7fcada6` 기준 23-24행. PR #10으로 밀렸다)
- `user/.../presentation/web/UserController.kt`: `PATCH /api/users/me/username` (`{username}` 요청, `{username}` 응답)
- `common/.../presentation/web/ChatErrorMapping.kt`: 에러 본문의 `error`는 HTTP reason phrase (S7)
- `websocket/.../presentation/ChatWebSocketHandler.kt`: 연결 거부 5가지가 모두 close 1008 (36-65행)

### refresh-context 스킬

세션 종료 직전 또는 컨텍스트 압축 직전에:
- 트리거 키워드: "최신화", "refresh-context", "/refresh-context", "핸드오프"
- 자동: Stop hook (`.claude/hooks/refresh-context-reminder.sh`)이 dirty tree에서 안내 메시지 출력 (exit 0)
- 수동 인벤토리: `bash .claude/skills/refresh-context/update.sh`

### Worktree 정보

- 위치: 앱이 만든 worktree (`.claude/worktrees/<이름>`). 이름은 재활용될 때마다 바뀌니 `git rev-parse --show-toplevel`로 확인한다.
- 브랜치: `claude/fervent-bell-35addf`. 2026-10-25에 사용자가 `2a1f19b`까지 `main`에 반영하고 push했다.
- Phase 1.2 커밋은 이 브랜치에만 있다 (`git log 2a1f19b..HEAD`). `main` 반영과 push는 사용자가 직접 한다 (에이전트 push는 막혀 있다).

---

## 한 줄 요약

> **web-v2는 Phase 1.1까지 구현한 상태로 보류 중이다. 재개 조건(사용자 지시 + 백엔드 URL)을 먼저 확인하고, 재개하면 환경 복구 → 1-bis → Phase 1.2 순서로 진행한다. 끝날 때 refresh-context 스킬 호출 필수.**
