import type { DrawNumbersRow } from '../../types/lotto'

export async function getAllLottoDrawNumbersQuery(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT drwtNo1,drwtNo2,drwtNo3,drwtNo4,drwtNo5,drwtNo6 FROM lotto_history'
  ).all() as { results: DrawNumbersRow[] }

  return results
}

export async function getAllLottoBacktestRowsQuery(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT drwNo, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo FROM lotto_history ORDER BY drwNo ASC'
  ).all() as { results: DrawNumbersRow[] }

  return results
}
