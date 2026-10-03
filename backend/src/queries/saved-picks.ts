import type { SavedPickRow } from '../types/saved-picks'

// schema.sql 과 같은 정의. 운영 DB 에 아직 테이블이 없으면 첫 저장 때 만든다.
const CREATE_SAVED_PICKS_TABLE = `CREATE TABLE IF NOT EXISTS saved_picks (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  lottery TEXT NOT NULL,
  draw_no INTEGER NOT NULL,
  numbers TEXT NOT NULL,
  label TEXT,
  saved_at TEXT NOT NULL,
  matched_count INTEGER,
  bonus_matched INTEGER,
  rank_no INTEGER,
  checked_at TEXT
)`

const CREATE_CLIENT_INDEX = 'CREATE INDEX IF NOT EXISTS idx_saved_picks_client ON saved_picks (client_id, saved_at DESC)'
const CREATE_PENDING_INDEX = 'CREATE INDEX IF NOT EXISTS idx_saved_picks_pending ON saved_picks (lottery, draw_no, checked_at)'

// INSERT 전용. 저장 시점에는 채점 결과가 없으므로 winning_band 도 넣지 않는다.
const COLUMNS = 'id, client_id, lottery, draw_no, numbers, label, saved_at, matched_count, bonus_matched, rank_no, checked_at'

// 읽기는 * 를 쓴다. 운영 테이블에 winning_band 가 아직 없어도 에러 없이 undefined 로 온다
// (채점이 한 번 돌면 ALTER TABLE 로 생긴다).

// D1 오류 메시지 예: "D1_ERROR: no such table: saved_picks: SQLITE_ERROR"
function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
  return /no such table/i.test(message)
}

export async function createSavedPicksTable(db: D1Database) {
  await db.prepare(CREATE_SAVED_PICKS_TABLE).run()
  await db.prepare(CREATE_CLIENT_INDEX).run()
  await db.prepare(CREATE_PENDING_INDEX).run()
}

// 테이블이 없을 때만 만들고 한 번 더 시도한다 (백테스트 캐시와 같은 방식)
async function withTable<T>(db: D1Database, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (!isMissingTableError(error)) throw error
    await createSavedPicksTable(db)
    return run()
  }
}

export async function insertSavedPickQuery(db: D1Database, row: SavedPickRow) {
  return withTable(db, async () => {
    await db
      .prepare(`INSERT INTO saved_picks (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        row.id, row.client_id, row.lottery, row.draw_no, row.numbers, row.label, row.saved_at,
        row.matched_count, row.bonus_matched, row.rank_no, row.checked_at,
      )
      .run()
    return row
  })
}

// 한 번에 생성된 세트를 한 번에 넣는다. D1 batch 는 한 트랜잭션이라 중간에 끊기지 않는다.
export async function insertSavedPicksQuery(db: D1Database, rows: SavedPickRow[]) {
  if (rows.length === 0) return rows

  return withTable(db, async () => {
    const statement = db.prepare(`INSERT INTO saved_picks (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    await db.batch(rows.map((row) => statement.bind(
      row.id, row.client_id, row.lottery, row.draw_no, row.numbers, row.label, row.saved_at,
      row.matched_count, row.bonus_matched, row.rank_no, row.checked_at,
    )))
    return rows
  })
}

export async function getSavedPicksByClientQuery(db: D1Database, clientId: string, lottery: string, limit: number) {
  return withTable(db, async () => {
    const { results } = await db
      .prepare('SELECT * FROM saved_picks WHERE client_id = ? AND lottery = ? ORDER BY draw_no DESC, saved_at DESC LIMIT ?')
      .bind(clientId, lottery, limit)
      .all<SavedPickRow>()
    return results
  })
}

export async function countSavedPicksByClientQuery(db: D1Database, clientId: string) {
  return withTable(db, async () => {
    const row = await db
      .prepare('SELECT COUNT(*) AS count FROM saved_picks WHERE client_id = ?')
      .bind(clientId)
      .first<{ count: number }>()
    return row?.count ?? 0
  })
}

// client_id 를 조건에 함께 넣어 남의 행은 지울 수 없게 한다
export async function deleteSavedPickQuery(db: D1Database, clientId: string, id: string) {
  return withTable(db, async () => {
    const result = await db
      .prepare('DELETE FROM saved_picks WHERE id = ? AND client_id = ?')
      .bind(id, clientId)
      .run()
    return (result.meta?.changes ?? 0) > 0
  })
}

// 아직 채점하지 않았고, 결과가 나온 회차의 저장분
export async function getUncheckedSavedPicksQuery(db: D1Database, lottery: string, maxDrawNo: number, limit: number) {
  return withTable(db, async () => {
    const { results } = await db
      .prepare('SELECT * FROM saved_picks WHERE lottery = ? AND checked_at IS NULL AND draw_no <= ? ORDER BY draw_no ASC LIMIT ?')
      .bind(lottery, maxDrawNo, limit)
      .all<SavedPickRow>()
    return results
  })
}

export async function markSavedPickCheckedQuery(
  db: D1Database,
  id: string,
  grade: { matchedCount: number; bonusMatched: boolean; rankNo: number | null; winningBand?: string | null },
  checkedAt: string,
) {
  const run = () => db
    .prepare('UPDATE saved_picks SET matched_count = ?, bonus_matched = ?, rank_no = ?, checked_at = ?, winning_band = ? WHERE id = ?')
    .bind(grade.matchedCount, grade.bonusMatched ? 1 : 0, grade.rankNo, checkedAt, grade.winningBand ?? null, id)
    .run()

  return withTable(db, async () => {
    try {
      await run()
    } catch (error) {
      // 운영 테이블에 열이 없으면 추가하고 다시 시도한다
      const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
      if (!/no such column/i.test(message)) throw error
      await db.prepare('ALTER TABLE saved_picks ADD COLUMN winning_band TEXT').run()
      await run()
    }
  })
}
