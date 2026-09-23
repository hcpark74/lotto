// schema.sql 과 같은 정의. 운영 DB 에 아직 테이블이 없으면 첫 저장 때 만든다.
// (이전 backtest_cache 테이블에는 데이터 버전 열이 없어 새 이름으로 만든다. 이전 테이블은 쓰지 않는다.)
const CREATE_BACKTEST_CACHE_TABLE = `CREATE TABLE IF NOT EXISTS backtest_cache_v2 (
  cache_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  data_latest INTEGER NOT NULL,
  data_count INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
)`

// D1 오류 메시지 예: "D1_ERROR: no such table: backtest_cache_v2: SQLITE_ERROR"
function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
  return /no such table/i.test(message)
}

export type BacktestDataVersion = { latest: number; count: number }

export async function getBacktestCacheQuery(db: D1Database, cacheKey: string) {
  const row = await db.prepare('SELECT payload FROM backtest_cache_v2 WHERE cache_key = ?').bind(cacheKey).first<{ payload: string }>()
  return row?.payload ?? null
}

// 저장하면서 같은 kind 의 "더 오래된 데이터 버전" 행만 지운다.
// 버전이 다른 키를 모두 지우면, 느린 요청이 옛 데이터로 계산한 결과를 저장할 때 더 새 결과를 지울 수 있다.
export async function replaceBacktestCacheQuery(
  db: D1Database,
  kind: string,
  dataVersion: BacktestDataVersion,
  cacheKey: string,
  payload: string,
) {
  const statements = [
    db.prepare(
      'DELETE FROM backtest_cache_v2 WHERE kind = ? AND (data_latest < ? OR (data_latest = ? AND data_count < ?))'
    ).bind(kind, dataVersion.latest, dataVersion.latest, dataVersion.count),
    db.prepare(
      'INSERT OR REPLACE INTO backtest_cache_v2 (cache_key, kind, data_latest, data_count, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(cacheKey, kind, dataVersion.latest, dataVersion.count, payload, new Date().toISOString()),
  ]

  try {
    await db.batch(statements)
  } catch (error) {
    // 테이블이 없을 때만 만들고 다시 시도한다. 나머지 오류는 호출부(withBacktestCache)가 경고로 남긴다.
    if (!isMissingTableError(error)) throw error
    await db.prepare(CREATE_BACKTEST_CACHE_TABLE).run()
    await db.batch(statements)
  }
}
