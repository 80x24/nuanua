// 힌트봇 판별·초안·흐름 테스트 (claude 실호출 없이 chat 함수 mock 주입)
import { test, expect, describe } from 'bun:test'
import { shouldReply, makeDrafts, runHint, type HintConfig } from '../hint'

const cfg: HintConfig = { channels: [], mention: true, drafts: 3, triageModel: 'haiku', draftModel: 'opus' }

describe('힌트봇', () => {
  test('shouldReply: YES → true (싼 모델로 판별)', async () => {
    expect(await shouldReply(async () => 'YES', '이거 어떻게 하나요?', cfg)).toBe(true)
  })
  test('shouldReply: NO → false (잡담은 무시)', async () => {
    expect(await shouldReply(async () => 'NO', '점심 뭐먹지ㅎㅎ', cfg)).toBe(false)
  })
  test('판별은 triageModel(싼 모델)을 쓴다', async () => {
    let used = ''
    await shouldReply(async (_p, m) => { used = m || ''; return 'NO' }, 'x', cfg)
    expect(used).toBe('haiku')
  })
  test('makeDrafts: --- 로 분리하고 drafts 수로 제한', async () => {
    const r = await makeDrafts(async () => 'A\n---\nB\n---\nC\n---\nD', 'q', cfg)
    expect(r).toEqual(['A', 'B', 'C'])
  })
  test('runHint: 판별 NO 면 skipped + DM 안 감 (공개채널 안전)', async () => {
    let sent = false
    const r = await runHint(async () => 'NO', 'q', cfg, async () => { sent = true })
    expect(r).toBe('skipped'); expect(sent).toBe(false)
  })
  test('runHint: 판별 YES 면 초안을 DM 으로 전송', async () => {
    let dm = ''
    const chat = async (_p: string, m?: string) => (m === 'haiku' ? 'YES' : '간결한답\n---\n정중한답\n---\n정보덧붙인답')
    const r = await runHint(chat, '도와주세요', cfg, async (t) => { dm = t })
    expect(r).toBe('sent')
    expect(dm).toContain('초안'); expect(dm).toContain('간결한답'); expect(dm).toContain('정중한답')
  })
})
