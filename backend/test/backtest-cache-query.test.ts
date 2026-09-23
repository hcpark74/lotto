import { describe, expect, it, vi } from 'vitest'
import { replaceBacktestCacheQuery } from '../src/queries/backtest-cache'

// prepare().bind() 와 batch/run 만 흉내 내는 가짜 D1
function fakeDb(batchErrors: unknown[]) {
  const statement = { bind: () => statement, run: vi.fn(async () => ({})) }
  const db = {
    prepare: vi.fn((sql: string) => ({ ...statement, sql })),
    batch: vi.fn(async () => {
      const error = batchErrors.shift()
      if (error) throw error
      return []
    }),
  }
  return db
}

const version = { latest: 1, count: 1 }
const createCalls = (db: ReturnType<typeof fakeDb>) =>
  db.prepare.mock.calls.filter(([sql]) => sql.startsWith('CREATE TABLE')).length

describe('replaceBacktestCacheQuery', () => {
  it('테이블이 없으면 만들고 다시 시도한다', async () => {
    const db = fakeDb([new Error('D1_ERROR: no such table: backtest_cache_v2: SQLITE_ERROR')])
    await replaceBacktestCacheQuery(db as unknown as D1Database, 'lotto', version, 'k', '{}')
    expect(createCalls(db)).toBe(1)
    expect(db.batch).toHaveBeenCalledTimes(2)
  })

  it('다른 오류는 테이블을 만들지 않고 그대로 던진다', async () => {
    const db = fakeDb([new Error('D1_ERROR: database is locked')])
    await expect(replaceBacktestCacheQuery(db as unknown as D1Database, 'lotto', version, 'k', '{}')).rejects.toThrow('database is locked')
    expect(createCalls(db)).toBe(0)
    expect(db.batch).toHaveBeenCalledTimes(1)
  })
})
