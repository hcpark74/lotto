import { getLottoResultByDrawNoQuery, getRecentLottoResultsQuery } from '../queries/lotto'
import type { LottoHistoryQueryRow } from '../types/lotto'

export async function getLottoResultByDrawNo(db: D1Database, drwNo: number) {
  return getLottoResultByDrawNoQuery(db, drwNo)
}

export async function getRecentLottoResults(db: D1Database, limit: number) {
  return getRecentLottoResultsQuery(db, limit)
}
