---
name: refresh-context
description: 프로젝트 문서를 최신화하고 HANDOFF.md를 갱신하여 새 세션에서 작업을 이어갈 수 있도록 합니다. 트리거 — '최신화', '핸드오프', 'refresh context', 'handoff', '이어서 작업', '문서 갱신', '/refresh-context'. 의미 있는 작업 후, 컨텍스트 압축 직전, 또는 세션 종료 직전에 호출합니다.
---

# refresh-context

이 스킬은 한 세션의 작업 결과를 다음 세션이 컨텍스트 없이도 이어받을 수 있도록 정리합니다.

## 언제 실행되나

- **자동 (Stop hook)**: working tree에 변경사항이 있으면 세션 종료 시 사용자에게 reminder가 표시됨. Claude가 직접 이 스킬을 invoke해서 정리.
- **수동 트리거**: 사용자가 "최신화", "핸드오프 준비", "refresh-context", "/refresh-context" 등으로 요청.
- **컨텍스트 압축 직전**: 토큰이 많이 누적된 상태에서 곧 압축이 일어날 것 같으면 미리 호출.

## 무엇을 하나

다음 6단계를 **이 순서로** 실행:

### 1. 현재 상태 인벤토리

```bash
# 변경된 파일
git status -s

# 마지막 커밋 이후 추가된 커밋 수
git rev-list --count HEAD@{1}..HEAD 2>/dev/null || echo 0

# 어느 라이브러리가 새로 깔렸나
git diff HEAD@{1} -- package.json package-lock.json 2>/dev/null | head -50
```

### 2. AGENTS.md 버전 마커 동기화

`package.json`이 변경되었으면 AGENTS.md "Stack" 표의 버전을 업데이트.
- Next.js 메이저 버전: `npm ls next | head -2`
- React: `npm ls react | head -2`
- Tailwind: `npm ls tailwindcss | head -2`
- 변경된 부분만 `Edit`으로 갱신 (전체 rewrite 금지).

### 3. HANDOFF/SESSION_PROGRESS.md 갱신

이 파일이 다음 세션의 진입점. 항상 최신 상태로 유지.

```markdown
# Session Progress — last updated YYYY-MM-DD

## Current state (one-liner)
<한 문장으로 지금 상태>

## Done this session
- [x] <작업 1>
- [x] <작업 2>

## In-flight (paused mid-step)
- <끊긴 단계 + 정확히 어디서 멈췄는지>

## Next session — start here
1. <첫 명령>
2. <두 번째>
3. <검증 명령>

## Blockers / decisions needed
- <있으면 적기, 없으면 "None">

## Important context
- <환경 차이, 외부 의존성 변경, 신규 결정사항 등>
```

기존 파일이 있으면 **append + 섹션 갱신**. 전체 rewrite 금지.

### 4. 변경된 결정사항을 RULES.md에 반영

세션 중 새로 정해진 규칙이 있으면 `.claude/RULES.md`에 추가. 단, 이 스킬은 새 규칙을 **추측해서 만들지 않음** — 사용자나 코드에 명시적으로 등장한 결정만 반영.

### 5. 다음 세션 가이드 검증

`HANDOFF/SESSION_PROGRESS.md`의 "Next session — start here" 섹션이:
- 실제 실행 가능한 명령으로 시작하는지 (`cd`, `npm run dev` 등)
- 가정 없이 readable한지 (이 conversation을 못 본 사람이 따라할 수 있는지)
- 첫 5줄 안에 "지금 어디까지 됐고 다음에 뭘 한다"가 들어있는지

확인 후 부족하면 채움.

### 6. 결과 보고

사용자에게 짧은 요약을 markdown 테이블로 출력:

| 항목 | 상태 |
|---|---|
| AGENTS.md 버전 마커 | 동기화 / 변경 없음 |
| SESSION_PROGRESS.md | 갱신됨 (섹션 N개) |
| RULES.md | 변경 없음 / 규칙 N개 추가 |
| 다음 세션 첫 명령 | `<command>` |
| 미해결 결정사항 | None / 1-2개 |

## 절대 하지 말 것

- 코드 파일을 수정하지 말 것 (`src/**`). 이 스킬은 **문서 동기화 전용**.
- 새 규칙을 추측해서 RULES.md에 추가하지 말 것 (실제 결정만).
- 기존 HANDOFF/ 문서를 rewrite하지 말 것 (섹션 단위 patch).
- `.git/`이나 worktree state를 건드리지 말 것.
- 커밋을 자동으로 만들지 말 것 — staging만 하고 사용자 승인 후 commit.

## 구현 헬퍼

빠른 호출용 쉘 스크립트가 함께 있음: `update.sh`. 이 스크립트는 인벤토리 데이터를 stdout으로 뱉기만 함 (실제 파일 수정은 Claude가 함). 사용:

```bash
bash .claude/skills/refresh-context/update.sh
```

출력 예시:
```
=== git status ===
 M src/lib/api/client.ts
?? src/lib/api/auth.ts

=== package.json diff ===
+    "zustand": "^5.0.2",
+    "swr": "^2.3.0",

=== last commit ===
65706ac docs: handoff for next session (Next.js 15 frontend)

=== current branch ===
claude/fervent-bell-35addf
```

이 출력을 보고 Claude가 위 6단계를 수행.
