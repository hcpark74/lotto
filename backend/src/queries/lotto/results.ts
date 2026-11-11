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

// 여러 회차를 한 번에. 저장한 번호 목록에 당첨번호를 곁들일 때 쓴다.
// D1 은 한 쿼리에 바인딩 100개까지라 호출하는 쪽이 그 안으로 준다 (목록 상한 60).
export async function getLottoResultsByDrawNosQuery(db: D1Database, drwNos: number[]) {
  if (drwNos.length === 0) return []
  const { results } = await db
    .prepare(`SELECT * FROM lotto_history WHERE drwNo IN (${drwNos.map(() => '?').join(', ')})`)
    .bind(...drwNos)
    .all<LottoHistoryQueryRow>()
  return results
}
