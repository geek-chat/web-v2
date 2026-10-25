# geek-chat-web-v2

GeekChat v2 웹 프론트엔드. Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript.

**현재 상태**: Phase 1 인증을 구현했다 (가입, 로그인, single-flight 토큰 갱신, OAuth 콜백 4종, AuthGuard, `/me`의 유저네임 변경과 로그아웃, 탈퇴). 다음은 Phase 2 채팅이다. 백엔드는 아직 배포 전이라 로컬 백엔드로 개발한다.

**시작점**: [`HANDOFF/SESSION_PROGRESS.md`](HANDOFF/SESSION_PROGRESS.md)

## 개발

```bash
npm ci
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL을 로컬 값으로 바꾼다
npm run dev                  # http://localhost:3000
```

검증: `npm test` (Vitest), `npx tsc --noEmit`, `npm run lint`, `npm run build`

## HANDOFF 문서 목록

| 파일 | 내용 |
|---|---|
| `HANDOFF/SESSION_PROGRESS.md` | 현재 상태와 다음 세션 진입 순서 (정본) |
| `HANDOFF/GETTING_STARTED.md` | 5분 컨텍스트 (작성 당시 기준, 상단 안내 참고) |
| `HANDOFF/AUTH_UX.md` | 인증 UX 정책 (와이어프레임 + 흐름) |
| `HANDOFF/API_INTEGRATION.md` | REST + WebSocket 컨트랙트 + 코드 스니펫 |
| `HANDOFF/ARCHITECTURE.md` | 폴더 구조 + 라이브러리 선택 + 데이터 흐름 |
| `HANDOFF/COMPONENTS.md` | 핵심 컴포넌트 명세 + props |
| `HANDOFF/DEVELOPMENT_PLAN.md` | Phase 1/2/3 작업 분할 |
| `HANDOFF/MOBILE_STRATEGY.md` | 웹뷰, 네이티브, React Native 비교와 결정 트리 |

에이전트 규칙은 [`AGENTS.md`](AGENTS.md)와 [`.claude/RULES.md`](.claude/RULES.md)에 있다.

## 백엔드

`~/Work/geek-chat/geek-chat-server-v2/` (Kotlin/Spring Boot). 배포 대상은 Render + Supabase Postgres이고 아직 배포 전이다. 이 저장소에서는 읽기만 한다.
