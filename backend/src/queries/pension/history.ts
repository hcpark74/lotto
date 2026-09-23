import type { Pension720DrawRecord, Pension720PrizeCountRecord } from '../../types/pension'

export async function getStoredPensionDrawNos(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT draw_no FROM pension720_draws ORDER BY draw_no ASC'
  ).all<{ draw_no: number }>()

  return results.map((row) => row.draw_no)
}

// schema.sql 과 같은 정의. 운영 DB 에 테이블이 없어도 sync 시작 때 만든다.
const CREATE_PRIZE_SYNC_ATTEMPTS_TABLE = `CREATE TABLE IF NOT EXISTS pension720_prize_sync_attempts (
  draw_no INTEGER PRIMARY KEY,
  attempts INTEGER NOT NULL,
  last_attempt_at TEXT NOT NULL
)`

export async function ensurePensionPrizeSyncAttemptsTable(db: D1Database) {
  await db.prepare(CREATE_PRIZE_SYNC_ATTEMPTS_TABLE).run()
}

// 1~rankCount 등위 중 서로 다른 rank_no 가 다 모이지 않은 회차를 재시도 대상으로 고른다.
// 가장 오래전에 시도한 회차(한 번도 시도 안 한 회차 먼저)부터 돌아가며 고르고, maxAttempts 번 실패한 회차는 제외한다.
// 그래서 영구히 불완전한 회차가 있어도 다른 회차의 재시도 차례를 계속 차지하지 않는다.
export async function getPensionDrawNosWithIncompletePrizeCounts(db: D1Database, rankCount: number, maxAttempts: number, limit: number) {
  const { results } = await db.prepare(
    `WITH incomplete AS (
      SELECT d.draw_no FROM pension720_draws d
      LEFT JOIN pension720_prize_counts p ON p.draw_no = d.draw_no AND p.rank_no BETWEEN 1 AND ?
      GROUP BY d.draw_no
      HAVING COUNT(DISTINCT p.rank_no) < ?
    )
    SELECT i.draw_no FROM incomplete i
    LEFT JOIN pension720_prize_sync_attempts a ON a.draw_no = i.draw_no
    WHERE COALESCE(a.attempts, 0) < ?
    ORDER BY a.last_attempt_at IS NOT NULL, a.last_attempt_at ASC, i.draw_no DESC
    LIMIT ?`
  ).bind(rankCount, rankCount, maxAttempts, limit).all<{ draw_no: number }>()

  return results.map((row) => row.draw_no)
}

// 통계가 불완전한 채로 끝난 시도를 기록한다. 반환값은 누적 시도 횟수.
export async function recordPensionPrizeSyncFailure(db: D1Database, drawNo: number) {
  const row = await db.prepare(
    `INSERT INTO pension720_prize_sync_attempts (draw_no, attempts, last_attempt_at) VALUES (?, 1, ?)
    ON CONFLICT(draw_no) DO UPDATE SET attempts = attempts + 1, last_attempt_at = excluded.last_attempt_at
    RETURNING attempts`
  ).bind(drawNo, new Date().toISOString()).first<{ attempts: number }>()

  return row?.attempts ?? 1
}

export async function clearPensionPrizeSyncAttempts(db: D1Database, drawNo: number) {
  await db.prepare('DELETE FROM pension720_prize_sync_attempts WHERE draw_no = ?').bind(drawNo).run()
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
