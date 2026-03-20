import type { Pension720PrizeCountQueryRow, Pension720ResultQueryRow } from '../../types/pension'
import type { PensionBacktestRow, PensionWinningNumberRow } from '../../types/pension/models'

export async function getPensionResultByDrawNoQuery(db: D1Database, drawNo: number) {
  return db.prepare(
    'SELECT draw_no, draw_date, winning_band, winning_number, bonus_number, synced_at FROM pension720_draws WHERE draw_no = ?'
  ).bind(drawNo).first<Pension720ResultQueryRow>()
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

export async function getRecentPensionWinningNumbersQuery(db: D1Database, limit: number) {
  const { results } = await db.prepare(
    'SELECT winning_number FROM pension720_draws ORDER BY draw_no DESC LIMIT ?'
  ).bind(limit).all<PensionWinningNumberRow>()

  return results
}

export async function getAllPensionBacktestRowsQuery(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT draw_no, winning_number FROM pension720_draws ORDER BY draw_no ASC'
  ).all<PensionBacktestRow>()

  return results
}
