// 메시지 핸들러 — 채널/엔진과 분리된 순수 흐름 (의존성 주입으로 테스트 가능)
import { basename } from 'path'
import type { IncomingMessage, ReplyHandle } from './channels/channel'
import { withBootstrap } from './bootstrap'
import { handleSkillCommand } from './skills'

// 첨부·답장을 프롬프트로 조립 (이미지=claude Read 도구, 텍스트=인라인, 답장=문맥 주입)
function composeUserPrompt(msg: IncomingMessage): string {
  const parts: string[] = []
  if (msg.replyTo) parts.push(`[답장 대상 (from: ${msg.replyTo.from})]\n${msg.replyTo.text}\n`)
  for (const a of msg.attachments ?? []) {
    if (a.kind === 'image') parts.push(`[첨부 이미지: ${a.path} — Read 도구로 열어 보세요]`)
    else if (a.kind === 'text') parts.push(`<file name="${basename(a.path)}">\n${a.content ?? ''}\n</file>`)
    else parts.push(`[첨부: ${basename(a.path)} — 지원하지 않는 형식이에요 (jpg/png/txt/md/json 등만)]`)
  }
  parts.push(msg.text || '(첨부만 보냈어요)')
  return parts.join('\n')
}

export interface HandlerDeps {
  claudeHome: string
  /** 프롬프트를 claude 로 흘려보내는 함수 (테스트에서 mock) */
  chat: (prompt: string, onChunk: (display: string) => void) => Promise<{ response: string; display: string }>
  cancel: () => boolean
  clear: () => void
  isBusy: () => boolean
  /** 봇 프로세스 재시작 (run.sh 가 다시 띄움). 미주입이면 /restart 비활성 */
  restart?: () => void
  /** 세션 전환 (/resume <id>) */
  resume?: (id: string) => void
  /** 세션 상태 (/status) */
  status?: () => { id: string | null; active: boolean; busy: boolean }
}

export function createMessageHandler(deps: HandlerDeps) {
  return async (msg: IncomingMessage, reply: ReplyHandle): Promise<void> => {
    if (!msg.isOwner) return
    const text = msg.text.trim()

    if (text === '/cancel') { deps.cancel(); await reply.final('취소했어요.'); return }
    if (text === '/clear') { deps.clear(); await reply.final('세션을 초기화했어요.'); return }
    if (text === '/restart') {
      if (deps.restart) { await reply.final('🔄 재시작할게요. 잠시 후 다시 인사드릴게요.'); deps.restart() }
      else { await reply.final('재시작이 지원되지 않는 환경이에요.') }
      return
    }
    if (text === '/status') {
      const s = deps.status?.()
      await reply.final(`🪪 세션: \`${s?.id ? s.id.slice(0, 8) : '없음(새 대화)'}\`\n상태: ${s?.busy ? '처리 중' : '대기'}`)
      return
    }
    if (text.startsWith('/resume')) {
      const id = text.replace('/resume', '').trim()
      if (!id) { await reply.final('사용법: `/resume <세션id>`'); return }
      if (deps.resume) { deps.resume(id); await reply.final(`🔄 세션 \`${id.slice(0, 8)}\` 로 전환했어요. 이어서 말 걸어 주세요.`) }
      else { await reply.final('세션 전환이 지원되지 않는 환경이에요.') }
      return
    }
    if (text === '/compact') {
      if (deps.isBusy()) { await reply.final('처리 중이에요. 잠시 후 다시 시도해 주세요.'); return }
      await reply.update('🗜 대화를 압축하는 중…')
      try {
        await deps.chat('/compact', () => {})
        await reply.final('✅ 대화를 압축했어요. 맥락은 유지돼요.')
      } catch (e: any) {
        await reply.final(`⚠️ 압축 실패: ${(e?.message || String(e)).slice(0, 150)}`)
      }
      return
    }

    // /skill 명령 — 스킬 승인 게이트 (busy 와 무관하게 처리)
    const skillReply = handleSkillCommand(deps.claudeHome, text)
    if (skillReply !== null) { await reply.final(skillReply); return }

    if (deps.isBusy()) { await reply.final('아직 이전 응답을 처리 중이에요. 잠시만요.'); return }

    const prompt = withBootstrap(deps.claudeHome, composeUserPrompt(msg))
    let last = 0
    try {
      const { response } = await deps.chat(prompt, (display) => {
        const now = Date.now()
        if (now - last > 1500) { last = now; reply.update(display).catch(() => {}) }
      })
      await reply.final(response)
    } catch (err: any) {
      const m = err.message || String(err)
      const hint = /login|auth|credit|limit|access|인증/i.test(m)
        ? '\n\n💡 구독 로그인이 필요하거나 사용량 한도일 수 있어요. 터미널에서 `claude` 로그인 상태를 확인해보세요.'
        : ''
      await reply.final(`⚠️ 오류: ${m.slice(0, 300)}${hint}`)
    }
  }
}
