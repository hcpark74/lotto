// 구글 계정 ↔ 보관함 연결. 저장하는 건 구글의 sub 뿐이다 —
// 이메일·이름·사진은 받더라도 버린다. 계정을 가르는 데 필요하지 않고,
// 저장하지 않으면 지켜야 할 개인정보도 생기지 않는다.
//
// 계정이 client_id 하나를 소유하고, 로그인하면 그 ID 를 기기에 넘겨준다.
// 저장·채점·조회는 전부 client_id 로 돌아가므로 그 경로는 손대지 않는다.
const CREATE = `CREATE TABLE IF NOT EXISTS accounts (
  google_sub TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
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

export type AccountRow = { google_sub: string; client_id: string; created_at: string; last_seen_at: string }

export async function getAccountQuery(db: D1Database, googleSub: string) {
  return withTable(db, async () =>
    (await db.prepare('SELECT * FROM accounts WHERE google_sub = ?').bind(googleSub).first<AccountRow>()) ?? null)
}

export async function createAccountQuery(db: D1Database, row: AccountRow) {
  return withTable(db, async () => {
    await db
      .prepare('INSERT INTO accounts (google_sub, client_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)')
      .bind(row.google_sub, row.client_id, row.created_at, row.last_seen_at)
      .run()
  })
}

export async function touchAccountQuery(db: D1Database, googleSub: string, at: string) {
  return withTable(db, async () => {
    await db.prepare('UPDATE accounts SET last_seen_at = ? WHERE google_sub = ?').bind(at, googleSub).run()
  })
}
