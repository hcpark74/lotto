import type { LottoHistoryQueryRow } from '../../types/lotto'

export async function getLottoResultByDrawNoQuery(db: D1Database, drwNo: number) {
  return db.prepare('SELECT * FROM lotto_history WHERE drwNo = ?').bind(drwNo).first<LottoHistoryQueryRow>()
}

export async function getRecentLottoResultsQuery(db: D1Database, limit: number) {
  const { results } = await db.prepare('SELECT * FROM lotto_history ORDER BY drwNo DESC LIMIT ?').bind(limit).all<LottoHistoryQueryRow>()
  return results
}
