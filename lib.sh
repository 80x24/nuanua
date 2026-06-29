#!/bin/bash
# 공통 이름·데이터경로 파생 — 모든 셸 스크립트가 source 한다 (SSOT).
# 리네이밍: 이 파일의 기본 이름 한 곳 + bot/config.ts 한 곳만 바꾸면 된다 (셸/TS 경계).
APP_NAME="${APP_NAME:-nuanua}"
# 데이터 홈 우선순위 (bot/config.ts 와 동일): AGENT_HOME > CLAUDE_HOME(레거시) > ~/.${APP_NAME}
DATA_DIR="${AGENT_HOME:-${CLAUDE_HOME:-$HOME/.$APP_NAME}}"
