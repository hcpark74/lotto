import type { Pension720PrizeCountQueryRow, Pension720ResultQueryRow } from '../../types/pension'
import type { PensionBacktestRow, PensionWinningNumberRow } from '../../types/pension/models'

export async function getPensionResultByDrawNoQuery(db: D1Database, drawNo: number) {
  return db.prepare(
    'SELECT draw_no, draw_date, winning_band, winning_number, bonus_number, synced_at FROM pension720_draws WHERE draw_no = ?'
  ).bind(drawNo).first<Pension720ResultQueryRow>()
}

// 여러 회차를 한 번에. 저장한 번호 목록에 당첨번호를 곁들일 때 쓴다 (바인딩 100개 한도 안에서).
export async function getPensionResultsByDrawNosQuery(db: D1Database, drawNos: number[]) {
  if (drawNos.length === 0) return []
  const { results } = await db.prepare(
    `SELECT draw_no, draw_date, winning_band, winning_number, bonus_number, synced_at FROM pension720_draws WHERE draw_no IN (${drawNos.map(() => '?').join(', ')})`
  ).bind(...drawNos).all<Pension720ResultQueryRow>()

  return results
}

export async function getPensionPrizeCountsByDrawNoQuery(db: D1Database, drawNo: number) {
  const { results } = await db.prepare(
    'SELECT rank_no, internet_count, store_count, total_count, win_amount, total_amount FROM pension720_prize_counts WHERE draw_no = ? ORDER BY rank_no ASC'
  ).bind(drawNo).all<Pension720PrizeCountQueryRow>()

  return results
}

export async function getRecentPensionResultsQuery(db: D1Database, limit: number) {
  const { results } = await db.prepare(
    'SELECT draw_no, draw_date, winning_band, winning_number, bonus_number, synced_at FROM pension720_draws ORDER BY draw_no DESC LIMIT ?'
  ).bind(limit).all<Pension720ResultQueryRow>()

  return results
}

// draw_no 이하에서 최신순 limit 개. 회차 브라우저가 "보는 회차부터 과거로" 창을 잡을 때 쓴다.
export async function getPensionResultsUpToQuery(db: D1Database, drawNo: number, limit: number) {
  const { results } = await db.prepare(
    'SELECT draw_no, draw_date, winning_band, winning_number, bonus_number, synced_at FROM pension720_draws WHERE draw_no <= ? ORDER BY draw_no DESC LIMIT ?'
  ).bind(drawNo, limit).all<Pension720ResultQueryRow>()

  return results
}

export async function getRecentPensionWinningNumbersQuery(db: D1Database, limit: number) {
  const { results } = await db.prepare(
    'SELECT winning_number FROM pension720_draws ORDER BY draw_no DESC LIMIT ?'
  ).bind(limit).all<PensionWinningNumberRow>()

  return results
}

// 백테스트 캐시 키용. 새 회차가 들어오거나 빠진 회차가 채워지면 값이 바뀐다.
export async function getPensionDataVersionQuery(db: D1Database) {
  const row = await db.prepare('SELECT MAX(draw_no) AS latest, COUNT(*) AS count FROM pension720_draws').first<{ latest: number | null; count: number }>()
  return { latest: row?.latest ?? 0, count: row?.count ?? 0 }
}

export async function getAllPensionBacktestRowsQuery(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT draw_no, winning_number, bonus_number FROM pension720_draws ORDER BY draw_no ASC'
  ).all<PensionBacktestRow>()

  return results
}
