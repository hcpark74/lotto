import {
  getPensionPrizeCountsByDrawNoQuery,
  getPensionResultByDrawNoQuery,
  getRecentPensionResultsQuery,
} from '../queries/pension'
import type {
  Pension720PrizeCountQueryRow,
  Pension720ResultDetail,
  Pension720ResultQueryRow,
} from '../types/pension'

export async function getPensionResultByDrawNo(db: D1Database, drawNo: number): Promise<Pension720ResultDetail | null> {
  const row = await getPensionResultByDrawNoQuery(db, drawNo)

  if (!row) return null

  return {
    ...row,
    prize_counts: await getPensionPrizeCountsByDrawNoQuery(db, drawNo),
  }
}

export async function getRecentPensionResults(db: D1Database, limit: number) {
  return getRecentPensionResultsQuery(db, limit)
}
