import { fetchLottoResult, getLatestDrawNo } from '../clients/lotto'
import { getLatestStoredLottoDrawNo, insertLottoResult } from '../queries/lotto'
import type { LottoResultRecord, LottoSyncSummary } from '../types/lotto'

export async function syncLatestLottoResults(db: D1Database, maxSyncPerRequest = 10): Promise<LottoSyncSummary> {
  const latestDraw = await getLatestDrawNo()
  let currentDrwNo = await getLatestStoredLottoDrawNo(db) + 1
  let syncedCount = 0
  let lastResult: LottoResultRecord | null = null

  while (currentDrwNo <= latestDraw && syncedCount < maxSyncPerRequest) {
    const result = await fetchLottoResult(currentDrwNo)
    lastResult = result

    if (!result) break

    await insertLottoResult(db, result)

    currentDrwNo += 1
    syncedCount += 1
  }

  return {
    syncedCount,
    nextDrwNo: currentDrwNo,
    latestDraw,
    debug: lastResult,
  }
}
