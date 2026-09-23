import { type BacktestDataVersion, getBacktestCacheQuery, replaceBacktestCacheQuery } from '../queries/backtest-cache'

// 캐시 형식이나 결과에 영향을 주는 코드가 바뀌었는데 알고리즘 버전은 그대로일 때 올린다
const BACKTEST_CACHE_VERSION = 4

export type { BacktestDataVersion }

// 계산에 실제로 쓴 행으로 데이터 버전(최신 회차, 행 수)을 만든다
export function dataVersionOf<T>(rows: T[], drawNoOf: (row: T) => number | undefined): BacktestDataVersion {
  return { latest: rows.reduce((max, row) => Math.max(max, drawNoOf(row) ?? 0), 0), count: rows.length }
}

function cacheKeyOf(kind: string, algorithm: string, dataVersion: BacktestDataVersion, lookback: number) {
  return `${kind}:c${BACKTEST_CACHE_VERSION}:${algorithm}:${dataVersion.latest}:${dataVersion.count}:${lookback}`
}

// 백테스트는 회차가 바뀔 때만 결과가 달라지므로 (알고리즘 버전, 최신 회차, 행 수, lookback) 단위로 저장한다.
// - 조회는 가벼운 버전 쿼리(readDataVersion)로 만든 키로 한다.
// - 저장은 compute 가 실제로 읽은 행의 버전으로 만든 키로 한다. 두 쿼리 사이에 sync 가 끼어도
//   결과가 다른 데이터의 키로 저장되지 않는다.
// 캐시 조회·저장이 실패해도 계산 결과는 그대로 돌려준다.
export async function withBacktestCache<T>(
  db: D1Database,
  options: { kind: string; algorithm: string; lookback: number },
  readDataVersion: () => Promise<BacktestDataVersion>,
  compute: () => Promise<{ result: T; dataVersion: BacktestDataVersion }>,
): Promise<T> {
  const { kind, algorithm, lookback } = options
  const lookupKey = cacheKeyOf(kind, algorithm, await readDataVersion(), lookback)

  try {
    const cached = await getBacktestCacheQuery(db, lookupKey)
    if (cached) return JSON.parse(cached) as T
  } catch (error) {
    console.warn(`backtest cache read failed (${lookupKey}):`, error)
  }

  const { result, dataVersion } = await compute()
  const storeKey = cacheKeyOf(kind, algorithm, dataVersion, lookback)

  try {
    await replaceBacktestCacheQuery(db, kind, dataVersion, storeKey, JSON.stringify(result))
  } catch (error) {
    console.warn(`backtest cache write failed (${storeKey}):`, error)
  }

  return result
}
