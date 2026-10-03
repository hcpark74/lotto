import { fetchLottoResult, fetchLottoResultWindow, getLatestDrawNo, LOTTO_WINDOW_SIZE } from '../clients/lotto'
import {
  countLottoDrawsMissingPrizeStatsQuery,
  ensureLottoPrizeColumns,
  getLatestStoredLottoDrawNo,
  getLottoDrawsMissingPrizeStatsQuery,
  insertLottoResult,
  insertLottoResults,
} from '../queries/lotto'
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

// 등위별 당첨자 수·판매액 백필. 추첨 직후에는 집계가 없어 NULL 로 들어가므로
// 나중에 다시 받아 채워야 한다 (docs/PLAN.md Phase 1).
// 한 호출이 10회차를 돌려주므로 창 단위로 받아 호출 수를 줄인다.
export type LottoPrizeBackfillSummary = {
  scanned: number
  filled: number
  requests: number
  remaining: number
}

export async function backfillLottoPrizeStats(
  db: D1Database,
  maxRequests: number,
): Promise<LottoPrizeBackfillSummary> {
  await ensureLottoPrizeColumns(db)

  // 한 번에 처리할 회차 수. 창 하나가 10회차라 요청 수 × 10 만큼만 집어 온다.
  const missing = await getLottoDrawsMissingPrizeStatsQuery(db, maxRequests * LOTTO_WINDOW_SIZE)
  if (missing.length === 0) return { scanned: 0, filled: 0, requests: 0, remaining: 0 }

  const pending = new Set(missing)
  let requests = 0
  let filled = 0

  // 내림차순이라 앞에서부터 창을 잡으면 겹치는 회차가 한 번에 정리된다
  for (const drwNo of missing) {
    if (requests >= maxRequests) break
    if (!pending.has(drwNo)) continue

    requests += 1
    // 창은 요청 회차를 가운데(앞 4 + 요청 + 뒤 5) 두므로, 남은 최대 회차를 창의 위쪽 끝에
    // 맞추려면 4 를 빼고 요청해야 한다. 그대로 요청하면 위쪽 4개가 이미 채운 회차라 낭비된다.
    const window = await fetchLottoResultWindow(Math.max(drwNo - 4, 1))

    // 창 하나(최대 10회차)를 한 번의 batch 로 넣는다. 낱개로 넣으면 Workers 구독요청이
    // 창당 10건씩 늘어 호출당 한도(무료 플랜 50건)를 금방 넘긴다.
    const ready = window.filter((record) => record.prizeStats != null)
    if (ready.length > 0) {
      await insertLottoResults(db, ready)
      for (const record of ready) {
        if (pending.delete(record.drwNo)) filled += 1
      }
    }

    // 창에 없었거나 아직 집계 전이면 이번 회차는 비워 둔 채 넘어간다
    pending.delete(drwNo)
  }

  return {
    scanned: missing.length,
    filled,
    requests,
    remaining: await countLottoDrawsMissingPrizeStatsQuery(db),
  }
}
