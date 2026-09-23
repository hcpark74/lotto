// schema.sql 과 같은 정의. 운영 DB 에 아직 테이블이 없으면 첫 저장 때 만든다.
const CREATE_BACKTEST_CACHE_TABLE = `CREATE TABLE IF NOT EXISTS backtest_cache (
  cache_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
)`

export async function getBacktestCacheQuery(db: D1Database, cacheKey: string) {
  const row = await db.prepare('SELECT payload FROM backtest_cache WHERE cache_key = ?').bind(cacheKey).first<{ payload: string }>()
  return row?.payload ?? null
}

// 같은 kind 의 이전 키는 지운다 (회차가 바뀌면 다시 쓰일 일이 없다)
export async function replaceBacktestCacheQuery(db: D1Database, kind: string, keyPrefix: string, cacheKey: string, payload: string) {
  const statements = [
    db.prepare('DELETE FROM backtest_cache WHERE kind = ? AND substr(cache_key, 1, length(?)) != ?').bind(kind, keyPrefix, keyPrefix),
    db.prepare('INSERT OR REPLACE INTO backtest_cache (cache_key, kind, payload, created_at) VALUES (?, ?, ?, ?)')
      .bind(cacheKey, kind, payload, new Date().toISOString()),
  ]

  try {
    await db.batch(statements)
  } catch {
    await db.prepare(CREATE_BACKTEST_CACHE_TABLE).run()
    await db.batch(statements)
  }
}
