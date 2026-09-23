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
    if (!result) {
      // 루프 조건상 이 회차는 이미 발표됐다 (currentDrwNo <= latestDraw). 결과가 없거나 검증에 실패한 것은
      // 이상 상황이라 대시보드에서 보이도록 error 로 남긴다. 다음 cron 에서 다시 시도한다.
      console.error(`로또 ${currentDrwNo}회는 발표됐지만(최신 ${latestDraw}회) 결과를 받지 못해 동기화를 멈춥니다.`)
      break
    }

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
