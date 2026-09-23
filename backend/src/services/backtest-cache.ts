import { getBacktestCacheQuery, replaceBacktestCacheQuery } from '../queries/backtest-cache'

// 캐시 형식이나 결과에 영향을 주는 코드가 바뀌었는데 알고리즘 버전은 그대로일 때 올린다
const BACKTEST_CACHE_VERSION = 1

type DataVersion = { latest: number; count: number }

// 백테스트는 회차가 바뀔 때만 결과가 달라지므로 (알고리즘 버전, 최신 회차, 행 수, lookback) 단위로 저장한다.
// 캐시 조회·저장이 실패해도 계산 결과는 그대로 돌려준다.
export async function withBacktestCache<T>(
  db: D1Database,
  options: { kind: string; algorithm: string; dataVersion: DataVersion; lookback: number },
  compute: () => Promise<T>,
): Promise<T> {
  const { kind, algorithm, dataVersion, lookback } = options
  const keyPrefix = `${kind}:c${BACKTEST_CACHE_VERSION}:${algorithm}:${dataVersion.latest}:${dataVersion.count}:`
  const cacheKey = `${keyPrefix}${lookback}`

  try {
    const cached = await getBacktestCacheQuery(db, cacheKey)
    if (cached) return JSON.parse(cached) as T
  } catch (error) {
    console.warn(`backtest cache read failed (${cacheKey}):`, error)
  }

  const result = await compute()

  try {
    await replaceBacktestCacheQuery(db, kind, keyPrefix, cacheKey, JSON.stringify(result))
  } catch (error) {
    console.warn(`backtest cache write failed (${cacheKey}):`, error)
  }

  return result
}
