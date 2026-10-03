const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS pick_transfer_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
)`
const CREATE_INDEX = 'CREATE INDEX IF NOT EXISTS idx_pick_transfer_codes_expiry ON pick_transfer_codes (expires_at)'

function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
  return /no such table/i.test(message)
}

async function withTable<T>(db: D1Database, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (!isMissingTableError(error)) throw error
    await db.prepare(CREATE_TABLE).run()
    await db.prepare(CREATE_INDEX).run()
    return run()
  }
}

export type TransferCodeRow = { code_hash: string; client_id: string; created_at: string; expires_at: string }

// 한 기기는 코드를 하나만 들고 있게 한다 (새로 만들면 이전 것은 무효)
export async function replaceTransferCodeQuery(db: D1Database, row: TransferCodeRow) {
  return withTable(db, async () => {
    await db.prepare('DELETE FROM pick_transfer_codes WHERE client_id = ?').bind(row.client_id).run()
    await db
      .prepare('INSERT INTO pick_transfer_codes (code_hash, client_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(row.code_hash, row.client_id, row.created_at, row.expires_at)
      .run()
  })
}

export async function findTransferCodeQuery(db: D1Database, codeHash: string, now: string) {
  return withTable(db, async () =>
    db
      .prepare('SELECT code_hash, client_id, created_at, expires_at FROM pick_transfer_codes WHERE code_hash = ? AND expires_at > ?')
      .bind(codeHash, now)
      .first<TransferCodeRow>(),
  )
}

export async function deleteTransferCodeQuery(db: D1Database, codeHash: string) {
  return withTable(db, async () => {
    await db.prepare('DELETE FROM pick_transfer_codes WHERE code_hash = ?').bind(codeHash).run()
  })
}

// 만료된 코드는 쌓일 이유가 없다. 발급할 때마다 같이 치운다.
export async function deleteExpiredTransferCodesQuery(db: D1Database, now: string) {
  return withTable(db, async () => {
    await db.prepare('DELETE FROM pick_transfer_codes WHERE expires_at <= ?').bind(now).run()
  })
}

// 코드를 쓴 기기의 저장분을 원래 기기 쪽으로 합친다
export async function reassignSavedPicksQuery(db: D1Database, fromClientId: string, toClientId: string) {
  const result = await db
    .prepare('UPDATE saved_picks SET client_id = ? WHERE client_id = ?')
    .bind(toClientId, fromClientId)
    .run()
  return result.meta?.changes ?? 0
}
