// 슬랙 어댑터 (@slack/bolt, Socket Mode)
// 의존성은 선택적 — 슬랙을 쓸 때만 `bun add @slack/bolt`
import type { Channel, IncomingMessage, ReplyHandle } from './channel'

export async function createSlackChannel(): Promise<Channel> {
  const botToken = process.env.SLACK_BOT_TOKEN
  const appToken = process.env.SLACK_APP_TOKEN
  const ownerId = process.env.SLACK_OWNER_ID || ''
  if (!botToken || !appToken) throw new Error('SLACK_BOT_TOKEN / SLACK_APP_TOKEN 가 필요합니다')

  // 동적 import: 슬랙을 안 쓰면 패키지가 없어도 봇이 뜬다
  const { App } = await import('@slack/bolt')
  const app = new App({ token: botToken, appToken, socketMode: true })

  const notify = async (text: string) => {
    if (!ownerId) return
    try { await app.client.chat.postMessage({ channel: ownerId, text }) } catch {}
  }

  return {
    name: 'slack',
    notify,
    async start(handler) {
      app.message(async ({ message, say, client }: any) => {
        if (message.subtype) return // 봇 메시지·편집 등 무시
        const isOwner = !ownerId || message.user === ownerId
        let ts: string | null = null
        const ensure = async (text: string) => {
          const t = (text || '...').slice(0, 3900)
          if (!ts) { const r: any = await say(t); ts = r.ts }
          else { try { await client.chat.update({ channel: message.channel, ts, text: t }) } catch {} }
        }
        const reply: ReplyHandle = { update: ensure, final: ensure }
        const msg: IncomingMessage = { text: message.text || '', userId: message.user, isOwner }
        await handler(msg, reply)
      })
      await app.start()
      console.log('[slack] Socket Mode 시작')
    },
  }
}
