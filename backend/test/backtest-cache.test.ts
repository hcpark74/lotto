import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/queries/backtest-cache', () => ({
  getBacktestCacheQuery: vi.fn(),
  replaceBacktestCacheQuery: vi.fn(),
}))

const { dataVersionOf, withBacktestCache } = await import('../src/services/backtest-cache')
const { getBacktestCacheQuery, replaceBacktestCacheQuery } = await import('../src/queries/backtest-cache')

const getCache = vi.mocked(getBacktestCacheQuery)
const replaceCache = vi.mocked(replaceBacktestCacheQuery)
const db = {} as D1Database
const options = { kind: 'lotto', algorithm: 'v3.2', lookback: 300 }
const v1215 = { latest: 1215, count: 1215 }
const readVersion = async () => v1215
const computeWith = <T>(result: T, dataVersion = v1215) => async () => ({ result, dataVersion })

describe('withBacktestCache', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    getCache.mockReset().mockResolvedValue(null)
    replaceCache.mockReset().mockResolvedValue(undefined)
  })

  it('캐시가 있으면 계산하지 않고 그대로 돌려준다', async () => {
    getCache.mockResolvedValue(JSON.stringify({ cached: true }))
    const compute = vi.fn()

    await expect(withBacktestCache(db, options, readVersion, compute)).resolves.toEqual({ cached: true })
    expect(compute).not.toHaveBeenCalled()
    expect(getCache).toHaveBeenCalledWith(db, 'lotto:c4:v3.2:1215:1215:300')
  })

  it('없으면 계산해서, 계산에 쓴 데이터 버전으로 저장한다', async () => {
    await expect(withBacktestCache(db, options, readVersion, computeWith({ value: 1 }))).resolves.toEqual({ value: 1 })
    expect(replaceCache).toHaveBeenCalledWith(db, 'lotto', v1215, 'lotto:c4:v3.2:1215:1215:300', '{"value":1}')
  })

  it('버전 조회와 계산 사이에 새 회차가 들어오면 새 데이터의 키로 저장한다', async () => {
    const v1216 = { latest: 1216, count: 1216 }
    await withBacktestCache(db, options, readVersion, computeWith({ value: 2 }, v1216))

    expect(getCache).toHaveBeenCalledWith(db, 'lotto:c4:v3.2:1215:1215:300')
    expect(replaceCache).toHaveBeenCalledWith(db, 'lotto', v1216, 'lotto:c4:v3.2:1216:1216:300', '{"value":2}')
  })

  it('캐시 조회·저장이 실패해도 계산 결과를 돌려준다', async () => {
    getCache.mockRejectedValue(new Error('no such table'))
    replaceCache.mockRejectedValue(new Error('write failed'))

    await expect(withBacktestCache(db, options, readVersion, computeWith({ value: 3 }))).resolves.toEqual({ value: 3 })
  })

  it('계산이 실패하면 저장하지 않고 오류를 그대로 던진다 (데이터 부족 → 400 유지)', async () => {
    const compute = async () => { throw new Error('백테스트에 필요한 데이터가 부족합니다.') }
    await expect(withBacktestCache(db, options, readVersion, compute)).rejects.toThrow('백테스트에 필요한 데이터가 부족합니다.')
    expect(replaceCache).not.toHaveBeenCalled()
  })
})

describe('dataVersionOf', () => {
  it('행의 최대 회차와 행 수', () => {
    expect(dataVersionOf([{ n: 3 }, { n: 7 }, { n: 5 }], (row) => row.n)).toEqual({ latest: 7, count: 3 })
    expect(dataVersionOf([], (row: { n: number }) => row.n)).toEqual({ latest: 0, count: 0 })
  })
})
