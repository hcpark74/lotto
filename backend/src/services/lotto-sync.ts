import { fetchLottoResult, getLatestDrawNo } from '../clients/lotto'
import { getLatestStoredLottoDrawNo, insertLottoResult } from '../queries/lotto'
import type { LottoSyncSummary } from '../types/lotto'

export async function syncLatestLottoResults(db: D1Database, maxSyncPerRequest = 10): Promise<LottoSyncSummary> {
  const latestDraw = await getLatestDrawNo()
  let currentDrwNo = await getLatestStoredLottoDrawNo(db) + 1
  let syncedCount = 0

  while (currentDrwNo <= latestDraw && syncedCount < maxSyncPerRequest) {
    // 요청 실패는 throw 되어 라우트가 500 으로 알린다. null 은 아직 발표 전이거나 검증 실패라 여기서 멈춘다.
    const result = await fetchLottoResult(currentDrwNo)
    if (!result) break

    await insertLottoResult(db, result)

    currentDrwNo += 1
    syncedCount += 1
  }

  return {
    syncedCount,
    nextDrwNo: currentDrwNo,
    latestDraw,
  }
}
