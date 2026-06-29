// 첨부(이미지·파일) 공통 처리 — 다운로드·분류·텍스트 읽기 (채널 무관, DRY).
// 이미지는 Claude 의 Read 도구가 직접 인식하므로 저장만 하면 되고,
// 텍스트는 프롬프트에 인라인하며, 그 외(zip/exe/pdf 등)는 거부한다.

import { join, extname, basename } from 'path'
import { mkdirSync, writeFileSync, readFileSync } from 'fs'
import { DATA_DIR } from './config'

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic'])
const TEXT_EXT = new Set([
  '.txt', '.md', '.json', '.csv', '.tsv', '.log', '.yaml', '.yml',
  '.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp',
  '.html', '.css', '.xml', '.sh', '.toml', '.ini', '.env',
])

export type FileKind = 'image' | 'text' | 'unsupported'

export function classifyExt(name: string): FileKind {
  const e = extname(name).toLowerCase()
  if (IMAGE_EXT.has(e)) return 'image'
  if (TEXT_EXT.has(e)) return 'text'
  return 'unsupported'
}

const ATTACH_DIR = join(DATA_DIR, 'attachments')
const MAX_TEXT_BYTES = 50 * 1024

/** URL 에서 첨부를 받아 DATA_DIR/attachments 에 저장하고 절대경로를 돌려준다 */
export async function saveAttachment(url: string, name: string): Promise<string> {
  mkdirSync(ATTACH_DIR, { recursive: true })
  const safe = basename(name).replace(/[^\w.\-가-힣]/g, '_')
  const path = join(ATTACH_DIR, `${Date.now()}-${safe}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`첨부 다운로드 실패: ${res.status}`)
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  return path
}

/** 텍스트 파일 안전 읽기 (50KB 초과 시 자름) */
export function readTextSafe(path: string): string {
  try {
    const s = readFileSync(path, 'utf-8')
    return s.length > MAX_TEXT_BYTES ? s.slice(0, MAX_TEXT_BYTES) + '\n…(이하 생략)' : s
  } catch {
    return ''
  }
}
