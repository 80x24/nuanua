// media 분류 로직 테스트 (다운로드/IO 없이 순수 분류만)
import { test, expect, describe } from 'bun:test'
import { classifyExt } from '../media'

describe('classifyExt — 첨부 파일 분류', () => {
  test('이미지 확장자', () => {
    for (const n of ['a.jpg', 'b.JPEG', 'c.png', 'd.webp', 'e.gif']) expect(classifyExt(n)).toBe('image')
  })
  test('텍스트/코드 확장자', () => {
    for (const n of ['a.txt', 'b.md', 'c.json', 'd.ts', 'e.py', 'f.csv']) expect(classifyExt(n)).toBe('text')
  })
  test('미지원 확장자', () => {
    for (const n of ['a.zip', 'b.exe', 'c.pdf', 'd.mp4', 'e.bin']) expect(classifyExt(n)).toBe('unsupported')
  })
})
