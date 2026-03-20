import { fetchPensionDrawList, fetchPensionPrizeCounts, getLatestPensionDrawNo } from '../clients/pension'
import { getLatestStoredPensionDrawNo, upsertPensionDraw, upsertPensionPrizeCount } from '../queries/pension'
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

export async function syncPensionResults(db: D1Database, limit = 0): Promise<Pension720SyncSummary> {
  const latestDraw = await getLatestPensionDrawNo()
  const list = await fetchPensionDrawList()
  const currentMaxDraw = await getLatestStoredPensionDrawNo(db)
  const newDraws = list
    .map(mapPensionDraw)
    .filter((row): row is Pension720DrawRecord => row !== null)
    .filter(row => row.draw_no > currentMaxDraw)
    .sort((a, b) => a.draw_no - b.draw_no)

  const limitedDraws = limit > 0 ? newDraws.slice(0, limit) : newDraws

  for (const row of limitedDraws) {
    await upsertPensionDraw(db, row)

    const prizeCounts = await fetchPensionPrizeCounts(row.draw_no)
    for (const prizeRow of prizeCounts) {
      const mapped = mapPensionPrizeCount(prizeRow)
      if (!mapped) continue

      await upsertPensionPrizeCount(db, mapped)
    }
  }

  return {
    syncedCount: limitedDraws.length,
    latestDraw,
    nextDrawNo: latestDraw + 1,
  }
}
