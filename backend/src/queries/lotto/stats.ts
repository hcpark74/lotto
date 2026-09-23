import type { DrawNumbersRow } from '../../types/lotto'

export async function getAllLottoDrawNumbersQuery(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT drwtNo1,drwtNo2,drwtNo3,drwtNo4,drwtNo5,drwtNo6 FROM lotto_history ORDER BY drwNo ASC'
  ).all() as { results: DrawNumbersRow[] }

  return results
}

// 백테스트 캐시 키용. 새 회차가 들어오거나 빠진 회차가 채워지면 값이 바뀐다.
export async function getLottoDataVersionQuery(db: D1Database) {
  const row = await db.prepare('SELECT MAX(drwNo) AS latest, COUNT(*) AS count FROM lotto_history').first<{ latest: number | null; count: number }>()
  return { latest: row?.latest ?? 0, count: row?.count ?? 0 }
}

export async function getAllLottoBacktestRowsQuery(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT drwNo, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo FROM lotto_history ORDER BY drwNo ASC'
  ).all() as { results: DrawNumbersRow[] }

  return results
}
