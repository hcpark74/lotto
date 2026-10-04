// cron 실행 기록. 2026-10-03 에 cron 이 두 번 연속 죽었는데 밖에서 알 길이 없었다 —
// 결과가 낡은 것만 보였고 그게 "발표가 늦은 것"인지 "cron 이 죽은 것"인지 구분되지 않았다.
// 실행 자체를 남겨 두면 그 구분이 바로 된다.
import { isMissingColumnError } from './missing-column'

const CREATE = `CREATE TABLE IF NOT EXISTS cron_runs (
  id TEXT PRIMARY KEY,
  lottery TEXT NOT NULL,
  cron TEXT NOT NULL,
  ran_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  synced_count INTEGER,
  detail TEXT
)`

// 조회가 "복권별 최신 한 건" 이라 이 색인이면 충분하다
const INDEX = 'CREATE INDEX IF NOT EXISTS idx_cron_runs_recent ON cron_runs (lottery, ran_at DESC)'

// 기록이 무한정 쌓이면 D1 용량만 먹는다. 복권당 최근 50건만 남긴다.
export const KEEP_PER_LOTTERY = 50

async function withTable<T>(db: D1Database, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
    if (!/no such table/i.test(message) && !isMissingColumnError(error)) throw error
    await db.prepare(CREATE).run()
    await db.prepare(INDEX).run()
    return run()
  }
}

export type CronRunRow = {
  lottery: string
  cron: string
  ran_at: string
  ok: number
  synced_count: number | null
  detail: string | null
}

export async function recordCronRunQuery(db: D1Database, row: Omit<CronRunRow, 'id'> & { id: string }) {
  return withTable(db, async () => {
    await db
      .prepare('INSERT INTO cron_runs (id, lottery, cron, ran_at, ok, synced_count, detail) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(row.id, row.lottery, row.cron, row.ran_at, row.ok, row.synced_count, row.detail)
      .run()
  })
}

export async function getLatestCronRunsQuery(db: D1Database, lottery: string, limit: number) {
  return withTable(db, async () => {
    const { results } = await db
      .prepare('SELECT lottery, cron, ran_at, ok, synced_count, detail FROM cron_runs WHERE lottery = ? ORDER BY ran_at DESC LIMIT ?')
      .bind(lottery, limit)
      .all<CronRunRow>()
    return results
  })
}

// 오래된 기록을 버린다. cron 이 돌 때마다 한 번씩 호출된다.
export async function pruneCronRunsQuery(db: D1Database, lottery: string) {
  return withTable(db, async () => {
    await db
      .prepare(`DELETE FROM cron_runs WHERE lottery = ? AND ran_at NOT IN (
                  SELECT ran_at FROM cron_runs WHERE lottery = ? ORDER BY ran_at DESC LIMIT ?
                )`)
      .bind(lottery, lottery, KEEP_PER_LOTTERY)
      .run()
  })
}
