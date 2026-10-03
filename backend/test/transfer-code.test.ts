import { describe, expect, it } from 'vitest'
import {
  CODE_LENGTH,
  createTransferCode,
  formatTransferCode,
  hashTransferCode,
  normalizeTransferCode,
} from '../src/algorithms/transfer-code'

describe('createTransferCode', () => {
  it(`${CODE_LENGTH}자리이고 헷갈리는 글자(0/1/I/O)를 쓰지 않는다`, () => {
    for (let i = 0; i < 200; i++) {
      const bytes = new Uint8Array(CODE_LENGTH)
      crypto.getRandomValues(bytes)
      const code = createTransferCode(bytes)
      expect(code).toHaveLength(CODE_LENGTH)
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]+$/)
    }
  })

  it('같은 바이트면 같은 코드 (결정적)', () => {
    const bytes = new Uint8Array(CODE_LENGTH).fill(7)
    expect(createTransferCode(bytes)).toBe(createTransferCode(bytes))
  })
})

describe('normalizeTransferCode', () => {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  const code = createTransferCode(bytes)

  it('하이픈·공백·소문자를 허용한다', () => {
    expect(normalizeTransferCode(formatTransferCode(code))).toBe(code)
    expect(normalizeTransferCode(code.toLowerCase())).toBe(code)
    expect(normalizeTransferCode(` ${code.slice(0, 5)} ${code.slice(5)} `)).toBe(code)
  })

  it('길이가 다르거나 알파벳 밖이면 거부', () => {
    expect(normalizeTransferCode(code.slice(0, 9))).toBeNull()
    expect(normalizeTransferCode(code + 'A')).toBeNull()
    // 0·1·I·O 는 알파벳에 없다
    expect(normalizeTransferCode('0'.repeat(CODE_LENGTH))).toBeNull()
    expect(normalizeTransferCode('I'.repeat(CODE_LENGTH))).toBeNull()
  })
})

describe('hashTransferCode', () => {
  it('원문을 저장하지 않도록 64자 hex 해시를 돌려준다', async () => {
    const hash = await hashTransferCode('ABCDE23456')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('같은 코드는 같은 해시 (조회에 쓸 수 있어야 한다)', async () => {
    expect(await hashTransferCode('ABCDE23456')).toBe(await hashTransferCode('ABCDE23456'))
  })

  it('다른 코드는 다른 해시', async () => {
    expect(await hashTransferCode('ABCDE23456')).not.toBe(await hashTransferCode('ABCDE23457'))
  })
})

describe('formatTransferCode', () => {
  it('5-5 로 끊어 보여준다', () => {
    expect(formatTransferCode('ABCDE23456')).toBe('ABCDE-23456')
  })
})
