# Session Progress — last updated 2026-10-24

> **다음 세션 진입자에게**: 이 파일이 첫 진입점입니다. 5분 안에 컨텍스트를 잡고 이어 작업하세요.

---

## Current state (one-liner)

**보류 중 (2026-10-24부터)**. Phase 1.1 인증까지 구현된 상태에서 멈춰 있다. 사용자가 승인한 전환 계획에 따라 백엔드(server-v2) 운영 전환과 v1 Expo(`geek-chat-web`) 통신 계층 수정을 먼저 하고, web-v2 기능 작업은 그다음에 재개한다. 재개하면 Phase 1.2부터 시작한다.

Phase 1.1 결과: Next.js 16 + React 19 + Tailwind v4 위에 인증 인프라(env와 CSP, 토큰 저장소, single-flight refresh, Zustand 스토어, 인증 폼, 랜딩과 로그인, 가입 페이지). 2026-05 기준 tsc, lint, build 모두 exit 0.

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
| @hookform/resolvers | (deps via signupRequestSchema) |
| sonner | 2.0.7 |
| lucide-react | 1.14.0 |

---

## 2026-10-24 세션 간 협업 결과

### 전환 계획과 역할 분담

출처: 조율 세션("Complete project prompt with technical specifications")이 보낸 메시지. 사용자 결정 인용은 "전환 계획 승인할게" (2026-10-24).

| 세션 | 저장소 | 역할 |
|---|---|---|
| Migrate GeekChat server to Kotlin Spring Boot | `geek-chat-server-v2` | 백엔드 운영 전환 |
| Complete geek-chat-web-internal tasks 1-12 | `geek-chat-web` (v1 Expo) | v1 통신 계층을 v2 계약(순수 WebSocket `/ws?token=`, `type` JSON)에 맞춤 |
| Complete project prompt with technical specifications | (조율) | 데이터 이관과 전환 조율 |
| 이 저장소 (web-v2) | `geek-chat-web-v2` | **보류**. 문서 정리만 함. 다른 저장소는 읽기만 함 |

### 직접 검증한 계약 사실 (server-v2 HEAD `0ccf5c2`, 읽기만 함)

| 항목 | 근거 | web-v2 영향 |
|---|---|---|
| 5월 이후 문서 변경은 API.md 2건(`b4ba708` HATEOAS `_links`, `a389f0c` 관리자 AI)뿐, WEBSOCKET.md 0건 | `git log 96aa85c..HEAD` | 단일 방 응답에 `_links`가 붙음. zod `z.object`는 모르는 키를 버리므로 깨지지 않음 |
| 인증 응답과 OAuth hash 형식 그대로 | `AuthController.kt:112-126` | Phase 1.2 콜백 설계 유효 |
| `/auth/error?error=` 값은 4종: `oauth_cancelled`, `missing_params`, `invalid_state`, `oauth_failed` | `AuthController.kt:100-112` | 에러 페이지가 4종을 모두 매핑해야 함 |
| JWT에 role 클레임 추가 | 커밋 `035ad30` | 영향 없음 (`jwt.ts:49`는 `exp`만 읽음) |
| WS 연결 거부 5가지(NO_TOKEN, TOKEN_EXPIRED, INVALID_TOKEN, RATE_LIMITED, MAX_CONNECTIONS)가 모두 close 1008 | `ChatWebSocketHandler.kt:36-65` | 1008은 직전 `error.code`로 분기. 정본은 `.claude/RULES.md` R2 |
| 연결 상한 3, 재연결 최소 간격 2초 | `WebSocketSessionManager.kt:16-17` | 백오프는 2초부터 |
| WS Origin과 OAuth 리다이렉트 대상이 `FRONTEND_URL` 하나 | `WebSocketConfig.kt:20`, `AuthController.kt:100-126` | preview 배포에서 WS 불가. v1 Expo에서 web-v2로 바꿀 때 `FRONTEND_URL`도 같이 바꿔야 함 |
| 배포 대상은 Render 무료 + Supabase Postgres, 아직 배포 전 | `docs/MIGRATION.md:166-175` | `connect-src`는 이미 env로 만듦 (`next.config.ts:6-7, 18`). URL이 정해지면 Vercel env만 넣으면 됨 |

### v1 세션이 알려 준 인증 함정 (web-v2 반영 상태)

| v1 함정 | web-v2 상태 |
|---|---|
| linkToken을 `access_token` 키에 실어 보냄 | 콜백 페이지는 자기 경로의 키만 읽고 일회용 토큰은 저장하지 않는다 (RULES.md R1에 규칙 추가, 구현은 Phase 1.2) |
| REST와 WS가 따로 refresh해서 회전 토큰이 경합 | WS도 apiFetch의 single-flight refresh를 쓴다 (RULES.md R2에 규칙 추가, 구현은 Phase 2) |
| 저장소와 스토어의 토큰이 어긋남 | 이미 피함. 스토어는 토큰을 갖지 않고 (`store/auth.ts:22-32`) 실패는 `clearSession()`으로 모인다 (`AppBoot.tsx:54-58`) |
| `/auth/me` 실패를 조용히 삼킴 | 삼키지는 않지만 네트워크 오류 때 "로그아웃 화면 + 토큰 남음"이 된다 (`AppBoot.tsx:43-48`). 아래 1-bis 표에서 우선순위를 올림 |

### 사용자에게 보고만 한 것 (다른 저장소, 담당은 사용자가 정함)

| # | 위치 | 문제 |
|---|---|---|
| S1 | server-v2 `docs/WEBSOCKET.md:166-167` | 샘플이 1008을 일괄 refresh로 안내 |
| S2 | server-v2 `WebSocketConfig.kt:20` | WS Origin이 `FRONTEND_URL` 하나라 preview 배포에서 WS 불가 |
| S3 | 워크스페이스 `geek-chat/CLAUDE.md` | MySQL, 친구 클라우드, Next.js 15로 적혀 있어 낡음 |
| S4 | server-v2 `README.md:30` | `local` 프로필을 MySQL로 설명하지만 `application-local.yml:11-14`은 PostgreSQL |
| T1 | `geek-chat-web` main `559d170` | v2가 리다이렉트하는 `/auth/oauth-link`, `/auth/oauth-complete`, `/auth/error` 라우트 파일이 없음. v1 연동은 `/auth/success#linking_required=true` 형식 (`app/auth/success.tsx:18-33`). web-internal 세션에 공유함 |

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

## In-flight (paused)

**web-v2 전체가 보류 상태다.** 진행 중이던 코드 변경은 없고 작업 트리는 깨끗하다. 2026-10-24 세션은 문서만 고쳤다 (커밋 `0788ee4`, `21d1383`, 그리고 이 파일을 갱신한 커밋).

---

## Next session — start here

### 먼저 확인: 보류가 풀렸는가

web-v2는 백엔드 전환이 끝날 때까지 보류 중이다. 아래 두 가지가 모두 맞을 때만 코드 작업을 재개한다.
1. 사용자가 web-v2 재개를 지시했다.
2. 백엔드 서비스 URL이 정해졌다 (조율 세션이나 사용자가 알려 준다).

보류 중이라면 코드는 건드리지 않는다. 새로 받은 계약 변경이나 배포 정보만 이 파일과 `.claude/RULES.md`에 반영한다.

### 0. 재개할 때 환경 복구 (5분)

```bash
cd "$(git rev-parse --show-toplevel)"   # worktree 경로는 재활용될 때마다 바뀐다

# 한눈에 상태
bash .claude/skills/refresh-context/update.sh | head -40

# worktree가 새로 만들어졌다면 node_modules와 .env.local이 없다
memguard -- npm ci
cp .env.example .env.local               # 값을 http://localhost:8080, ws://localhost:8080/ws로 바꾼다

# dev 서버 띄워보기 (Phase 1.1 결과 확인)
npm run dev
# → http://localhost:3000 (랜딩) / /login / /signup
# Ctrl+C로 종료
```

읽을 문서 (총 ~30분):
1. **이 파일 (SESSION_PROGRESS.md)**, 특히 "2026-10-24 세션 간 협업 결과" (5분)
2. **`.claude/RULES.md`** R1, R2 (5분)
3. **`HANDOFF/AUTH_UX.md`** (10분, OAuth 4 콜백 와이어프레임)
4. **server-v2 `docs/API.md`와 `AuthController.kt`** (10분). 문서와 코드가 다르면 코드가 맞다

### 1. 백엔드 로컬 실행 + 수동 검증 (Phase 1.1 통합 테스트)

별도 터미널에서 (정본은 server-v2 README의 "Local Development"):
```bash
cd ~/Work/geek-chat/geek-chat-server-v2
docker compose -f docker-compose.dev.yml up -d
./gradlew bootRun --args='--spring.profiles.active=local'   # dev-login은 dev, local 프로필에서만 열린다
```

브라우저 콘솔에서 dev-login 토큰 주입 후 `/auth/me` REST 통합 확인:
```javascript
const r = await fetch('http://localhost:8080/auth/dev-login?name=Alice').then(r => r.json())
localStorage.setItem('access_token', r.accessToken)
localStorage.setItem('refresh_token', r.refreshToken)
location.reload()
```

빠른 시각 검증 (CSP 헤더):
```bash
curl -I http://localhost:3000 | grep -i 'content-security'
```

### 1-bis. Code-review carry-over (Phase 1.2 진입 시 함께 처리)

`a546205 fix(api)` 커밋에서 **BLOCKER 1 + HIGH 1 + MEDIUM 1**은 이미 처리됨. 다음은 후행으로 잡아둔 잔여 항목.

| 우선순위 | 위치 | 항목 |
|---|---|---|
| **MEDIUM** (LOW에서 올림) | `src/components/AppBoot.tsx:43-48` | 네트워크나 5xx로 `/auth/me`가 실패하면 "로그아웃 화면 + 토큰 남음"이 된다. Render 무료는 15분 유휴 후 잠들어서 (`MIGRATION.md:176`) 이 경로를 자주 탄다. 토큰을 지우면 일시 장애 때마다 로그아웃되므로, 재시도와 별도 상태(예: `offline`)로 처리하는 쪽을 권장 |
| LOW | `src/lib/auth/oauthCallback.ts:22-32` | `parseAndClearHash()` 단일 헬퍼로 통합해 콜백 페이지가 `clearHash` 호출 빠뜨리지 않도록 강제 |
| LOW | `next.config.ts:14` | `style-src 'unsafe-inline'` 재평가 — Tailwind v4 정적 stylesheet만 쓰면 제거 가능. Sonner 인라인 스타일 영향만 확인 |
| LOW | `src/lib/api/auth.ts:devLogin` | `if (process.env.NODE_ENV !== "production")` gate로 prod bundle에서 dead-code 제거 |
| NIT | `src/components/AppBoot.tsx:46` | 프로덕션 로깅 추상화 (logger 또는 Sentry) |
| NIT | `src/i18n/index.ts:13-18` | `tError` 키 lookup을 typed allowlist로 (백엔드 코드 drift 감지) |
| NIT | `src/lib/api/auth.ts:oauthStartUrl` 주석 (이미 fix됨, 주석 정합성만) | 주석 "env import is lazy" 표현 수정됨 |
| NIT | `src/components/auth/SignupForm.tsx:46` | 이중 zod parse — `zodResolver` 통과한 값을 다시 `signupRequestSchema.parse` (안전망 vs 미세 CPU). 그대로 둘지 결정 |
| NIT | `src/components/ui/Button.tsx:62` | 로딩 spinner가 children과 side-by-side 렌더 — UX 검토 후 결정 |

처리 전략: **Phase 1.2 시작 시 첫 5-10분에 LOW만 일괄 처리 → fix commit. NIT은 마일스톤 정리 시점에**.

OK 항목 (코드 리뷰 검증 통과 — 변경 불요):
- 단일-플라이트 refresh 동시성, SSR safety, XSS 표면 (no `dangerouslySetInnerHTML`/`innerHTML`/`eval`), `'use client'` 경계, AppBoot mount-once + cleanup, zod 스키마 vs 백엔드 DTO 매칭, OAuth hash decoding (`URLSearchParams`+`replaceState`), Tailwind v4 패턴, 폼 a11y, TypeScript strict.

### 2. Phase 1.2 — OAuth 콜백 + AuthGuard + /me (목표 ~2.5시간)

#### Step A. OAuth 콜백 페이지 4개 (~1.5시간)
**모두 `'use client'` + `useEffect` mount + 즉시 `clearHash()` (RULES.md R1)**.

- 콜백 페이지는 자기 경로의 키만 읽고, `link_token`과 `signup_token`은 토큰 저장소에 넣지 않는다 (RULES.md R1. v1이 실제로 키를 겹쳐 쓴 문제).
- React 개발 모드의 StrictMode는 effect를 두 번 실행할 수 있다. 첫 실행에서 hash를 지우면 두 번째 실행이 빈 hash를 보고 `/auth/error`로 튕길 수 있으니 `useRef`로 한 번만 처리한다. ([가정] Next 16의 `reactStrictMode` 기본값은 재개할 때 `node_modules/next/dist/docs/`에서 확인)

- `src/app/(public)/auth/success/page.tsx`
  - `parseHash()` → `{access_token, refresh_token}` (snake_case)
  - 누락 시 `/auth/error?error=oauth_failed`로 redirect
  - 정상 시 `setSession({accessToken, refreshToken})` (snake_case → camelCase 변환)
  - `clearHash()` → `router.replace('/rooms')`

- `src/app/(public)/auth/oauth-link/page.tsx`
  - parse: `{link_token, existing_nickname, new_provider}` (URL-decoded by URLSearchParams)
  - 화면: "이미 {existing_nickname}님이 {new_provider}로 가입되어 있습니다. 연동하시겠습니까?"
  - 두 버튼: "연동" → `linkProvider({linkToken, confirm:true})`, "거절" → `linkProvider({linkToken, confirm:false})`
  - 결과 분기:
    - `kind: "logged_in"` → `setSession` → `/rooms`
    - `kind: "signup_required"` → 공용 `CompleteSignupForm`을 같은 페이지에서 바로 보여 준다 (토큰을 URL에 다시 싣지 않는다)

- `src/app/(public)/auth/oauth-complete/page.tsx`
  - parse: `{signup_token, suggested_nickname}` (URL-decoded)
  - 폼: 닉네임 input (default = suggestedNickname, 1~20자)
  - submit → `completeOAuthSignup({signupToken, nickname})` → `setSession` → `/rooms`

- `src/app/(public)/auth/error/page.tsx`
  - parse query: `?error=...` (4종: `oauth_cancelled`, `missing_params`, `invalid_state`, `oauth_failed`. `AuthController.kt:100-112`)
  - 코드별 한국어 메시지 표시 + "다시 시도" → `/`

#### Step B. AuthGuard + (authed) layout (~30분)
- `src/components/auth/AuthGuard.tsx`: `'use client'`, store status 구독. `unauthenticated` → `router.replace('/login')`. `loading`이면 Spinner. `authenticated`이면 children. status는 1-bis에서 추가할 오프라인 상태까지 빠짐없이 처리한다 (v1은 `/me` 실패 뒤 `isAuthenticated=true, user=null`로 멈췄다).
- `src/app/(authed)/layout.tsx`: `<AuthGuard>{children}</AuthGuard>`
- 임시 `/rooms`: `src/app/(authed)/rooms/page.tsx` (placeholder "환영합니다 {user.nickname}" + 로그아웃 버튼) — Phase 2에서 진짜 채팅으로 대체

#### Step C. /me 페이지 + 회원탈퇴 (~30분)
- `src/app/(authed)/me/page.tsx`:
  - 표시: `user.nickname`, `user.username` (nullable), `user.profileImageUrl` (nullable)
  - 액션: 로그아웃 (logout API + clearSession + redirect /), 탈퇴 (이중 확인 input "DELETE MY ACCOUNT" → withdraw API + clearSession + 토스트)

#### Step D. 검증 + 커밋 (~30분)
- `npx tsc --noEmit && npm run lint && npm run build`
- Google OAuth dev: `http://localhost:8080/auth/google`로 시작 → 신규 계정이면 oauth-complete 흐름
- 4개 atomic commit (콜백 / AuthGuard / me / 검증)

#### Step E. 세션 종료 직전
**`refresh-context` 스킬 호출** ("최신화" 트리거). Stop hook이 dirty tree 감지 시 자동 안내.

---

## Blockers / decisions needed

| 항목 | 상태 |
|---|---|
| web-v2 재개 시점 | 사용자 결정 대기. 백엔드 전환이 먼저다 |
| 백엔드 서비스 URL | 없음. Supabase 생성과 Render 연결은 사용자 계정으로만 할 수 있다 (`MIGRATION.md:175`) |
| D1: Expo 앱을 지금 낼지, 웹 → PWA → Expo 순서를 따를지 | 사용자 결정 대기 (web-internal 세션 보고). `MOBILE_STRATEGY.md`는 이 결정 전에 쓴 초안이다 |
| Vitest 도입 | 재개할 때 결정. "새 기능에는 테스트 최소 1개" 규칙상 Phase 1.2에 필요하다 |
| code-reviewer 결과 | ✅ BLOCKER, HIGH, MEDIUM은 `a546205`에서 처리. 남은 항목은 1-bis 표 |
| Phase 1.2 OAuth `linkProvider` 응답 분기 | ✅ `linkProviderResult` discriminated union 이미 `src/lib/api/auth.ts`에 구현됨 — 콜백 페이지에서 사용만 |

---

## Important context

### 주요 결정사항

- **백엔드 컨트랙트는 verbatim**: `accessToken`/`refreshToken` (camelCase) — REST DTO. **단, OAuth URL 프래그먼트는 `access_token`/`refresh_token` (snake_case)** — 콜백 페이지에서 변환.
- **단일-플라이트 refresh**: `src/lib/api/client.ts`의 module-level `refreshPromise`. 동시 401 N개가 와도 refresh는 1번. 실패 시 `auth:logout` window event 발사 → AppBoot에서 catch.
- **다크모드**: `<html className="dark">` 고정, Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *))` 등록. next-themes는 M2까지 미도입.
- **i18n**: `src/i18n/ko.ts` flat key/value. 백엔드 에러 코드 → 한국어 매핑 (`tError(code)`).
- **CSP**: 엄격. `script-src 'self'` (no inline/eval), `connect-src` 환경변수만, `frame-ancestors 'none'`.
- **localStorage 토큰 + CSP** 조합으로 XSS 표면 최소화 (RULES.md R5).

### 백엔드 (참고만, 수정 절대 금지)

위치: `~/Work/geek-chat/geek-chat-server-v2/` (멀티 모듈. 행 번호는 2026-10-24 HEAD `0ccf5c2` 기준)
- `auth/.../presentation/web/AuthController.kt`: OAuth 콜백 리다이렉트 조립은 100-126행 (에러 4종, hash 3종)
- `AuthDto.kt`: 모든 DTO (camelCase)
- `ChatErrorMapping.kt`: HTTP 상태 코드 매핑
- `websocket/.../infrastructure/config/WebSocketConfig.kt`: `/ws` 경로, 허용 Origin은 `FRONTEND_URL` 하나 (20행)
- `websocket/.../infrastructure/WebSocketSessionManager.kt`: `MAX_CONNECTIONS_PER_USER = 3`, `MIN_CONNECTION_INTERVAL_MS = 2000L` (16-17행)
- `websocket/.../presentation/ChatWebSocketHandler.kt`: 연결 거부 5가지가 모두 close 1008 (36-65행)

### refresh-context 스킬

세션 종료 직전 또는 컨텍스트 압축 직전에:
- 트리거 키워드: "최신화", "refresh-context", "/refresh-context", "핸드오프"
- 자동: Stop hook (`.claude/hooks/refresh-context-reminder.sh`)이 dirty tree에서 안내 메시지 출력 (exit 0)
- 수동 인벤토리: `bash .claude/skills/refresh-context/update.sh`

### Worktree 정보

- 위치: 앱이 만든 worktree (`.claude/worktrees/<이름>`). 이름은 재활용될 때마다 바뀌니 `git rev-parse --show-toplevel`로 확인한다.
- 브랜치: `claude/fervent-bell-35addf`. 2026-10-24 기준 로컬 `main`과 `origin/main`은 `9ca9c61`이다.
- 2026-10-24 문서 커밋 3개는 이 브랜치에만 있다. `main` 반영과 push는 사용자가 직접 한다 (에이전트 push는 막혀 있다).

---

## 한 줄 요약

> **web-v2는 Phase 1.1까지 구현한 상태로 보류 중이다. 재개 조건(사용자 지시 + 백엔드 URL)을 먼저 확인하고, 재개하면 환경 복구 → 1-bis → Phase 1.2 순서로 진행한다. 끝날 때 refresh-context 스킬 호출 필수.**
