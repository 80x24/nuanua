// 텔레그램 어댑터 (grammY)
import { Bot } from 'grammy'
import { autoRetry } from '@grammyjs/auto-retry'
import type { Channel, IncomingMessage, ReplyHandle } from './channel'

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const

export function createTelegramChannel(): Channel {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN 가 없습니다')
  const ownerId = Number(process.env.TELEGRAM_CHAT_ID || 0)

  const bot = new Bot(token)
  bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 60 }))

  const notify = async (text: string) => {
    if (!ownerId) return
    try { await bot.api.sendMessage(ownerId, text, NO_PREVIEW) } catch {}
  }

  return {
    name: 'telegram',
    notify,
    async start(handler) {
      bot.on('message:text', async (ctx) => {
        const isOwner = !ownerId || ctx.chat.id === ownerId
        let messageId: number | null = null
        const ensure = async (text: string) => {
          const t = text.slice(-3900) || '...'
          if (messageId == null) {
            const m = await ctx.reply(t, NO_PREVIEW)
            messageId = m.message_id
          } else {
            try { await ctx.api.editMessageText(ctx.chat.id, messageId, t, NO_PREVIEW) } catch {}
          }
        }
        const reply: ReplyHandle = { update: ensure, final: ensure }
        const msg: IncomingMessage = { text: ctx.message.text, userId: String(ctx.chat.id), isOwner }
        await handler(msg, reply)
      })
      console.log('[telegram] long polling 시작')
      void bot.start()
    },
  }
}
