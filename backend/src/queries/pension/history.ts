import type { Pension720DrawRecord, Pension720PrizeCountRecord } from '../../types/pension'

export async function getLatestStoredPensionDrawNo(db: D1Database) {
  const row = await db.prepare(
    'SELECT draw_no FROM pension720_draws ORDER BY draw_no DESC LIMIT 1'
  ).first<{ draw_no: number }>()

  return row?.draw_no ?? 0
}

export async function upsertPensionDraw(db: D1Database, row: Pension720DrawRecord) {
  await db.prepare(
    `INSERT OR REPLACE INTO pension720_draws
    (draw_no, draw_date, winning_band, winning_number, bonus_number, synced_at, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    row.draw_no,
    row.draw_date,
    row.winning_band,
    row.winning_number,
    row.bonus_number,
    row.synced_at,
    row.raw_payload ?? null,
  ).run()
}

export async function upsertPensionPrizeCount(db: D1Database, row: Pension720PrizeCountRecord) {
  await db.prepare(
    `INSERT OR REPLACE INTO pension720_prize_counts
    (draw_no, rank_no, internet_count, store_count, total_count, win_amount, total_amount, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    row.draw_no,
    row.rank_no,
    row.internet_count,
    row.store_count,
    row.total_count,
    row.win_amount,
    row.total_amount,
    row.raw_payload ?? null,
  ).run()
}
