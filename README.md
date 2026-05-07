# geek-chat-web-v2

GeekChat v2 — Next.js 15 프론트엔드 (예정).

**현재 상태**: 비어있음. 셋업 전.
**다음 세션**: 새 Claude 세션이 `HANDOFF/` 폴더 읽고 시작 가능.

## 시작점

→ **`HANDOFF/GETTING_STARTED.md`** 부터 읽으세요.

## HANDOFF 문서 목록

| 파일 | 내용 |
|---|---|
| `HANDOFF/GETTING_STARTED.md` | 5분 컨텍스트 + 첫 명령어 |
| `HANDOFF/AUTH_UX.md` | 인증 UX 정책 (와이어프레임 + 흐름) |
| `HANDOFF/API_INTEGRATION.md` | REST + WebSocket 컨트랙트 + 코드 스니펫 |
| `HANDOFF/ARCHITECTURE.md` | 폴더 구조 + 라이브러리 선택 + 데이터 흐름 |
| `HANDOFF/COMPONENTS.md` | 핵심 컴포넌트 명세 + props |
| `HANDOFF/DEVELOPMENT_PLAN.md` | Phase 1/2/3 작업 분할 |

## 백엔드 위치

`~/Work/geek-chat/geek-chat-server-v2/` (Kotlin/Spring Boot, 105 tests passing).

백엔드 전체 컨텍스트: `~/Work/geek-chat/geek-chat-server-v2/CLAUDE.md`

## 한 줄 요약

> 백엔드는 다 돼있다. 프론트엔드는 인증 → 채팅 → 그룹/초대 순서로 만들면 끝.
