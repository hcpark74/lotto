import { fetchPensionDrawList, fetchPensionPrizeCounts, findLatestPensionDrawNo } from '../clients/pension'
import {
  getPensionDrawNosWithIncompletePrizeCounts,
  getStoredPensionDrawNos,
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

// 1~7등 + 보너스
const PENSION_PRIZE_RANK_COUNT = 8
// 당첨 통계가 덜 채워진 기존 회차를 한 번에 몇 개까지 다시 받을지
const MAX_PRIZE_COUNT_RETRIES = 5

// 당첨 통계를 받아 저장하고 저장된 행 수를 돌려준다. 실패하면 0 을 돌려 다음 sync 에서 재시도되게 한다.
async function syncPensionPrizeCounts(db: D1Database, drawNo: number) {
  let prizeCounts: Pension720PrizeInfoItem[]

  try {
    prizeCounts = await fetchPensionPrizeCounts(drawNo)
  } catch (error) {
    console.warn(`연금복권 ${drawNo}회 당첨 통계 조회 실패:`, error)
    return 0
  }

  let savedCount = 0
  for (const prizeRow of prizeCounts) {
    const mapped = mapPensionPrizeCount(prizeRow)
    if (!mapped) continue

    await upsertPensionPrizeCount(db, mapped)
    savedCount += 1
  }

  return savedCount
}

export async function syncPensionResults(db: D1Database, limit = 0): Promise<Pension720SyncSummary> {
  const list = await fetchPensionDrawList()
  const latestDraw = findLatestPensionDrawNo(list)
  const storedDrawNos = new Set(await getStoredPensionDrawNos(db))
  // 이전 sync 에서 통계를 다 못 받은 회차. 새 회차 저장 전에 조회해야 이번 회차와 섞이지 않는다.
  const incompletePrizeDrawNos = await getPensionDrawNosWithIncompletePrizeCounts(db, PENSION_PRIZE_RANK_COUNT, MAX_PRIZE_COUNT_RETRIES)
  // 목록 API 는 전체 회차를 돌려주므로, 최대 회차 이후만이 아니라 중간에 빠진 회차도 채운다
  const newDraws = list
    .map(mapPensionDraw)
    .filter((row): row is Pension720DrawRecord => row !== null)
    .filter(row => !storedDrawNos.has(row.draw_no))
    .sort((a, b) => a.draw_no - b.draw_no)

  const limitedDraws = limit > 0 ? newDraws.slice(0, limit) : newDraws
  const pendingPrizeDrawNos: number[] = []

  for (const drawNo of incompletePrizeDrawNos) {
    if (await syncPensionPrizeCounts(db, drawNo) < PENSION_PRIZE_RANK_COUNT) pendingPrizeDrawNos.push(drawNo)
  }

  for (const row of limitedDraws) {
    await upsertPensionDraw(db, row)
    storedDrawNos.add(row.draw_no)

    if (await syncPensionPrizeCounts(db, row.draw_no) < PENSION_PRIZE_RANK_COUNT) pendingPrizeDrawNos.push(row.draw_no)
  }

  const lastSyncedDraw = Math.max(0, ...storedDrawNos)

  return {
    syncedCount: limitedDraws.length,
    latestDraw,
    nextDrawNo: lastSyncedDraw + 1,
    pendingPrizeDrawNos: pendingPrizeDrawNos.sort((a, b) => a - b),
  }
}
