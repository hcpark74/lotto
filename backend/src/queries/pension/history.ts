import type { Pension720DrawRecord, Pension720PrizeCountRecord } from '../../types/pension'

export async function getStoredPensionDrawNos(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT draw_no FROM pension720_draws ORDER BY draw_no ASC'
  ).all<{ draw_no: number }>()

  return results.map((row) => row.draw_no)
}

// 최신 회차 newestCount 개(발표 직후라 곧 채워질 가능성이 높음) + 나머지에서 무작위 randomCount 개.
// 최신순으로만 고르면 영구히 통계를 못 받는 회차가 앞자리를 차지해 오래된 회차가 영영 재시도되지 않는다.
export async function getPensionDrawNosWithIncompletePrizeCounts(db: D1Database, rankCount: number, newestCount: number, randomCount: number) {
  const { results } = await db.prepare(
    `WITH incomplete AS (
      SELECT d.draw_no FROM pension720_draws d
      LEFT JOIN pension720_prize_counts p ON p.draw_no = d.draw_no
      GROUP BY d.draw_no
      HAVING COUNT(p.draw_no) < ?
    ),
    newest AS (SELECT draw_no FROM incomplete ORDER BY draw_no DESC LIMIT ?)
    SELECT draw_no FROM newest
    UNION
    SELECT draw_no FROM (
      SELECT draw_no FROM incomplete WHERE draw_no NOT IN (SELECT draw_no FROM newest) ORDER BY RANDOM() LIMIT ?
    )`
  ).bind(rankCount, newestCount, randomCount).all<{ draw_no: number }>()

  return results.map((row) => row.draw_no).sort((a, b) => b - a)
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
