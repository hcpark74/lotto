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

// 쿨다운을 한 문장으로 잡는다. 읽고 나서 쓰면 그 사이에 들어온 동시 요청이 둘 다
// 통과해 동행복권으로 요청이 겹쳐 나간다. 토큰 없이 열린 경로라 그 틈을 남기지 않는다.
// 돌려주는 값: 이번 호출이 자리를 잡았으면 true, 이미 누가 잡고 있으면 false.
export async function claimSyncAttemptQuery(db: D1Database, lottery: string, at: string, notBefore: string) {
  return withTable(db, async () => {
    const result = await db
      .prepare(`INSERT INTO sync_attempts (lottery, last_attempt_at) VALUES (?1, ?2)
                ON CONFLICT(lottery) DO UPDATE SET last_attempt_at = ?2
                WHERE sync_attempts.last_attempt_at <= ?3`)
      .bind(lottery, at, notBefore)
      .run()
    return (result.meta?.changes ?? 0) > 0
  })
}
