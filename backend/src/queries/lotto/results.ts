import type { LottoHistoryQueryRow } from '../../types/lotto'

export async function getLottoResultByDrawNoQuery(db: D1Database, drwNo: number) {
  return db.prepare('SELECT * FROM lotto_history WHERE drwNo = ?').bind(drwNo).first<LottoHistoryQueryRow>()
}

export async function getRecentLottoResultsQuery(db: D1Database, limit: number) {
  const { results } = await db.prepare('SELECT * FROM lotto_history ORDER BY drwNo DESC LIMIT ?').bind(limit).all<LottoHistoryQueryRow>()
  return results
}

// drwNo 이하에서 최신순 limit 개. 회차 브라우저가 "보는 회차부터 과거로" 창을 잡을 때 쓴다.
export async function getLottoResultsUpToQuery(db: D1Database, drwNo: number, limit: number) {
  const { results } = await db
    .prepare('SELECT * FROM lotto_history WHERE drwNo <= ? ORDER BY drwNo DESC LIMIT ?')
    .bind(drwNo, limit)
    .all<LottoHistoryQueryRow>()
  return results
}
