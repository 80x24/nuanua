#!/bin/bash
# setup.sh — 대화형 채널 세팅 위자드 (CLI). 평문 .env 편집 대신 1,2,3 선택.
#   언어를 먼저 고르고(기본: 영어), 그 언어로 안내한다. 기존 .env 의 다른 키는 보존.
#   대화형 세팅("설정 시작")은 그대로 두고, 이건 빠른 CLI 대안.
set -e
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/bot/.env"

# --- 0) 언어 선택 (기본 영어) ---
echo "Language / 언어:"
echo "  1) English (default)"
echo "  2) 한국어"
printf "> "
read -r lang_in || true
case "$lang_in" in
  2|ko|korean|한국어) L=ko ;;
  *) L=en ;;
esac

# 번역 (bash 3.2 호환 — 연관배열 없이 case). 키 추가 시 두 언어 다 채울 것.
t() {
  case "$L:$1" in
    en:where)      echo "Where do you want to talk to this bot?" ;;
    ko:where)      echo "이 봇을 어디서 쓸까요?" ;;
    en:o1)         echo "  1) Telegram (easy, phone)" ;;
    ko:o1)         echo "  1) 텔레그램 (쉬움, 폰)" ;;
    en:o2)         echo "  2) Slack (team)" ;;
    ko:o2)         echo "  2) 슬랙 (팀)" ;;
    en:o3)         echo "  3) Later — set it up by chatting (in Claude Code, say \"start setup\")" ;;
    ko:o3)         echo "  3) 나중에 — 대화로 설정 (Claude Code 에 \"설정 시작\")" ;;
    en:tg_help)    echo "[Telegram] In @BotFather send /newbot, then copy the bot token. Get your chat id from @userinfobot." ;;
    ko:tg_help)    echo "[텔레그램] @BotFather 에서 /newbot → 봇 토큰 복사. 본인 chat id 는 @userinfobot 에 메시지 보내면 알려줘요." ;;
    en:ask_tgtok)  echo "Paste your bot token (hidden): " ;;
    ko:ask_tgtok)  echo "봇 토큰 붙여넣기 (가려짐): " ;;
    en:ask_tgchat) echo "Your chat id (numbers): " ;;
    ko:ask_tgchat) echo "본인 chat id (숫자): " ;;
    en:sl_help)    echo "[Slack] At api.slack.com/apps create an app, enable Socket Mode (xapp-), add message.im event + chat:write, install (xoxb-), copy your member id." ;;
    ko:sl_help)    echo "[슬랙] api.slack.com/apps 에서 앱 생성 → Socket Mode 켜기(xapp-) → message.im 이벤트 + chat:write 추가 → 설치(xoxb-) → 본인 member id 복사." ;;
    en:ask_xoxb)   echo "Bot token xoxb- (hidden): " ;;
    ko:ask_xoxb)   echo "봇 토큰 xoxb- (가려짐): " ;;
    en:ask_xapp)   echo "App token xapp- (hidden): " ;;
    ko:ask_xapp)   echo "앱 토큰 xapp- (가려짐): " ;;
    en:ask_owner)  echo "Your Slack member id (U...): " ;;
    ko:ask_owner)  echo "본인 Slack member id (U...): " ;;
    en:saved)      echo "✓ Saved to bot/.env (other settings preserved)." ;;
    ko:saved)      echo "✓ bot/.env 에 저장했어요 (다른 설정은 보존)." ;;
    en:later)      echo "OK. Open Claude Code and say \"start setup\" — the agent will walk you through it by chat." ;;
    ko:later)      echo "좋아요. Claude Code 에서 \"설정 시작\" 이라고 하면 에이전트가 대화로 안내해요." ;;
    en:start_q)    echo "Start the bot now (register always-on daemon)? [Y/n] " ;;
    ko:start_q)    echo "지금 봇을 켤까요? (상시 데몬 등록) [Y/n] " ;;
    en:started)    echo "🌅 Done. The bot is running. Send it a message on your messenger!" ;;
    ko:started)    echo "🌅 끝! 봇이 켜졌어요. 메신저로 메시지 보내보세요!" ;;
    en:manual)     echo "Done. To start later: cd $REPO_DIR/bot && ./run.sh" ;;
    ko:manual)     echo "끝났어요. 나중에 켜려면: cd $REPO_DIR/bot && ./run.sh" ;;
    en:note_lang)  echo "(The bot replies in whatever language you message it — this choice only sets this wizard's language.)" ;;
    ko:note_lang)  echo "(봇은 당신이 보낸 언어로 답해요 — 이 선택은 이 위자드의 언어만 바꿉니다.)" ;;
    en:invalid)    echo "Invalid choice." ;;
    ko:invalid)    echo "잘못된 선택이에요." ;;
    en:sl_intro)   echo "[Slack] I'll guide you step by step. Open https://api.slack.com/apps in your browser." ;;
    ko:sl_intro)   echo "[슬랙] 한 단계씩 안내할게요. 브라우저에서 https://api.slack.com/apps 를 여세요." ;;
    en:sl1)        echo "1/6) Create New App -> From scratch -> name it + pick your workspace." ;;
    ko:sl1)        echo "1/6) Create New App -> From scratch -> 이름 + 워크스페이스 선택." ;;
    en:sl2)        echo "2/6) Socket Mode -> Enable -> create a token with connections:write -> copy the xapp- token." ;;
    ko:sl2)        echo "2/6) Socket Mode -> Enable -> connections:write 토큰 생성 -> xapp- 토큰 복사." ;;
    en:sl3)        echo "3/6) Event Subscriptions -> Enable -> Subscribe to bot events -> add message.im -> Save." ;;
    ko:sl3)        echo "3/6) Event Subscriptions -> Enable -> Subscribe to bot events -> message.im 추가 -> 저장." ;;
    en:sl4)        echo "4/6) OAuth & Permissions -> Bot Token Scopes -> make sure chat:write is there (add if missing)." ;;
    ko:sl4)        echo "4/6) OAuth & Permissions -> Bot Token Scopes -> chat:write 있는지 확인(없으면 추가)." ;;
    en:sl5)        echo "5/6) Install to Workspace -> Allow -> copy the xoxb- Bot Token." ;;
    ko:sl5)        echo "5/6) Install to Workspace -> Allow -> xoxb- 봇 토큰 복사." ;;
    en:sl6)        echo "6/6) Your Slack profile -> ... (More) -> Copy member ID (U...)." ;;
    ko:sl6)        echo "6/6) 본인 Slack 프로필 -> ... (More) -> Copy member ID (U...)." ;;
    en:enter_done) echo "   [Press Enter when done] " ;;
    ko:enter_done) echo "   [끝나면 Enter] " ;;
    en:keep_tg)    echo "Keep Telegram too — run both? [Y/n] " ;;
    ko:keep_tg)    echo "텔레그램도 같이 쓸까요(둘 다)? [Y/n] " ;;
    en:bolt)       echo "Installing Slack SDK (@slack/bolt)..." ;;
    ko:bolt)       echo "슬랙 SDK(@slack/bolt) 설치 중..." ;;
    *) echo "$1" ;;
  esac
}

# 기존 키는 보존하며 KEY 만 갱신 (sed 이스케이프 회피: 해당 줄 제거 후 추가)
set_env() {
  touch "$ENV_FILE"
  grep -vE "^$1=" "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || true
  printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

echo
t note_lang
echo
t where
t o1; t o2; t o3
printf "> "
read -r ch || true

case "$ch" in
  1)
    echo; t tg_help
    printf "%s" "$(t ask_tgtok)"; read -r -s tok; echo
    printf "%s" "$(t ask_tgchat)"; read -r chat
    set_env MODE standalone
    set_env CHANNEL telegram
    set_env TELEGRAM_BOT_TOKEN "$tok"
    set_env TELEGRAM_CHAT_ID "$chat"
    echo; t saved
    ;;
  2)
    echo; t sl_intro; echo
    t sl1; printf "%s" "$(t enter_done)"; read -r _ || true
    t sl2; printf "%s" "$(t ask_xapp)";  read -r -s xapp; echo
    t sl3; printf "%s" "$(t enter_done)"; read -r _ || true
    t sl4; printf "%s" "$(t enter_done)"; read -r _ || true
    t sl5; printf "%s" "$(t ask_xoxb)";  read -r -s xoxb; echo
    t sl6; printf "%s" "$(t ask_owner)"; read -r owner
    # 슬랙 SDK 보장 (없을 때만)
    if [ ! -d "$REPO_DIR/bot/node_modules/@slack/bolt" ]; then
      echo; t bolt; ( cd "$REPO_DIR/bot" && bun add @slack/bolt >/dev/null 2>&1 ) || true
    fi
    set_env MODE standalone
    set_env SLACK_BOT_TOKEN "$xoxb"
    set_env SLACK_APP_TOKEN "$xapp"
    set_env SLACK_OWNER_ID "$owner"
    # 텔레그램이 이미 설정돼 있으면 둘 다 쓸지 선택
    tgtok="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed 's/#.*//' | tr -d '[:space:]')"
    if [ -n "$tgtok" ]; then
      echo; printf "%s" "$(t keep_tg)"; read -r kt || true
      case "$kt" in n|N|no|No) set_env CHANNEL slack ;; *) set_env CHANNEL telegram,slack ;; esac
    else
      set_env CHANNEL slack
    fi
    echo; t saved
    ;;
  3|"")
    echo; t later
    exit 0
    ;;
  *)
    t invalid; exit 1
    ;;
esac

# 채널 설정 완료 → 켤지 묻기 (상시 데몬 등록 = 시작 + 재부팅 자동)
echo
printf "%s" "$(t start_q)"
read -r yn || true
case "$yn" in
  n|N|no|No) echo; t manual ;;
  *) bash "$REPO_DIR/scripts/install-daemon.sh" >/dev/null 2>&1 || bash "$REPO_DIR/scripts/install-daemon.sh"; echo; t started ;;
esac
