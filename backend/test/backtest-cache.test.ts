import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/queries/backtest-cache', () => ({
  getBacktestCacheQuery: vi.fn(),
  replaceBacktestCacheQuery: vi.fn(),
}))

const { withBacktestCache } = await import('../src/services/backtest-cache')
const { getBacktestCacheQuery, replaceBacktestCacheQuery } = await import('../src/queries/backtest-cache')

const getCache = vi.mocked(getBacktestCacheQuery)
const replaceCache = vi.mocked(replaceBacktestCacheQuery)
const db = {} as D1Database
const options = { kind: 'lotto', algorithm: 'v3.2', dataVersion: { latest: 1215, count: 1215 }, lookback: 300 }

describe('withBacktestCache', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    getCache.mockReset().mockResolvedValue(null)
    replaceCache.mockReset().mockResolvedValue(undefined)
  })

  it('캐시가 있으면 계산하지 않고 그대로 돌려준다', async () => {
    getCache.mockResolvedValue(JSON.stringify({ cached: true }))
    const compute = vi.fn()

    await expect(withBacktestCache(db, options, compute)).resolves.toEqual({ cached: true })
    expect(compute).not.toHaveBeenCalled()
    expect(getCache).toHaveBeenCalledWith(db, 'lotto:c1:v3.2:1215:1215:300')
  })

  it('없으면 계산해서 저장한다. 같은 데이터 버전의 다른 lookback 은 지우지 않도록 prefix 를 넘긴다', async () => {
    await expect(withBacktestCache(db, options, async () => ({ value: 1 }))).resolves.toEqual({ value: 1 })
    expect(replaceCache).toHaveBeenCalledWith(db, 'lotto', 'lotto:c1:v3.2:1215:1215:', 'lotto:c1:v3.2:1215:1215:300', '{"value":1}')
  })

  it('회차가 바뀌면 키가 바뀐다', async () => {
    await withBacktestCache(db, { ...options, dataVersion: { latest: 1216, count: 1216 } }, async () => ({}))
    expect(getCache).toHaveBeenCalledWith(db, 'lotto:c1:v3.2:1216:1216:300')
  })

  it('캐시 조회·저장이 실패해도 계산 결과를 돌려준다', async () => {
    getCache.mockRejectedValue(new Error('no such table'))
    replaceCache.mockRejectedValue(new Error('write failed'))

    await expect(withBacktestCache(db, options, async () => ({ value: 2 }))).resolves.toEqual({ value: 2 })
  })

  it('계산이 실패하면 저장하지 않고 오류를 그대로 던진다 (데이터 부족 → 400 유지)', async () => {
    await expect(withBacktestCache(db, options, async () => { throw new Error('백테스트에 필요한 데이터가 부족합니다.') }))
      .rejects.toThrow('백테스트에 필요한 데이터가 부족합니다.')
    expect(replaceCache).not.toHaveBeenCalled()
  })
})
