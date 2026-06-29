# 블루프린트 — 리치 기능 (대화형 + 명령어)

saebyeok-bot의 리치 기능을 nuanua에 **새로 설계해 이식**한다. 코드를 베끼지 않고, nuanua의 단순성·SSOT·DRY·얕은 계층 원칙에 맞춰 재구성한다.

## 범위 (결정됨)

| 기능 | 포함? | 비고 |
|---|---|---|
| 답장/인용 (reply-to) | ✅ 코어 | 외부 의존 0 |
| 이미지 입력 | ✅ 코어 | Claude `Read` 도구 내장 |
| 파일 입력 | ✅ 코어 | 텍스트 인라인, 이미지는 위, 그 외 거부 |
| 음성 입력(STT) | ✅ **옵셔널** | 백엔드 미설치 시 비활성 + 설치 매뉴얼 |
| 음성 출력(TTS) | ✅ **옵셔널** | 위와 동일 |
| GitHub 자동화 | ❌ 제외 | turg 2026-06-18 "GitHub 자동 흐름 영구 폐기" 룰 존중 |

**원칙:** nuanua 코어는 가볍게(claude 구독 + 텍스트). 음성은 무거운 백엔드(whisper/ffmpeg/TTS)를 **코어 의존성에 넣지 않고**, 런타임에 감지해 있으면 켜고 없으면 안내한다. 설치는 사용자가 매뉴얼(`docs/VOICE-SETUP.md`)로.

## 핵심 설계: 액션 레지스트리 (dual interface SSOT)

명령어와 자연어가 **같은 핸들러 하나로 수렴**한다.

```
액션 정의 1곳 (SSOT):
  ACTIONS = {
    voice: { cmd: '/voice', help: '음성 답변 on/off', run: (arg) => setVoice(arg) },
    ...
  }

두 경로 → 같은 run():
  ① 명령어  "/voice on"        → handler 가 ACTIONS[name].run() 직접
  ② 자연어  "음성으로 답해줘"   → claude 응답에 [[do:voice on]] 디렉티브 →
                                  handler 가 파싱·실행·디렉티브 제거 → 같은 run()
```

- 자연어 경로: claude가 "의도 해석기" 역할. 봇 CLAUDE.md(템플릿)에 `[[do:...]]` 규약을 명시해 claude가 사용자 의도를 디렉티브로 변환하게 한다. (saebyeok의 `<!--triage-->` 패턴 재사용)
- 키워드 매칭보다 견고하고, 명령어/자연어가 한 코드로 모여 SSOT·DRY 유지.

## 아키텍처 (코어 handler 불변, 확장만)

```
IncomingMessage 확장 (channels/channel.ts):
  { text, userId, isOwner,
    voice?:   { path: string },
    images?:  { path: string }[],
    files?:   { path: string, kind: 'text'|'image'|'unsupported', content?: string }[],
    replyTo?: { text: string, from: string } }

채널 어댑터(telegram/slack): 메시지 타입(voice/photo/document/reply_to) → 위 필드로 "정규화"만.
media.ts(신규):   첨부 다운로드 + 분류(이미지/텍스트/거부) 공통 로직 (DRY)
voice.ts(신규):   STT/TTS 백엔드 추상 인터페이스 + 감지(미설치=비활성)
actions.ts(신규): 액션 레지스트리 + 명령어/디렉티브 dual 라우팅
handler.ts:       기존 흐름 + replyTo/첨부 → 프롬프트 조립, 디렉티브 파싱
```

## 기능별 설계

### ① 답장/인용 (의존 0)
- 채널 어댑터가 `reply_to_message` → `replyTo: {text, from}`
- handler가 프롬프트 앞에 `[답장 대상 (from: X)] ...\n[사용자 메시지] ...` 주입

### ② 이미지 입력 (의존 0 — Claude Read)
- 사진 첨부 → `media.ts`가 다운로드 → `images: [{path}]`
- handler가 프롬프트에 `[이미지: <path> — Read 도구로 보세요]` → claude가 Read

### ③ 파일 입력 (의존 0)
- 텍스트(≤50KB): 인라인 `<file name=...>content</file>`
- 이미지 확장자: ②로
- 그 외(zip/exe/pdf): "지원 형식: ..." 거부 응답

### ④ 음성 STT (옵셔널)
- `voice.ts`에 `transcribe(path): Promise<string>` 인터페이스
- 백엔드 감지: whisper-cli + ffmpeg 있으면 로컬, 없으면 `voiceAvailable=false`
- 음성 첨부 + 백엔드 있음 → 텍스트 변환 → 기존 흐름
- 백엔드 없음 → "음성 기능을 쓰려면 docs/VOICE-SETUP.md 참고" 1회 안내

### ⑤ 음성 TTS (옵셔널)
- `voice.ts`에 `synthesize(text): Promise<path>` 인터페이스
- `/voice on` 또는 `[[do:voice on]]` 으로 토글 (DATA_DIR에 설정 영속)
- 켜짐 + 백엔드 있음 → 응답을 음성으로도 회신

## 단순성·SSOT·DRY·얕은 계층 (6렌즈 자가 점검)
- SSOT: 액션 정의 1곳, 음성 백엔드 인터페이스 1개, 첨부 다운로드 1곳
- DRY: media 다운로드/분류 공통, STT/TTS 추상
- 얕은 계층: 채널 어댑터=정규화만 / 기능=모듈 / 코어 handler 불변
- 단순성: 음성 백엔드는 코어 의존성에서 제외(옵셔널), 미설치 graceful

## 구현 순서 (증분, 각 단계 e2e 검증)
1. **답장 + 이미지/파일 입력** (의존 0 — 가장 안전, 코어)
2. **액션 레지스트리** (dual interface 뼈대 + `[[do:]]` 규약)
3. **음성 STT** (백엔드 추상 + 로컬 감지 + 매뉴얼)
4. **음성 TTS** (토글 + 백엔드)

각 단계: telegram/slack 어댑터 정규화 → handler 반영 → 테스트 추가 → 검증.
