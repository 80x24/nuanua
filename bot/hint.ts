// 슬랙 힌트봇 — 멘션/지정채널 메시지를 감지해 "답장이 필요한가?"를 싼 모델로 판별하고,
// 필요하면 관점이 다른 답변 초안 N개를 만들어 **본인 DM 으로만** 보낸다. 공개 채널엔 절대 게시 안 함.
//
// 판별/초안 로직은 chat 함수 주입(DI)으로 테스트 가능. 실제로는 claude.chatOnce 를 주입한다.

export interface HintConfig {
  channels: string[]    // 감시할 채널 id (비면 멘션만)
  mention: boolean      // 멘션(app_mention) 반응 on/off
  drafts: number        // 초안 개수 (기본 3)
  triageModel: string   // 판별용 싼 모델 (haiku/sonnet)
  draftModel: string    // 초안용 좋은 모델 (opus)
}

export type ChatOnce = (prompt: string, model?: string) => Promise<string>

export function loadHintConfig(): HintConfig {
  return {
    channels: (process.env.HINT_CHANNELS || '').split(',').map((s) => s.trim()).filter(Boolean),
    mention: process.env.HINT_MENTION !== 'false',
    drafts: Math.max(1, Number(process.env.HINT_DRAFTS) || 3),
    triageModel: process.env.HINT_TRIAGE_MODEL || 'haiku',
    draftModel: process.env.CLAUDE_MODEL || 'opus',
  }
}

/** 1) 답장이 필요한 상황인지 싼 모델로 판별 (아니면 조용히 무시 → 비용·알림 절약) */
export async function shouldReply(chat: ChatOnce, context: string, cfg: HintConfig): Promise<boolean> {
  const p =
    `당신은 슬랙 메시지 분류기입니다. 아래 메시지가 "이 사람(봇 주인)이 직접 답장해야 할 상황"인지 판단하세요.\n` +
    `답장이 필요하면 YES, 단순 잡담·자동 공지·내가 답할 필요 없는 내용이면 NO.\n` +
    `반드시 YES 또는 NO 한 단어만 답하세요.\n\n--- 메시지 ---\n${context}`
  const r = await chat(p, cfg.triageModel)
  return /\byes\b/i.test(r)
}

/** 2) 관점이 다른 답장 초안 N개 생성 */
export async function makeDrafts(chat: ChatOnce, context: string, cfg: HintConfig): Promise<string[]> {
  const p =
    `아래 슬랙 메시지에 대해, 내가 보낼 답장 초안을 관점이 다르게 ${cfg.drafts}개 작성하세요.\n` +
    `예: 간결한 답 / 정중한 답 / 정보를 덧붙인 답.\n` +
    `각 초안을 한 줄짜리 "---" 로만 구분하고, 번호·제목·설명 없이 답장 본문만 쓰세요.\n\n` +
    `--- 메시지 ---\n${context}`
  const r = await chat(p, cfg.draftModel)
  return r.split(/\n?-{3,}\n?/).map((s) => s.trim()).filter(Boolean).slice(0, cfg.drafts)
}

/** 전체 흐름: 판별 → (필요시) 초안 → 본인 DM 전송 콜백 호출 */
export async function runHint(
  chat: ChatOnce,
  context: string,
  cfg: HintConfig,
  sendDM: (text: string) => Promise<void>,
): Promise<'skipped' | 'sent'> {
  if (!(await shouldReply(chat, context, cfg))) return 'skipped'
  const drafts = await makeDrafts(chat, context, cfg)
  if (!drafts.length) return 'skipped'
  const quoted = context.slice(0, 200).replace(/\n/g, ' ')
  const body = drafts.map((d, i) => `*초안 ${i + 1}*\n${d}`).join('\n\n────────\n\n')
  await sendDM(`💡 답장 초안 ${drafts.length}개\n\n> ${quoted}\n\n${body}`)
  return 'sent'
}
