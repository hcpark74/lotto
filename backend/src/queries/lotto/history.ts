import type { LottoResultRecord } from '../../types/lotto'

export async function getLatestStoredLottoDrawNo(db: D1Database) {
  const row = await db.prepare('SELECT drwNo FROM lotto_history ORDER BY drwNo DESC LIMIT 1').first<{ drwNo: number }>()
  return row?.drwNo ?? 0
}

export async function insertLottoResult(db: D1Database, result: LottoResultRecord) {
  await db.prepare(
    `INSERT INTO lotto_history (drwNo, drwNoDate, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo, firstWinamnt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    result.drwNo,
    result.drwNoDate,
    result.drwtNo1,
    result.drwtNo2,
    result.drwtNo3,
    result.drwtNo4,
    result.drwtNo5,
    result.drwtNo6,
    result.bnusNo,
    result.firstWinamnt,
  ).run()
}

export async function getLottoResultCountQuery(db: D1Database) {
  const row = await db.prepare('SELECT COUNT(*) as n FROM lotto_history').first<{ n: number }>()
  return row?.n ?? 0
}
