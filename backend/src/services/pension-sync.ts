import { fetchPensionDrawList, fetchPensionPrizeCounts, findLatestPensionDrawNo } from '../clients/pension'
import {
  clearPensionPrizeSyncAttempts,
  ensurePensionPrizeSyncAttemptsTable,
  getPensionDrawNosWithIncompletePrizeCounts,
  getStoredPensionDrawNos,
  recordPensionPrizeSyncFailure,
  upsertPensionDraw,
  upsertPensionPrizeCount,
} from '../queries/pension'
import type {
  Pension720DrawRecord,
  Pension720ListItem,
  Pension720PrizeCountRecord,
  Pension720PrizeInfoItem,
  Pension720SyncSummary,
} from '../types/pension'

function mapPensionDraw(row: Pension720ListItem): Pension720DrawRecord | null {
  const drawNo = Number(row.psltEpsd)
  const date = String(row.psltRflYmd ?? '')
  const winningBand = String(row.wnBndNo ?? '').trim()
  const winningNumber = String(row.wnRnkVl ?? '').trim()
  const bonusNumber = String(row.bnsRnkVl ?? '').trim()

  if (!Number.isFinite(drawNo) || drawNo <= 0) return null
  if (!date || !winningBand || !winningNumber || !bonusNumber) return null

  const normalizedDate = date.length === 8
    ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
    : date

  return {
    draw_no: drawNo,
    draw_date: normalizedDate,
    winning_band: winningBand,
    winning_number: winningNumber,
    bonus_number: bonusNumber,
    synced_at: new Date().toISOString(),
    raw_payload: JSON.stringify(row),
  }
}


function mapPensionPrizeCount(row: Pension720PrizeInfoItem): Pension720PrizeCountRecord | null {
  const drawNo = Number(row.ltEpsd)
  const rankNo = Number(row.wnRnk)

  if (!Number.isFinite(drawNo) || drawNo <= 0) return null
  if (!Number.isFinite(rankNo) || rankNo <= 0) return null

  return {
    draw_no: drawNo,
    rank_no: rankNo,
    internet_count: Number(row.wnInternetCnt ?? 0),
    store_count: Number(row.wnStoreCnt ?? 0),
    total_count: Number(row.wnTotalCnt ?? 0),
    win_amount: row.wnAmt == null ? null : Number(row.wnAmt),
    total_amount: row.totAmt == null ? null : Number(row.totAmt),
    raw_payload: JSON.stringify(row),
  }
}

// rank_no 1~7 = 1~7등, 8 = 보너스. 이 8개 등위가 서로 다르게 모두 있어야 완결로 본다.
const PENSION_PRIZE_RANK_COUNT = 8
// 당첨 통계가 덜 채워진 기존 회차를 sync 한 번에 다시 받을 개수 (가장 오래전에 시도한 회차부터)
const PRIZE_RETRY_LIMIT = 5
// 이만큼 실패한 회차는 재시도에서 뺀다. cron 이 매일이므로 약 2주.
const MAX_PRIZE_SYNC_ATTEMPTS = 14

// 받은 행 중 서로 다른 유효 등위(1~8) 수. 중복 행이나 알 수 없는 등위는 완결 판정에 세지 않는다.
export function countDistinctPrizeRanks(rows: Pension720PrizeCountRecord[]) {
  return new Set(rows.map((row) => row.rank_no).filter((rank) => rank >= 1 && rank <= PENSION_PRIZE_RANK_COUNT)).size
}

// 당첨 통계를 받아 저장하고 완결 여부를 돌려준다. 불완전하면 시도 횟수를 기록해 다음 sync 에서 순서대로 재시도한다.
async function syncPensionPrizeCounts(db: D1Database, drawNo: number) {
  let rows: Pension720PrizeCountRecord[] = []

  try {
    const prizeCounts: Pension720PrizeInfoItem[] = await fetchPensionPrizeCounts(drawNo)
    rows = prizeCounts.map(mapPensionPrizeCount).filter((row): row is Pension720PrizeCountRecord => row !== null)
  } catch (error) {
    console.warn(`연금복권 ${drawNo}회 당첨 통계 조회 실패:`, error)
  }

  for (const row of rows) await upsertPensionPrizeCount(db, row)

  if (countDistinctPrizeRanks(rows) >= PENSION_PRIZE_RANK_COUNT) {
    await clearPensionPrizeSyncAttempts(db, drawNo)
    return true
  }

  const attempts = await recordPensionPrizeSyncFailure(db, drawNo)
  if (attempts >= MAX_PRIZE_SYNC_ATTEMPTS) {
    console.error(`연금복권 ${drawNo}회 당첨 통계가 ${attempts}번 시도에도 불완전해 재시도를 멈춥니다.`)
  }
  return false
}

export async function syncPensionResults(db: D1Database, limit = 0): Promise<Pension720SyncSummary> {
  const list = await fetchPensionDrawList()
  const latestDraw = findLatestPensionDrawNo(list)
  await ensurePensionPrizeSyncAttemptsTable(db)
  const storedDrawNos = new Set(await getStoredPensionDrawNos(db))
  // 이전 sync 에서 통계를 다 못 받은 회차. 새 회차 저장 전에 조회해야 이번 회차와 섞이지 않는다.
  const incompletePrizeDrawNos = await getPensionDrawNosWithIncompletePrizeCounts(db, PENSION_PRIZE_RANK_COUNT, MAX_PRIZE_SYNC_ATTEMPTS, PRIZE_RETRY_LIMIT)
  // 목록 API 는 전체 회차를 돌려주므로, 최대 회차 이후만이 아니라 중간에 빠진 회차도 채운다
  const newDraws = list
    .map(mapPensionDraw)
    .filter((row): row is Pension720DrawRecord => row !== null)
    .filter(row => !storedDrawNos.has(row.draw_no))
    .sort((a, b) => a.draw_no - b.draw_no)

  const limitedDraws = limit > 0 ? newDraws.slice(0, limit) : newDraws
  const pendingPrizeDrawNos: number[] = []

  for (const drawNo of incompletePrizeDrawNos) {
    if (!(await syncPensionPrizeCounts(db, drawNo))) pendingPrizeDrawNos.push(drawNo)
  }

  for (const row of limitedDraws) {
    await upsertPensionDraw(db, row)
    storedDrawNos.add(row.draw_no)

    if (!(await syncPensionPrizeCounts(db, row.draw_no))) pendingPrizeDrawNos.push(row.draw_no)
  }

  const lastSyncedDraw = Math.max(0, ...storedDrawNos)

  return {
    syncedCount: limitedDraws.length,
    latestDraw,
    nextDrawNo: lastSyncedDraw + 1,
    pendingPrizeDrawNos: pendingPrizeDrawNos.sort((a, b) => a - b),
  }
}
