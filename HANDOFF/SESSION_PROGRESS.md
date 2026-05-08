# Session Progress — last updated 2026-05-08

> **다음 세션 진입자에게**: 이 파일이 첫 진입점입니다. 5분 안에 컨텍스트를 잡고 이어 작업하세요.

---

## Current state (one-liner)

Next.js 16 + React 19 + Tailwind v4 부트스트랩 완료. 의존성(zustand/swr/rhf/zod/sonner/lucide) 설치 완료. **코드 작성 (Phase 1.1) 시작 전 상태**. `.claude/` 인프라 + refresh-context 스킬 + Stop 훅까지 갖춰짐.

## Stack 실제 버전 (HANDOFF의 "v15" 표기는 outdated)

| | 실제 설치된 버전 | HANDOFF 문서 |
|---|---|---|
| Next.js | **16.2.5** | (v15로 표기됨) |
| React | **19.2.4** | (v18 가정) |
| Tailwind | **v4.2.4** (CSS-based config) | (v3 + `tailwind.config.ts` 가정) |
| TypeScript | 5.x | 일치 |
| ESLint | v9 (flat config) | 일치 |
| zustand | 5.0.13 | 일치 |
| swr | 2.4.1 | 일치 |
| react-hook-form | 7.75.0 | 일치 |
| zod | 4.4.3 | 일치 |
| sonner | 2.0.7 | 일치 |
| lucide-react | 1.14.0 | 일치 |

**중요한 v16/v4 차이**: `tailwind.config.ts` 없음. globals.css에서 `@theme` + `@custom-variant dark (&:where(.dark, .dark *));` 패턴 사용. Turbopack default. `--no-turbopack` 플래그 사라짐.

---

## Done this session

### 부트스트랩 (완료)
- [x] `npx create-next-app@latest` (Next.js 16 + TS + Tailwind v4 + App Router + ESLint + src/) 임시 폴더에 생성 후 worktree로 산출물 복사 — `.git/HANDOFF/.omc/README.md` 보존
- [x] `npm install zustand swr react-hook-form zod @hookform/resolvers sonner lucide-react` (Phase 1 deps 7개)
- [x] `.env.local` (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL) + `.env.example` 작성
- [x] `.gitignore` 정리 (create-next-app 버전 + `!.env.example` 예외)

### 인프라 + 문서 (완료)
- [x] `AGENTS.md` 보강 — Next.js 16 / React 19 / Tailwind v4 경고 + 프로젝트 binding rules 10개 + 백엔드 contract 앵커
- [x] `CLAUDE.md` — `@AGENTS.md` + `@.claude/RULES.md` import + quick reference
- [x] `.claude/settings.json` — 권한 allowlist + Stop hook (refresh-context 리마인더)
- [x] `.claude/RULES.md` — 10개 binding rule (R1-R10) + Stack 가정
- [x] `.claude/README.md` — `.claude/` 폴더 안내
- [x] `.claude/hooks/refresh-context-reminder.sh` — working tree dirty면 안내 메시지, exit 0 (non-blocking)
- [x] `.claude/skills/refresh-context/SKILL.md` + `update.sh` — 컨텍스트 최신화 스킬 (인벤토리 → 문서 동기화 → SESSION_PROGRESS 갱신)

### 검증 (완료)
- [x] `bash .claude/skills/refresh-context/update.sh` 정상 동작 (모든 버전 표시, src/ 파악)
- [x] `bash .claude/hooks/refresh-context-reminder.sh` exit 0 + 적절한 안내

---

## In-flight (paused mid-step)

**없음**. 이 세션은 부트스트랩 + 인프라까지 깔끔하게 마무리됨. 코드(Phase 1.1)는 의도적으로 다음 세션으로 이월.

---

## Next session — start here

### 0. 컨텍스트 잡기 (5분)

```bash
cd /Users/jsh14/Work/geek-chat/geek-chat-web-v2/.claude/worktrees/fervent-bell-35addf

# 현재 상태 한 번 보기
bash .claude/skills/refresh-context/update.sh | head -40

# 작동 확인
npm run dev
# → http://localhost:3000 (default Next.js 페이지가 뜨면 OK)
# Ctrl+C로 종료
```

읽을 문서 (총 ~30분):
1. **이 파일 (SESSION_PROGRESS.md)** — 5분
2. **`.claude/RULES.md`** — 5분 (binding rules)
3. **`AGENTS.md`** — 3분 (Stack 변경사항)
4. **`HANDOFF/AUTH_UX.md`** — 10분
5. **`HANDOFF/API_INTEGRATION.md`** §4-5 — 5분 (single-flight refresh + WS envelope)

### 1. Phase 1.1 — 인증 인프라 + 폼 + 페이지 (목표 ~3시간)

**원래 plan은** `/Users/jsh14/.claude/plans/1-floating-pixel.md`. 다만 plan은 **Tailwind v3 / Next.js 15 가정**으로 작성됨 — 다음 세션은 v4/v16 패턴으로 수정해서 진행.

순서:

#### Step 1. 기본 설정 (~30분)
- `src/app/layout.tsx`: `<html lang="ko" className="dark">` + `<body>` 안에 `<Toaster />`(sonner) + `<AppBoot />`
- `src/app/globals.css`: 기존 `@import "tailwindcss"` 유지, `@custom-variant dark (&:where(.dark, .dark *));` 추가, `:root`/`@theme` 다크모드 변수 정리
- `src/lib/env.ts`: zod로 `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` 검증 + export
- `next.config.ts`: `headers()` 메소드로 CSP — `HANDOFF/ARCHITECTURE.md §6` 참조

#### Step 2. 인증 헬퍼 (~30분)
- `src/lib/auth/storage.ts`: `getAccessToken/getRefreshToken/setTokens/clear` (localStorage)
- `src/lib/auth/jwt.ts`: `decodeJwt(token)` + `isExpiringSoon(token, marginSec=30)`
- `src/lib/auth/oauthCallback.ts`: `parseHash()` + `clearHash()` (`history.replaceState`)
- `src/lib/uuid.ts`: `crypto.randomUUID()` wrapper (`typeof window` 가드)

#### Step 3. API client + 단일-플라이트 refresh (~45분 — 가장 까다로움)
- `src/lib/api/client.ts`: `apiFetch(path, init)` + 401 시 single-flight refresh
  - 글로벌 `refreshPromise: Promise<string> | null`
  - 첫 401 → `doRefresh()` → 결과 promise를 모든 동시 401 호출에 공유
  - refresh 실패 → `clearTokens()` + `window.dispatchEvent(new Event('auth:logout'))`
  - **`HANDOFF/API_INTEGRATION.md §4` 시퀀스 그대로 구현**
- `src/lib/api/auth.ts`: 8개 함수 (signup/login/refresh/logout/me/withdraw/completeOAuthSignup/linkProvider) + zod request/response 스키마
- **이 단계만 별도 sub-agent에 위임 권장** (`executor` opus)

#### Step 4. Zustand store + AppBoot (~30분)
- `src/store/auth.ts`: slice — `user, accessToken, refreshToken, status: 'idle'|'loading'|'authenticated'|'unauthenticated'` + actions (`setTokens, setUser, logout, hydrate`)
- `src/components/AppBoot.tsx`: `'use client'` — mount 시 storage hydrate → token 있으면 `me()` 호출 → 결과로 status 결정 → 401 catch 시 logout

#### Step 5. UI 프리미티브 + 인증 폼 + 페이지 (~1.5시간)
- `src/components/ui/{Button,Input,Spinner}.tsx`
- `src/components/auth/{OAuthButtons,SignupForm,LoginForm}.tsx` (rhf + zod)
- `src/app/page.tsx` ('use client', 랜딩 = SignupForm + OAuthButtons + "개인정보 수집 X" hero)
- `src/app/(public)/login/page.tsx`, `src/app/(public)/signup/page.tsx`

#### Step 6. 검증 (~15분)
- `npx tsc --noEmit` 통과
- `npm run lint` 통과
- `npm run build` 통과
- `npm run dev` → localhost:3000 다크모드 랜딩 정상

### 2. 검증 패스 → 코드 리뷰 → 커밋 (~30분)
- sub-agent `verifier` (sonnet) → 빌드/타입 검증
- sub-agent `code-reviewer` (sonnet) → 단일-플라이트 동시성 / XSS 표면 / `'use client'` 누락
- atomic commits (6개) — 원래 plan의 commit 메시지 사용

### 3. 세션 종료 직전
- **`refresh-context` 스킬 호출**: "최신화" / "refresh-context" 등으로 트리거. Stop hook이 dirty tree 감지 시 자동으로 안내.
- 이 파일(`SESSION_PROGRESS.md`) 갱신.
- `.claude/RULES.md`에 새로 정해진 규칙 있으면 추가.

---

## Blockers / decisions needed

| 항목 | 상태 | 비고 |
|---|---|---|
| Tailwind v3 → v4 마이그레이션 | 신규 패턴 (CSS config) 적용 필요 | RULES.md R4에 명시됨. globals.css만 손대면 됨. |
| Next.js 15 → 16 차이 | App Router 자체는 호환, 일부 API 변경 가능 | `node_modules/next/dist/docs/` 참조하라고 AGENTS.md 표시. |
| 모바일 앱 전략 | ✅ **결정됨** — `MOBILE_STRATEGY.md` 참조 | M1: PWA, M2: React Native + Expo |
| `.claude/worktrees/` gitignore 머지 | 보류 | parent repo 머지 시점에 결정 |

---

## Important context

### Worktree 작업 중
- 위치: `geek-chat-web-v2/.claude/worktrees/fervent-bell-35addf/`
- 브랜치: `claude/fervent-bell-35addf`
- 부모 repo의 `.git/worktrees/fervent-bell-35addf` 참조 — `.git`을 직접 수정하지 말 것
- 머지 전략: 추후 PR로 부모 `main`에 merge

### 환경
- macOS, Node.js 18+ 가정
- Backend: `~/Work/geek-chat/geek-chat-server-v2/` (Kotlin/Spring Boot, 105 tests passing)
- 백엔드 dev 띄우는 법: `./gradlew bootRun --args='--spring.profiles.active=dev'` (MySQL Docker 필요)
- dev-login: `GET http://localhost:8080/auth/dev-login?name=Alice` → TokenPair (개발 가속용, prod 404)

### refresh-context 스킬 사용법
세션 종료 직전 또는 컨텍스트 압축 직전에:
- 사용자 트리거: "최신화", "refresh-context", "/refresh-context", "핸드오프 준비"
- 자동: Stop hook이 dirty tree에서 안내 메시지 출력 (exit 0, non-blocking)
- 수동 인벤토리: `bash .claude/skills/refresh-context/update.sh`

### 모바일 앱 결정 (M1 후)
- 풀 웹뷰: ❌ 비추 (메신저는 백그라운드/푸시 한계 치명적)
- 풀 네이티브: 시간/비용 고려 시 부담
- **React Native + Expo**: ⭐ 추천 (M2). v1에서 Expo 경험 있음, JS/TS 코드 일부 재사용 가능.
- M1 출시 시점: PWA로 모바일 임시 대응 (manifest.json + Service Worker). FCM Web Push로 알림.

상세 분석은 `MOBILE_STRATEGY.md` 참조.

---

## 한 줄 요약

> **부트스트랩 + 인프라 완료. 다음 세션은 RULES.md를 빠르게 훑고 Phase 1.1 Step 1부터 진행 (~3시간 예상). 끝날 때 refresh-context 스킬을 꼭 호출.**
