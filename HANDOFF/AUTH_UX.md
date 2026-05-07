# Auth UX 정책 (구현 가이드)

GeekChat v2 — 일반(ID/PW) + 소셜(Google/Naver) 인증을 어떻게 보여주고 처리할지.

작성일: 2026-05-08
대상: 다음 세션의 Next.js 프론트엔드 구현자

## 핵심 원칙

1. **개인정보 수집 최소화** — 전화번호 / 실명 X. 이메일도 옵션.
2. **단일 화면 가입/로그인** — 일반 + 소셜 같은 화면에서 선택
3. **가입 후 닉네임은 항상 필수** (일반은 폼에서, OAuth는 콜백 후 별도 단계)
4. **다크모드 기본**, 한국어 1차

---

## 1. 회원가입 흐름

### 흐름도

```
[랜딩]
  ↓ "시작하기"
[일반 가입 폼 + 소셜 버튼 병치 (단일 화면)]
  ├─ ID/PW 제출 → /auth/signup → 토큰 → [채팅 목록]
  └─ 소셜 버튼 → 서버 302 → OAuth provider → /auth/callback
       ├─ SignupRequired → /auth/oauth-complete (닉네임 입력)
       │     → /auth/oauth/complete-signup → 토큰 → [채팅 목록]
       ├─ LinkingRequired → /auth/oauth-link (계정 연동 확인)
       │     → /auth/link-provider {confirm: true|false}
       └─ LoggedIn → /auth/success (토큰 추출 → 채팅 목록)
```

### 랜딩 와이어프레임

```
┌─────────────────────────────┐
│  GeekChat                   │
│                             │
│  전화번호도, 실명도,         │
│  이메일도 필요 없습니다.     │
│                             │
│  [  시작하기  ]  [  로그인  ]│
└─────────────────────────────┘
```

**Why**: 개인정보 최소화가 핵심 차별점. 첫 화면 hero 텍스트가 그 선언이어야 함.

### 일반 가입 폼 (`/signup`)

```
┌─────────────────────────────┐
│  아이디 *                   │
│  [___________________]      │
│                             │
│  비밀번호 *                 │
│  [___________________]      │
│                             │
│  닉네임 *                   │
│  [___________________]      │
│                             │
│  이메일 (선택)              │
│  [___________________]      │
│  ⚠ 입력하지 않으면          │
│    비밀번호 찾기 불가       │
│                             │
│  [   가입하기   ]           │
│  ─── 또는 ───              │
│  [G Google]  [N Naver]     │
└─────────────────────────────┘
```

**Why**: 이메일은 폼 안에 있되, 미입력 시 비밀번호 복구 불가 경고를 인라인 표시. 별도 단계로 분리하면 소셜 전환 포인트가 애매해짐.

### 에러 처리 (인라인 + 폼 상단 배너)

| 케이스 | 위치 | 문구 |
|---|---|---|
| username 중복 (409) | 아이디 필드 하단 | "이미 사용 중인 아이디입니다" |
| 약한 비밀번호 (400) | 비밀번호 필드 하단 | "8자 이상, 영문 + 숫자 포함" |
| 이메일 중복 (409) | 이메일 필드 하단 | "이미 등록된 이메일입니다" |
| 닉네임 누락 (400) | 닉네임 필드 하단 | "닉네임은 필수입니다" |
| 네트워크 오류 | 폼 상단 배너 | "잠시 후 다시 시도해주세요" |

---

## 2. 로그인 흐름

### 단일 화면 (`/login`)

```
┌─────────────────────────────┐
│  로그인                     │
│                             │
│  아이디                     │
│  [___________________]      │
│                             │
│  비밀번호                   │
│  [___________________]      │
│                             │
│  [   로그인   ]             │
│                             │
│  비밀번호를 잊으셨나요?     │
│                             │
│  ─── 소셜 로그인 ───        │
│  [G Google]  [N Naver]     │
│                             │
│  계정이 없으신가요? 가입하기│
└─────────────────────────────┘
```

**Why**: 단일 화면이 분리 화면보다 단계가 적음. 비밀번호 찾기 링크는 항상 표시하되, 클릭 시 이메일 미등록이면 서버 에러로 안내 (클라이언트는 등록 여부 알 수 없음).

### OAuth 분기: LinkingRequired (`/auth/oauth-link`)

URL 형식: `/auth/oauth-link#link_token=...&existing_nickname=...&new_provider=...`

```
┌─────────────────────────────┐
│  이미 가입된 계정이 있습니다│
│                             │
│  "{existing_nickname}" 계정에│
│  {new_provider} 로그인을    │
│  연결하시겠습니까?          │
│                             │
│  [  연결하기  ]  [  취소  ] │
│                             │
│  연결하면 두 방법으로       │
│  로그인할 수 있습니다.      │
└─────────────────────────────┘
```

처리:
- "연결하기" → `POST /auth/link-provider {linkToken, confirm: true}` → `LoggedIn` (토큰 저장)
- "취소" → `POST /auth/link-provider {linkToken, confirm: false}` → `SignupRequired` (signupToken 받아 `/auth/oauth-complete`로 전환)

### OAuth 분기: SignupRequired (`/auth/oauth-complete`)

URL 형식: `/auth/oauth-complete#signup_token=...&suggested_nickname=...`

```
┌─────────────────────────────┐
│  거의 다 됐습니다           │
│                             │
│  닉네임을 정해주세요        │
│  [___________________]      │
│   (제안: suggested_nickname)│
│                             │
│  [   시작하기   ]           │
└─────────────────────────────┘
```

**중요**: 페이지 mount 즉시 `history.replaceState({}, '', '/auth/oauth-complete')`로 hash 제거 (referer 누출 방지).

**Why**: URL 분리 페이지 구현은 새로고침에도 fragment 토큰이 살아있어 상태 손실 없음. 모달은 새로고침 시 상태 날아감.

### OAuth 분기: LoggedIn (`/auth/success`)

URL 형식: `/auth/success#access_token=...&refresh_token=...`

처리: 클라이언트 컴포넌트에서 `window.location.hash` 파싱 → localStorage 저장 → `history.replaceState`로 hash 제거 → `/rooms` redirect.

**SSR 주의**: hash는 서버에서 접근 불가. 반드시 `'use client'` 컴포넌트.

---

## 3. 회원탈퇴 흐름 (`/me`)

진입: `/me` → "계정 설정" → "탈퇴"

```
┌─────────────────────────────┐
│  정말 탈퇴하시겠습니까?     │
│                             │
│  탈퇴하면 닉네임이          │
│  익명화되며 (deleted_user_) │
│  다시 로그인할 수 없습니다.│
│  메시지/방은 유지됩니다.    │
│                             │
│  아래에 DELETE MY ACCOUNT  │
│  를 입력해주세요.           │
│                             │
│  [___________________]      │
│                             │
│  [   탈퇴하기   ]  ← 비활성 │
│  (입력 일치 시에만 활성화)  │
└─────────────────────────────┘
```

**Why**: 텍스트 입력 방식은 일반/소셜 계정 구분 없이 공통 적용 가능. 비밀번호 재입력은 일반 계정에만 적용되어 분기가 필요해짐.

### 탈퇴 처리 순서

1. `POST /auth/withdraw` (Bearer 인증) 호출 → 200 응답 대기
2. localStorage에서 토큰 삭제
3. `/` (랜딩) redirect
4. "계정이 삭제되었습니다" 토스트 표시

**순서 중요**: 토큰 삭제는 응답 수신 후에. 미리 삭제하면 401 발생.

---

## 4. 토큰 저장 + 갱신 (구현 결정)

### 결정: localStorage

**이유**:
- 백엔드 OAuth 콜백이 URL fragment로 토큰 전달 → JS에서만 읽을 수 있음 → HttpOnly cookie 전환은 백엔드 콜백 재설계 필요
- localStorage는 최소 변경 경로

**XSS 트레이드오프**: 신뢰할 수 없는 서드파티 스크립트가 없으면 수용 가능. CSP 헤더로 보완.

### 401 자동 갱신 (단일-플라이트 큐)

```typescript
// src/lib/api.ts (스니펫)
let isRefreshing = false
let pendingRequests: Array<() => void> = []

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let res = await fetchWithToken(url, options)

  if (res.status !== 401) return res

  // 401: refresh 시도
  if (isRefreshing) {
    // 다른 요청이 이미 refresh 중 → 큐에 대기
    await new Promise<void>((resolve) => pendingRequests.push(resolve))
  } else {
    isRefreshing = true
    try {
      const refreshed = await fetch('/auth/refresh', { ... })
      if (!refreshed.ok) throw new Error('refresh failed')
      // 새 토큰 저장
      const { accessToken, refreshToken } = await refreshed.json()
      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('refresh_token', refreshToken)
      pendingRequests.forEach((r) => r())
      pendingRequests = []
    } catch (e) {
      // refresh 실패: 로그아웃
      localStorage.clear()
      window.location.href = '/login'
      throw e
    } finally {
      isRefreshing = false
    }
  }

  // 갱신된 토큰으로 재시도 (1회만)
  return fetchWithToken(url, options)
}
```

### WebSocket 토큰 만료 — Reactive 방식

```typescript
ws.onclose = (e) => {
  if (e.code === 1008 || e.code === 4001) {
    // 인증 실패 → refresh 후 재연결
    refreshToken().then(() => reconnect())
  } else {
    // 일반 종료 → 백오프 후 재연결
    setTimeout(reconnect, backoffMs())
  }
}
```

**Why**: proactive 방식 (JWT exp 파싱 후 타이머)은 복잡도 대비 이득 없음. 어차피 연결이 끊기므로 reactive가 단순.

---

## 5. UX 원칙

| 영역 | 결정 | Why |
|---|---|---|
| "개인정보 수집 X" 표현 | 랜딩 hero | 푸터/About에 묻으면 노출 안 됨 |
| 다크모드 | 기본 (light는 추가 작업) | 개발자 페르소나에 자연스러움 |
| 언어 | 한국어 1차, 영어 폴백 | next-intl 또는 단순 객체 맵 |
| 색상 | 검정 배경 + 회색 톤 + 액센트 한 색 | 슬랙/디스코드 톤 |
| 버튼 클릭 피드백 | 비활성 상태 시 disabled 명시 + 로딩 스피너 | 더블 클릭/네트워크 지연 대응 |

다크모드 토큰 (CSS variables 권장):
```css
:root {
  --bg: #0f0f0f;
  --surface: #1a1a1a;
  --text-primary: #f0f0f0;
  --text-secondary: #888;
  --accent: #4a9eff;
  --error: #ff4d4f;
  --success: #4ade80;
}
```

---

## 6. 페이지/라우트 요약

| 라우트 | 용도 | 인증 | Server vs Client Component |
|---|---|---|---|
| `/` | 랜딩 | No | Server (정적) |
| `/login` | 로그인 (일반 + 소셜) | No | Client (폼 상태) |
| `/signup` | 일반 가입 | No | Client |
| `/auth/success` | OAuth 성공 (hash → token) | No | Client (window.hash 접근) |
| `/auth/oauth-complete` | 신규 소셜 닉네임 입력 | No (signupToken) | Client |
| `/auth/oauth-link` | 계정 연동 확인 | No (linkToken) | Client |
| `/auth/error` | OAuth 오류 표시 | No | Server |
| `/me` | 내 정보 + 탈퇴 진입 | Yes | Client |

---

## 7. 다음 세션 구현 시 주의사항

1. `/auth/success` / `/auth/oauth-complete` / `/auth/oauth-link`는 hash 파싱 필요 → **반드시 `'use client'` 컴포넌트**.
2. mount 즉시 `history.replaceState({}, '', '/path')`로 hash 제거 (referer 누출 방지).
3. v1 (`geek-chat-web/`)의 `apiClient.ts` 단일-플라이트 패턴은 참고 가능. 단 `AsyncStorage` 의존 유틸은 제거 (Next.js는 localStorage 직접 사용).
4. 탈퇴: `POST /auth/withdraw`는 Bearer 토큰 필요. **응답 확인 후** 토큰 삭제.
5. CORS: 백엔드 `FRONTEND_ORIGIN_PATTERNS=https://*.vercel.app` 등록되어 있음 — preview deploy도 자동 허용.
6. 환경 변수:
   - `NEXT_PUBLIC_API_URL=https://api.<domain>` (예: localhost:8080 또는 production)
   - `NEXT_PUBLIC_WS_URL=wss://api.<domain>/ws`

---

## 8. 백엔드 컨트랙트 요약 (참고)

| Method | Path | 용도 | Auth | 응답 |
|---|---|---|---|---|
| POST | `/auth/signup` | 일반 가입 | No | `{accessToken, refreshToken}` |
| POST | `/auth/login` | 일반 로그인 | No | `{accessToken, refreshToken}` |
| POST | `/auth/withdraw` | 회원탈퇴 | Yes | `{success: true}` |
| GET | `/auth/google` | Google OAuth 시작 | No | 302 redirect |
| GET | `/auth/naver` | Naver OAuth 시작 | No | 302 redirect |
| GET | `/auth/callback` | OAuth 콜백 | No | 302 to `/auth/success` or `/auth/oauth-link` or `/auth/oauth-complete` |
| POST | `/auth/oauth/complete-signup` | 신규 소셜 닉네임 입력 | No (signupToken) | `{accessToken, refreshToken}` |
| POST | `/auth/link-provider` | 계정 연동 확인 | No (linkToken) | `{accessToken, refreshToken}` or `{signupToken, suggestedNickname}` |
| POST | `/auth/refresh` | 토큰 갱신 (rotation) | No | `{accessToken, refreshToken}` |
| POST | `/auth/logout` | 로그아웃 | No | `{success: true}` |
| GET | `/auth/me` | 내 정보 | Yes | `{id, nickname, username, profileImageUrl}` |

자세한 내용: `~/Work/geek-chat/geek-chat-server-v2/docs/API.md`
