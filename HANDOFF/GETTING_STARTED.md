# Getting Started — 새 세션 진입 가이드

이 폴더는 GeekChat v2 Next.js 프론트엔드를 새 세션에서 시작하기 위한 핸드오프 자료다.
**아직 코드 한 줄도 없음**. `npx create-next-app`은 첫 세션에서 실행할 것.

작성일: 2026-05-08

---

## 0. 5분 안에 컨텍스트 잡기

**프로젝트**: GeekChat v2 — 실시간 메신저. 프라이버시 메신저 + 개발자 친화 포지셔닝.

**백엔드**: Kotlin/Spring Boot. 위치 `~/Work/geek-chat/geek-chat-server-v2/`. 105 tests passing. **친구 클라우드(10.64.212.20) Docker Compose로 배포 예정**.

**현재 위치 (이 폴더)**: 프론트엔드 (Next.js). 비어 있음. 셋업부터 시작.

**배포**: Vercel (auto-deploy on push to main).

**언어/스택**: Next.js 15 (App Router) + TypeScript + TailwindCSS. 다크모드 기본, 한국어 1차.

---

## 1. 읽는 순서 (필수)

1. **이 파일** (`GETTING_STARTED.md`) — 5분.
2. **`AUTH_UX.md`** — 인증 UX 정책 (와이어프레임 + 흐름) — 10분.
3. **`API_INTEGRATION.md`** — REST + WebSocket 컨트랙트 + 코드 스니펫 — 15분.
4. **`ARCHITECTURE.md`** — 폴더 구조 + 컴포넌트 트리 + 라이브러리 선택 — 10분.
5. **`COMPONENTS.md`** — 핵심 컴포넌트 명세 — 10분 (필요할 때만).
6. **`DEVELOPMENT_PLAN.md`** — Phase 1/2/3 작업 분할 — 5분.

**총 ~50분**. 그 후 코딩 시작.

추가 참조 (선택):
- `~/Work/geek-chat/geek-chat-server-v2/docs/API.md` — 백엔드 REST 전체
- `~/Work/geek-chat/geek-chat-server-v2/docs/WEBSOCKET.md` — WebSocket 전체
- `~/Work/geek-chat/geek-chat-server-v2/docs/PRD-M2.md` — 향후 추가 기능 계획

---

## 2. 첫 세션 권장 절차

```bash
# 1. 프로젝트 생성 (geek-chat-web-v2 폴더에서)
cd ~/Work/geek-chat/geek-chat-web-v2

# HANDOFF 폴더 보존, 나머지 비어있는지 확인
ls

# Next.js 15 + TypeScript + Tailwind + App Router + src/ + ESLint
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack

# (만약 폴더가 비어있지 않다고 거부하면 --use-npm 또는 임시 폴더에 생성 후 mv)

# 2. 의존성 추가
npm install zustand swr lucide-react sonner
npm install -D @types/node

# 3. 환경 변수
cat > .env.local <<EOF
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
EOF

cat > .env.example <<EOF
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://api.example.com/ws
EOF

# 4. .gitignore에 추가
echo ".env.local" >> .gitignore

# 5. 초기 commit
git add .
git commit -m "chore: bootstrap Next.js 15 with TypeScript + Tailwind + App Router"

# 6. 백엔드 dev 모드 띄우기 (별도 터미널)
cd ~/Work/geek-chat/geek-chat-server-v2
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=test -e MYSQL_DATABASE=geekchat mysql:8.0
./gradlew bootRun --args='--spring.profiles.active=dev'

# 7. 프론트 dev
cd ~/Work/geek-chat/geek-chat-web-v2
npm run dev
# → http://localhost:3000
```

---

## 3. 초기 작업 체크리스트 (Phase 1: 인증)

`DEVELOPMENT_PLAN.md` Phase 1 참조. 핵심:

- [ ] `npx create-next-app` 실행
- [ ] 폴더 구조 만들기 (ARCHITECTURE.md 참조)
- [ ] 환경 변수 + `src/lib/env.ts`
- [ ] `src/lib/api.ts` (fetch 래퍼 + 단일-플라이트 refresh)
- [ ] `src/store/auth.ts` (Zustand + localStorage persist)
- [ ] 페이지: 랜딩, /signup, /login
- [ ] 페이지: /auth/success, /auth/oauth-complete, /auth/oauth-link, /auth/error
- [ ] /me 페이지 + 회원탈퇴
- [ ] dev-login으로 빠른 테스트 (`/auth/dev-login?name=Alice`)
- [ ] 다크모드 + 한국어 텍스트

Phase 2 (채팅) / Phase 3 (그룹+초대) — `DEVELOPMENT_PLAN.md` 참조.

---

## 4. 백엔드와 동시 개발

**dev-login 활용** (개발 가속):
```typescript
// 백엔드 dev 프로필에서만 동작
fetch('http://localhost:8080/auth/dev-login?name=Alice')
  .then(r => r.json())
  .then(({ accessToken, refreshToken }) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
  })
```

OAuth 셋업 없이도 인증된 상태로 모든 기능 테스트 가능. 프로덕션에선 자동 비활성화 (404).

---

## 5. 코드 작성 시 절대 규칙

1. **모든 OAuth fragment 처리는 client-side**: `'use client'` 컴포넌트 + `useEffect` 안에서 `window.location.hash` 파싱.
2. **mount 즉시 hash 제거**: `history.replaceState({}, '', '/path')` — referer 누출 방지.
3. **WebSocket은 글로벌 단일 인스턴스**: Zustand store에 보관. 컴포넌트마다 새로 만들면 서버 max-3 위반.
4. **fetch는 항상 `src/lib/api.ts` 래퍼 거치기**: 직접 `fetch()` 호출 X (refresh 처리 누락).
5. **clientMessageId는 `crypto.randomUUID()` 사용**: 백엔드 멱등성 키.
6. **토큰 만료 시 자동 refresh 실패 → 즉시 로그아웃**: localStorage clear + `/login` redirect.
7. **개인정보 수집 X 메시지는 랜딩 hero에 명시**: 마케팅 핵심.

---

## 6. 자주 빠지는 함정

| 함정 | 해결 |
|---|---|
| OAuth callback에서 hash가 사라짐 | 페이지 mount 직후 즉시 파싱 + replaceState. SSR 컴포넌트로 만들면 안 됨 |
| 401 시 무한 refresh 루프 | 단일-플라이트 큐 + 1회만 재시도 |
| WS 재연결 폭주 | 지수 백오프 (cap 30초) + intentionalClose 플래그 |
| Vercel preview deploy CORS 차단 | 백엔드 `FRONTEND_ORIGIN_PATTERNS=https://*.vercel.app` 등록되어 있음 |
| `crypto.randomUUID()` SSR 에러 | `'use client'` 컴포넌트 안에서만 호출 |
| Hydration mismatch (다크모드) | `next-themes` 또는 mount 후 `setMounted(true)` 패턴 |

---

## 7. 자주 쓰는 명령

```bash
# Dev
npm run dev                          # localhost:3000
npm run build                        # production build 검증
npm run lint

# 백엔드 (별도 터미널)
cd ~/Work/geek-chat/geek-chat-server-v2
./gradlew bootRun --args='--spring.profiles.active=dev'
./gradlew test                       # 105 tests

# 통합 테스트
curl http://localhost:8080/health
curl 'http://localhost:8080/auth/dev-login?name=Alice'
```

---

## 8. 다음 세션이 막혔을 때

1. **API 응답 모름** → `~/Work/geek-chat/geek-chat-server-v2/docs/API.md` 또는 백엔드 `AuthController.kt` 직접 확인.
2. **WS 이벤트 모름** → `docs/WEBSOCKET.md` 또는 `ChatWebSocketHandler.kt`.
3. **헥사고날 규칙 모름** → `~/Work/geek-chat/geek-chat-server-v2/.claude/RULES.md`.
4. **다음에 만들 기능 모름** → `docs/PRD-M2.md`의 P0 7개 (M2 마일스톤).
5. **전체 기능 인벤토리** → `docs/PRD-M2.md` §1 카카오톡/라인 매트릭스.

---

## 9. 한 줄 요약

> **백엔드는 다 돼있다 (105 tests). 프론트엔드는 인증 → 채팅 → 그룹/초대 순서로 만들면 끝.**
