// open-saebyeok 진입점
// 1) CHANNEL 환경변수로 메신저 어댑터를 고른다 (telegram | slack)
// 2) 아직 이름이 없으면(부트스트랩 미완료) 최우선으로 이름부터 묻는다
// 3) 메시지를 claude -p 로 흘려보내고 스트리밍 응답을 돌려준다

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { chatStreamWithRetry, cancelStream, clearSession, isBusy } from './claude'
import type { Channel } from './channels/channel'

const CLAUDE_HOME = process.env.CLAUDE_HOME || join(homedir(), '.claude')
const IDENTITY_DIR = join(CLAUDE_HOME, 'identity')
const MARKER = join(CLAUDE_HOME, '.open-saebyeok-bootstrapped')

async function loadChannel(): Promise<Channel> {
  const name = (process.env.CHANNEL || 'telegram').toLowerCase()
  if (name === 'telegram') return (await import('./channels/telegram')).createTelegramChannel()
  if (name === 'slack') return (await import('./channels/slack')).createSlackChannel()
  throw new Error(`알 수 없는 CHANNEL: ${name} (telegram | slack)`)
}

/** 부트스트랩 미완료 시, 첫 프롬프트 앞에 "이름부터 물어라" 지시를 붙인다 */
function withBootstrap(userText: string): string {
  try {
    const guide = readFileSync(join(IDENTITY_DIR, 'BOOTSTRAP.md'), 'utf-8')
    return `${guide}\n\n---\n사용자의 첫 메시지: "${userText}"`
  } catch {
    return userText
  }
}

const main = async () => {
  const channel = await loadChannel()
  console.log(`[open-saebyeok] channel=${channel.name} CLAUDE_HOME=${CLAUDE_HOME}`)

  if (!existsSync(MARKER)) {
    await channel.notify(
      '🌱 open-saebyeok 설치 완료!\n\n' +
      '저는 아직 이름이 없어요. 먼저 저를 뭐라고 부를지 정해주세요.\n' +
      '메시지로 이름을 보내주시면 정체성을 설정할게요. (다른 걸 먼저 물어봐도 괜찮아요.)'
    )
  }

  await channel.start(async (msg, reply) => {
    if (!msg.isOwner) return
    const text = msg.text.trim()

    if (text === '/cancel') { cancelStream(); await reply.final('취소했어요.'); return }
    if (text === '/clear') { clearSession(); await reply.final('세션을 초기화했어요.'); return }
    if (isBusy()) { await reply.final('아직 이전 응답을 처리 중이에요. 잠시만요.'); return }

    // 매 메시지마다 마커를 재확인 — 부트스트랩 도중 사용자가 다른 질문을 해도 따라간다
    const prompt = existsSync(MARKER) ? text : withBootstrap(text)

    let last = 0
    try {
      const { response } = await chatStreamWithRetry(prompt, (display) => {
        const now = Date.now()
        if (now - last > 1500) { last = now; reply.update(display).catch(() => {}) }
      })
      await reply.final(response)
    } catch (err: any) {
      await reply.final(`⚠️ 오류: ${(err.message || String(err)).slice(0, 300)}`)
    }
  })
}

main().catch((e) => { console.error(e); process.exit(1) })
