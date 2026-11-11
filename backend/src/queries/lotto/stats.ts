import type { WhatIfDraw } from '../../algorithms/lotto-what-if'
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

// "만약에" 계산용 전 회차. 등위별 당첨자 수·지급액 열은 옛 DB 에 없을 수 있어 * 로 읽는다
// (없는 열은 undefined 로 오고, 계산 쪽이 판매액 역산이나 고정액으로 물러난다).
export async function getAllLottoWhatIfRowsQuery(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM lotto_history ORDER BY drwNo ASC').all<WhatIfDraw>()
  return results
}
