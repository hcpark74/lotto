import { describe, expect, it } from 'vitest'
import { isMissingColumnError } from '../src/queries/missing-column'

// 아래 문구는 wrangler d1 execute 로 직접 받아낸 실측값이다 (2026-10-03).
// 문장 종류마다 다르다 — 한쪽만 보면 지연 ALTER TABLE 이 안 돈다.
describe('isMissingColumnError', () => {
  it('INSERT 의 문구를 잡는다', () => {
    // 이걸 놓쳐서 2026-10-03 토요일 cron 이 동기화 INSERT 에서 죽었다
    expect(isMissingColumnError(new Error('table lotto_history has no column named rnk1WnNope: SQLITE_ERROR'))).toBe(true)
  })

  it('SELECT 의 문구를 잡는다', () => {
    expect(isMissingColumnError(new Error('no such column: salesAmount at offset 7: SQLITE_ERROR'))).toBe(true)
  })

  it('UPDATE 의 문구를 잡는다', () => {
    expect(isMissingColumnError(new Error('no such column: winning_band: SQLITE_ERROR'))).toBe(true)
  })

  it('cause 에 들어 있어도 잡는다', () => {
    const error = new Error('D1_ERROR') as Error & { cause?: unknown }
    error.cause = 'table saved_picks has no column named winning_band'
    expect(isMissingColumnError(error)).toBe(true)
  })

  it('Error 가 아닌 값도 본다', () => {
    expect(isMissingColumnError('table t has no column named x')).toBe(true)
  })

  // 다른 오류를 삼키면 진짜 문제를 ALTER TABLE 로 덮어 버린다
  it('관계없는 오류는 잡지 않는다', () => {
    expect(isMissingColumnError(new Error('no such table: lotto_history'))).toBe(false)
    expect(isMissingColumnError(new Error('UNIQUE constraint failed'))).toBe(false)
    expect(isMissingColumnError(new Error('D1_ERROR: network'))).toBe(false)
    expect(isMissingColumnError(null)).toBe(false)
  })
})
