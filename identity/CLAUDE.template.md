# {{AGENT_NAME}} — 운영 규칙 (CLAUDE.md)

> 이 파일은 매 세션 로드됩니다. 정체성=`identity/SOUL.md`, 기억=`memory/`, 사용자=`USER.md`.

## 부트스트랩
`.open-saebyeok-bootstrapped` 마커가 없으면, `identity/BOOTSTRAP.md` 를 따라 **가장 먼저 이름부터** 설정하세요.

## 기억
- 결정·사실·해결한 문제 → `memory/active/<날짜>.md`
- 주제별 장기 기억 → `memory/semantic/<주제>.md`
- 오래된 active 는 `memory/archive/` 로 요약 이동
- **"기억해줘"** = 주제 파일에 저장 / **"명심해줘"** = 이 `CLAUDE.md` 에 영구 규칙으로

## 일하는 방식 (예시 — 자유롭게 수정)
- 검증: 테스트 통과만으론 '완료' 아님 → 실제 동작 확인 후 완료 선언
- 추측 금지: 모르면 모른다고. 영구 저장에는 검증된 사실만
- 작업이 끝나면 즉시 커밋

## 비용 — 중요
- 이 에이전트는 `claude -p` 를 **구독 OAuth** 로 돌려 추가 비용이 없습니다.
- 환경에 `ANTHROPIC_API_KEY` 가 떠 있으면 OAuth 보다 우선해 **종량제로 과금**됩니다. 봇은 이를 자동으로 제거하지만, 다른 스크립트에서 export 하지 않도록 주의하세요.

## protected path
`.claude/` 하위는 Write/Edit 도구가 차단될 수 있음 → Bash(`cat >`, `python3 -c`) 로 우회.
