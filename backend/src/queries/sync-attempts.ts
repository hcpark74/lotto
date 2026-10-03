// 공개 새로고침의 쿨다운 기록. 토큰 없이 열어 두므로 호출 간격을 서버가 강제해야 한다.
const CREATE = `CREATE TABLE IF NOT EXISTS sync_attempts (
  lottery TEXT PRIMARY KEY,
  last_attempt_at TEXT NOT NULL
)`

async function withTable<T>(db: D1Database, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
    if (!/no such table/i.test(message)) throw error
    await db.prepare(CREATE).run()
    return run()
  }
}

export async function getLastSyncAttemptQuery(db: D1Database, lottery: string) {
  return withTable(db, async () => {
    const row = await db
      .prepare('SELECT last_attempt_at FROM sync_attempts WHERE lottery = ?')
      .bind(lottery)
      .first<{ last_attempt_at: string }>()
    return row?.last_attempt_at ?? null
  })
}

export async function markSyncAttemptQuery(db: D1Database, lottery: string, at: string) {
  return withTable(db, async () => {
    await db
      .prepare(`INSERT INTO sync_attempts (lottery, last_attempt_at) VALUES (?, ?)
                ON CONFLICT(lottery) DO UPDATE SET last_attempt_at = excluded.last_attempt_at`)
      .bind(lottery, at)
      .run()
  })
}
