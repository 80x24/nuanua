// 슬랙 어댑터 (@slack/bolt, Socket Mode)
// 의존성은 선택적 — 슬랙을 쓸 때만 `bun add @slack/bolt`
import type { Channel, IncomingMessage, ReplyHandle } from './channel'
import { resolveOwner } from './owner'

export async function createSlackChannel(): Promise<Channel> {
  const botToken = process.env.SLACK_BOT_TOKEN
  const appToken = process.env.SLACK_APP_TOKEN
  if (!botToken || !appToken) throw new Error('SLACK_BOT_TOKEN / SLACK_APP_TOKEN 가 필요합니다')
  if (!process.env.SLACK_OWNER_ID) {
    console.warn('[slack] ⚠️ SLACK_OWNER_ID 미설정 — 소유자가 정해질 때까지 메시지를 처리하지 않습니다(fail-closed).')
  }

  let App: any
  try {
    ({ App } = await import('@slack/bolt'))
  } catch {
    throw new Error('슬랙 SDK가 설치돼 있지 않습니다. 설치하세요: cd bot && bun add @slack/bolt')
  }
  const app = new App({ token: botToken, appToken, socketMode: true })

  const notify = async (text: string) => {
    const ownerId = process.env.SLACK_OWNER_ID || ''
    if (!ownerId) return
    try { await app.client.chat.postMessage({ channel: ownerId, text }) } catch {}
  }

  return {
    name: 'slack',
    notify,
    async start(handler) {
      app.message(async ({ message, say, client }: any) => {
        if (message.subtype) return // 봇 메시지·편집 등 무시 (echo 루프 방지)
        const { allowed, ownerSet } = resolveOwner(process.env.SLACK_OWNER_ID, message.user)
        if (!ownerSet) {
          await say(`🔒 아직 소유자가 설정되지 않았어요. 당신의 user id: ${message.user}\nSLACK_OWNER_ID 에 넣고 /restart 해주세요.`)
          return
        }
        if (!allowed) return

        let ts: string | null = null
        const ensure = async (text: string) => {
          const t = text.slice(-3900) || '...' // telegram 과 통일 — 스트리밍 중 최신(뒤쪽) 표시
          if (!ts) { const r: any = await say(t); ts = r.ts }
          else { try { await client.chat.update({ channel: message.channel, ts, text: t }) } catch {} }
        }
        const reply: ReplyHandle = { update: ensure, final: ensure }
        const msg: IncomingMessage = { text: message.text || '', userId: message.user, isOwner: true }
        await handler(msg, reply)
      })
      await app.start()
      console.log('[slack] Socket Mode 시작')
    },
  }
}

// 힌트봇 모드 (MODE=hint) — 멘션/지정채널 메시지를 감지해 답장 필요 판별 후,
// 관점 다른 초안 N개를 **본인 DM 으로만** 보낸다. 공개 채널엔 절대 게시하지 않는다.
export async function startSlackHintBot(): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN
  const appToken = process.env.SLACK_APP_TOKEN
  const ownerId = process.env.SLACK_OWNER_ID
  if (!botToken || !appToken) throw new Error('SLACK_BOT_TOKEN / SLACK_APP_TOKEN 가 필요합니다')
  if (!ownerId) { console.warn('[hint] ⚠️ SLACK_OWNER_ID 미설정 — fail-closed, 무동작'); return }

  let App: any
  try { ({ App } = await import('@slack/bolt')) }
  catch { throw new Error('슬랙 SDK 미설치: cd bot && bun add @slack/bolt') }

  const { chatOnce } = await import('../claude')
  const { runHint, loadHintConfig } = await import('../hint')
  const cfg = loadHintConfig()
  const app = new App({ token: botToken, appToken, socketMode: true })

  // 자기 봇 user id (자기 메시지/멘션 루프 방지)
  let botUserId = ''
  try { botUserId = (await app.client.auth.test()).user_id } catch {}

  // 초안은 오직 owner DM 으로만 — 공개 게시 경로 없음
  const dmOwner = async (text: string) => {
    try { await app.client.chat.postMessage({ channel: ownerId, text }) }
    catch (e) { console.error('[hint] DM 실패', e) }
  }

  if (cfg.mention) {
    app.event('app_mention', async ({ event }: any) => {
      if (event.user === botUserId) return
      const ctx = `[슬랙 멘션 / 채널 ${event.channel}]\n${event.text || ''}`
      console.log(`[hint] mention → ${await runHint(chatOnce, ctx, cfg, dmOwner)}`)
    })
  }

  app.message(async ({ message }: any) => {
    if (message.subtype || message.bot_id) return                              // 봇·편집·시스템 무시
    if (message.user === botUserId) return                                     // 자기 무시
    if (!cfg.channels.includes(message.channel)) return                        // 지정 채널만
    if (botUserId && (message.text || '').includes(`<@${botUserId}>`)) return  // 멘션은 app_mention 이 처리
    const ctx = `[슬랙 채널 ${message.channel} 새 메시지]\n${message.text || ''}`
    console.log(`[hint] channel → ${await runHint(chatOnce, ctx, cfg, dmOwner)}`)
  })

  await app.start()
  console.log(`[hint] 슬랙 힌트봇 시작 (감시채널 ${cfg.channels.length}개 · 멘션 ${cfg.mention ? 'on' : 'off'} · 판별 ${cfg.triageModel})`)
}
