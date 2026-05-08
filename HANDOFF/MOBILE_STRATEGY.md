# Mobile Strategy — GeekChat v2

작성일: 2026-05-08
의도: 모바일 앱 배포 옵션을 메신저 도메인 관점에서 비교. 결정과 단계별 진행 계획.

---

## TL;DR

| 시점 | 전략 | 이유 |
|---|---|---|
| **M1 (현재)** | Next.js Web만 | 검증 우선. 코드 1개로 데스크톱+모바일 브라우저 커버 |
| **M1 후반** | + PWA (manifest + Service Worker) | "홈 화면에 추가" + Web Push로 모바일 사용자 임시 대응 |
| **M2** | + React Native (Expo) | 메신저 핵심(백그라운드 메시지/푸시)은 네이티브가 필수 |
| **M3+** | RN 유지 + 일부 native 모듈 | WhatsApp/Discord 패턴 — 사용량 데이터로 판단 |

**금지**: 풀 웹뷰(Capacitor만으로 모든 기능). 메신저로는 부적합.

---

## 1. 옵션 비교

### A. 풀 웹뷰 (Capacitor / Cordova / Tauri Mobile)

Next.js export → WebView로 감싸 iOS/Android 패키지로 배포.

**장점**
- 한 코드베이스로 web/iOS/Android 동시 출시
- 이미 만든 Next.js 그대로 활용 (M1 가속)
- 웹 배포 즉시 반영 (스토어 심사 회피, 핫픽스 강력)
- 1인 또는 소수 팀에 비용 효율

**메신저 관점 단점 (치명적)**
| 문제 | 영향 |
|---|---|
| 백그라운드 WebSocket 종료 | iOS 30초 내 절전 → 메시지 즉시 수신 불가 |
| 푸시 알림 = 결국 네이티브 플러그인 | FCM/APNs 연동 시 WebView의 단순함 사라짐 |
| iOS WebView 메모리 한계 | 메시지 1만 개 스크롤 시 OOM |
| 앱스토어 심사 4.2 거절 사유 | "단순 웹사이트 래퍼"는 거절될 수 있음 |
| 키보드 UX | iOS Safari WebView 키보드 처리가 native보다 부자연스러움 (메신저 입력 핵심) |
| Cold start | WebView + JS 번들 로딩 1-3초 |
| 백그라운드 동기화 | iOS Background Fetch 15분+ 간격 |

**판정**: ❌ **메신저는 웹뷰 비추**. 콘텐츠 앱(쇼핑/뉴스)에는 OK.

### B. 풀 네이티브 (Kotlin + Swift)

각 플랫폼 SDK로 별도 개발.

**장점**
- 백그라운드 메시지 (FCM Data Message + Service Worker) — 앱 종료 상태에서도 수신
- OS 네이티브 푸시 (잠금화면, 그룹화, 답장 액션, Live Activity, Dynamic Island)
- 성능 (메시지 10만 개 스크롤 60fps)
- 배터리 효율 (Doze, Battery Saver 호환)
- HIG / Material 3 정확히 준수 — 메신저 사용자는 OS 일관성에 민감
- 마이크/카메라/연락처 native UX
- 종단간 암호화 (Signal Protocol native lib)
- 앱스토어 통과 위험 최소

**단점**
- 두 코드베이스 (Kotlin + Swift), 시간 ~2배
- iOS 모르면 Swift + UIKit/SwiftUI 학습 필요
- 한쪽 기능 추가 시 다른 쪽도 동시 작업 (sync 부담)
- 두 OS, 다양한 기기 매트릭스 테스트
- 1인 개발자 / 소수 팀에 부담

**판정**: 품질 최상이지만 **현 GeekChat 인력 규모(1인)에는 과도**. M3+에서 사용량 데이터 보고 판단.

### C-1. React Native + Expo ⭐ 추천

JS/TS + 네이티브 컴포넌트. WhatsApp/Discord/Skype/Bluesky가 채택.

**장점**
- 한 코드베이스 (Web과 70-80% 코드 공유 가능 — zod 스키마, 타입 정의, API 클라이언트)
- 네이티브 푸시 (Expo Notifications / Notifee)
- 백그라운드 WebSocket: FCM data message로 wake up + native socket
- v1에서 expo-web 사용 경험 있음 (geek-chat-web v1)
- **CLAUDE.md에 "Phase 2: React Native (예정)" 이미 명시**
- EAS Build로 iOS/Android 빌드 + OTA 업데이트
- 한국 OAuth (네이버) 라이브러리 풍부

**단점**
- 일부 Native API는 별도 모듈 작성 필요
- New Architecture (Fabric/TurboModules) 전환기 — 라이브러리 호환성 주의
- iOS/Android별 디버깅 여전히 필요
- UI 작은 차이는 결국 OS별 분기

**판정**: ⭐ **M2 진입 시 1순위 옵션**. 메신저 분야 검증된 트랙(WhatsApp 등) + JS/TS 연속성.

### C-2. Flutter

Dart + Skia 자체 렌더링.

**장점**
- 단일 코드베이스, 매우 빠른 UI
- 모든 플랫폼 픽셀 동일
- 핫 리로드 강력

**단점**
- Dart 학습 필요
- iOS native look & feel 일부 부족
- 백엔드(Kotlin)와 언어 분리 — 타입/스키마 공유 어려움
- GeekChat 도메인에 fit 낮음 (텍스트 위주 메신저는 Flutter의 그래픽 강점 활용 X)

**판정**: ❌ 백엔드 Kotlin과 시너지 약함. RN 우위.

### C-3. Kotlin Multiplatform (KMP)

비즈니스 로직 공유 + 플랫폼별 native UI.

**장점**
- 백엔드(Spring Boot Kotlin)와 도메인 모델 공유 가능 ⭐
- 백그라운드/푸시 native
- iOS는 Swift, Android는 Kotlin — 둘 다 native

**단점**
- iOS UI는 결국 SwiftUI 작성 (UI 두 번)
- 메신저 사례 적음 (RN/Flutter 대비)
- 생태계 작음
- 1인 운영 부담은 풀 네이티브와 비슷

**판정**: 매력적이지만 사례 부족 + iOS UI 별도 작성 부담. **M3+에 재검토**.

### C-4. Capacitor (웹뷰 진화형)

웹뷰 베이스지만 native plugin 풍부.

**장점**
- 마켓 빠른 진입 (긴급용)
- 친숙한 웹 코드

**단점**
- 백그라운드 WebSocket / 푸시 한계는 풀 웹뷰와 동일
- Plugin마다 iOS/Android 별도 구현 필요

**판정**: 비상용. 정식 모바일은 RN으로.

---

## 2. GeekChat 결정 트리

```
M1 (현재 마일스톤) — 출시 검증
├─ Web (Next.js 16) ✅ 진행 중
├─ M1 후반: PWA 추가
│   • manifest.json (앱 이름, 아이콘, 시작 URL)
│   • Service Worker (오프라인 캐시 + Web Push 수신)
│   • "홈 화면에 추가" UX 가이드 페이지
│   • Web Push API + FCM 연동 (M2 P0 1번 항목 일부 선행)
│   → 모바일 앱 출시 전 사용자 검증 + 임시 대응
└─ 모바일 앱 결정 = M1 PMF 검증 후

M2 (다음 마일스톤)
├─ React Native + Expo 시작
│   1. geek-chat-app/ 폴더 생성 (CLAUDE.md에 자리 있음)
│   2. expo-router로 Web과 라우트 구조 동일화
│   3. 공통 코드 추출
│      • zod schemas
│      • API client (apiFetch)
│      • domain types
│      • i18n 메시지 맵
│      → geek-chat-shared/ 패키지로 분리 검토
│   4. 네이티브 only 부분
│      • Expo Notifications (FCM 통합)
│      • react-native-keychain (토큰 저장 — localStorage 대체)
│      • react-native-mmkv 또는 expo-sqlite (메시지 캐시)
│      • react-native-reanimated (스크롤 성능)
│   5. EAS Build → TestFlight + Internal Testing
└─ Capacitor wrapper는 비상 옵션 (앱 마켓 빠른 진입용 임시)

M3+ (성장기)
└─ 사용자 10K+ → 풀 네이티브 vs RN 유지 결정
   • 성능 병목 측정 (메시지 10K+ 스크롤, 동시 채팅방 다중 표시)
   • 1-2 named native 모듈 도입 (메시지 리스트, push)
   • 또는 풀 네이티브 전환 (사용량/팀 규모에 따라)
```

---

## 3. PWA (M1 후반) 작업 항목

```
manifest.json
  ├─ name: "GeekChat"
  ├─ short_name: "GeekChat"
  ├─ icons (192/512)
  ├─ start_url: "/"
  ├─ display: "standalone"
  ├─ background_color: "#0a0a0a"
  └─ theme_color: "#171717"

Service Worker (sw.ts)
  ├─ install: 정적 자원 캐시
  ├─ activate: 오래된 캐시 정리
  ├─ fetch: API는 network-first, 정적은 cache-first
  └─ push: FCM Web Push 수신 → showNotification

src/lib/push/web-push.ts
  ├─ Notification permission 요청
  ├─ FCM token 발급 → 백엔드 등록 API 호출
  └─ unregister on logout
```

백엔드 작업 (서버 V2 M2 P0 1번):
- FCM Admin SDK 통합
- POST /api/users/me/push-tokens (등록)
- DELETE /api/users/me/push-tokens (해제)
- new_message 이벤트 hook → 오프라인 사용자에게 push 발송

---

## 4. RN 전환 시 고려사항 (M2)

### 코드 공유 계획
| 영역 | Web에서 그대로 | RN으로 재작성 |
|---|---|---|
| zod 스키마 | ✅ 그대로 | |
| API client (apiFetch) | ✅ 거의 그대로 (fetch는 같음) | localStorage → SecureStore/Keychain |
| Domain types | ✅ | |
| i18n strings | ✅ | |
| OAuth callback hash 파싱 | 일부 | 딥링크(deep link)로 변경 |
| WebSocket | 네이티브 ws 라이브러리 사용 | (헤더 처리 등 다름) |
| Zustand store | ✅ 호환 | |
| UI 컴포넌트 | ❌ 재작성 | TextInput / Pressable / FlatList |
| Routing | Next App Router → expo-router (App Router 비슷) | |
| Tailwind | ❌ | NativeWind (Tailwind for RN) |

### 패키지 모노레포 검토
- `geek-chat-shared/` (npm workspace)
  - `schemas/` (zod)
  - `types/`
  - `api/` (fetch wrapper, OAuth flow logic)
  - `ws/` (envelope types, reconnect logic)
- `geek-chat-web-v2/` (Next.js)
- `geek-chat-app/` (Expo)

pnpm + workspaces 또는 turbo 검토. 단, M1 출시 전에는 over-engineering — M2 진입 시 결정.

---

## 5. 결정 요약

- **풀 웹뷰**: ❌ 메신저로 부적합 (백그라운드/푸시/메모리)
- **풀 네이티브**: ❌ 1인 운영 부담 (M3+ 재검토)
- **React Native + Expo**: ⭐ **M2 1순위**
- **PWA**: ⭐ **M1 후반에 임시 대응**
- **Flutter**: ❌ 백엔드 Kotlin과 시너지 약함
- **KMP**: 보류 (M3+ 사례 추적 후 재검토)
- **Capacitor**: ❌ 비상용

---

## 6. 다음 행동

1. **이번 마일스톤 (M1)**: Next.js Web 완성에 집중 — 모바일은 PWA로 대응
2. **M1 출시 후**: PWA manifest + Web Push 추가 (백엔드 FCM Admin과 동시 작업)
3. **M2 시작**: `geek-chat-app/` Expo 초기화 + `geek-chat-shared/` 분리 검토

이 문서는 결정사항 기록. M1 후반에 PWA 작업 시 별도 PWA-PLAN.md 작성, M2 진입 시 RN-MIGRATION.md 작성.
