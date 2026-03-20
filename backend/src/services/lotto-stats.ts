import { getAllLottoDrawNumbersQuery } from '../queries/lotto'
import type { DrawNumbersRow, LottoHotNumber } from '../types/lotto'

const LOTTO_NUMBER_COLUMNS = ['drwtNo1', 'drwtNo2', 'drwtNo3', 'drwtNo4', 'drwtNo5', 'drwtNo6'] as const

export function getHotNumbers(draws: DrawNumbersRow[], limit = 10): LottoHotNumber[] {
  const counts = new Map<number, number>()

  for (const draw of draws) {
    for (const column of LOTTO_NUMBER_COLUMNS) {
      const value = draw[column]
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([num, count]) => ({ num, count }))
    .sort((a, b) => b.count - a.count || a.num - b.num)
    .slice(0, limit)
}

export async function getHotNumbersFromDb(db: D1Database, limit = 10) {
  return getHotNumbers(await getAllLottoDrawNumbersQuery(db), limit)
}
