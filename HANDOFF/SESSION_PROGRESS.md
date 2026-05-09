# Session Progress — last updated 2026-05-09

> **다음 세션 진입자에게**: 이 파일이 첫 진입점입니다. 5분 안에 컨텍스트를 잡고 이어 작업하세요.

---

## Current state (one-liner)

**Phase 1.1 완료**. Next.js 16 + React 19 + Tailwind v4 위에 인증 인프라(env+CSP / 토큰 스토리지 / 단일-플라이트 refresh / Zustand 스토어 / 인증 폼 / 랜딩+로그인+가입 페이지) 6개 atomic commit으로 안착. tsc + lint + build 전부 exit 0. 백엔드 dev 서버 띄워서 수동 검증만 남음. 다음은 **Phase 1.2** (OAuth 콜백 4페이지 + AuthGuard + /me + i18n 보강).

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

**없음**. Phase 1.1 깔끔히 마무리. code-reviewer 결과만 후행으로 확인 (필요 시 Phase 1.2 시작 전에 fix commit).

---

## Next session — start here (Phase 1.2)

### 0. 컨텍스트 잡기 (5분)

```bash
cd /Users/jsh14/Work/geek-chat/geek-chat-web-v2/.claude/worktrees/fervent-bell-35addf

# 한눈에 상태
bash .claude/skills/refresh-context/update.sh | head -40

# dev 서버 띄워보기 (Phase 1.1 결과 확인)
npm run dev
# → http://localhost:3000 (랜딩) / /login / /signup
# Ctrl+C로 종료
```

읽을 문서 (총 ~25분):
1. **이 파일 (SESSION_PROGRESS.md)** — 5분
2. **`.claude/RULES.md`** — 5분 (R1-R10 binding rules)
3. **`HANDOFF/AUTH_UX.md`** — 10분 (OAuth 4 콜백 와이어프레임)
4. **`HANDOFF/API_INTEGRATION.md`** §3 — 5분 (OAuth hash format 재확인)

### 1. 백엔드 dev 서버 + 수동 검증 (Phase 1.1 통합 테스트)

별도 터미널에서:
```bash
cd ~/Work/geek-chat/geek-chat-server-v2
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=test -e MYSQL_DATABASE=geekchat mysql:8.0
./gradlew bootRun --args='--spring.profiles.active=dev'
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

### 2. Phase 1.2 — OAuth 콜백 + AuthGuard + /me (목표 ~2.5시간)

#### Step A. OAuth 콜백 페이지 4개 (~1.5시간)
**모두 `'use client'` + `useEffect` mount + 즉시 `clearHash()` (RULES.md R1)**.

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
    - `kind: "signup_required"` → `signup_token`/`suggested_nickname`을 들고 `/auth/oauth-complete`로 (state로 전달 또는 URL로)

- `src/app/(public)/auth/oauth-complete/page.tsx`
  - parse: `{signup_token, suggested_nickname}` (URL-decoded)
  - 폼: 닉네임 input (default = suggestedNickname, 1~20자)
  - submit → `completeOAuthSignup({signupToken, nickname})` → `setSession` → `/rooms`

- `src/app/(public)/auth/error/page.tsx`
  - parse query: `?error=...`
  - 메시지 표시 + "다시 시도" → `/`

#### Step B. AuthGuard + (authed) layout (~30분)
- `src/components/auth/AuthGuard.tsx`: `'use client'`, store status 구독. `unauthenticated` → `router.replace('/login')`. `loading`이면 Spinner. `authenticated`이면 children.
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
| code-reviewer sub-agent 결과 | 백그라운드 — 다음 세션 진입 시 첫 5분에 확인하고 BLOCKER/HIGH 있으면 fix 후 진행 |
| 모바일 전략 | ✅ `MOBILE_STRATEGY.md`로 결정됨 (M1 PWA, M2 RN+Expo) |
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

위치: `~/Work/geek-chat/geek-chat-server-v2/`
- `AuthController.kt`: 12개 endpoint + OAuth callback 어셈블리 (line 124-143이 hash 포맷 핵심)
- `AuthDto.kt`: 모든 DTO (camelCase)
- `ChatErrorMapping.kt`: HTTP 상태 코드 매핑
- `WebSocketConfig.kt`: `/ws` 경로, `MAX_CONNECTIONS_PER_USER = 3`, `MIN_CONNECTION_INTERVAL_MS = 2000L`
- 105+ tests passing

### refresh-context 스킬

세션 종료 직전 또는 컨텍스트 압축 직전에:
- 트리거 키워드: "최신화", "refresh-context", "/refresh-context", "핸드오프"
- 자동: Stop hook (`.claude/hooks/refresh-context-reminder.sh`)이 dirty tree에서 안내 메시지 출력 (exit 0)
- 수동 인벤토리: `bash .claude/skills/refresh-context/update.sh`

### Worktree 정보

- 위치: `geek-chat-web-v2/.claude/worktrees/fervent-bell-35addf/`
- 브랜치: `claude/fervent-bell-35addf`
- 머지 전략: PR로 부모 `main`에 merge (Phase 1.2 완료 후 또는 마일스톤 완료 후 결정)

---

## 한 줄 요약

> **Phase 1.1 완료 (6 commits, build/lint/tsc 통과). 다음 세션은 SESSION_PROGRESS.md의 "Phase 1.2 — OAuth 콜백" 섹션 따라 진행. 끝날 때 refresh-context 스킬 호출 필수.**
