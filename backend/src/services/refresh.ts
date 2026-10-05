// 토큰 없이 쓰는 새로고침. 관리자용 POST /api/sync 와 달리 아무나 부를 수 있으므로
// 두 겹으로 막는다.
//   1) 일정 계산 — 다음 추첨이 지나지 않았거나 이미 받아왔으면 외부 요청을 아예 안 한다.
//      평소에는 여기서 끝나므로 버튼을 연타해도 동행복권에 요청이 가지 않는다.
//   2) 쿨다운 — 진짜 뒤처졌을 때만, 그것도 COOLDOWN_SECONDS 에 한 번만 받아온다.
// 등위 집계 백필은 요청이 20건이라 여기서 돌리지 않는다 (cron 몫).
import { isBehindSchedule, lastDrawTime } from '../algorithms/draw-schedule'
import { getLatestCronRunsQuery } from '../queries/cron-runs'
import { claimSyncAttemptQuery, getLastSyncAttemptQuery } from '../queries/sync-attempts'
import { getRecentLottoResults } from './lotto-results'
import { getRecentPensionResults } from './pension-results'
import { syncLatestLottoResults } from './lotto-sync'
import { syncPensionResults } from './pension-sync'
import { checkSavedPicks } from './saved-picks'
import type { Lottery } from '../types/saved-picks'

export const COOLDOWN_SECONDS = 60

export type RefreshResult = {
  lottery: Lottery
  // up-to-date: 받아올 게 없다 | cooldown: 방금 시도했다 | synced: 받아왔다
  status: 'up-to-date' | 'cooldown' | 'synced'
  latestDraw: number | null
  syncedCount: number
  checkedPicks: number
  retryAfterSeconds?: number
}

async function latestStored(db: D1Database, lottery: Lottery) {
  if (lottery === 'lotto') {
    const rows = await getRecentLottoResults(db, 1)
    const row = rows[0]
    return row ? { drawNo: row.drwNo, date: row.drwNoDate } : null
  }

  const rows = await getRecentPensionResults(db, 1)
  const row = rows[0]
  return row ? { drawNo: row.draw_no, date: row.draw_date } : null
}

export async function refreshLottery(db: D1Database, lottery: Lottery, now = new Date()): Promise<RefreshResult> {
  const stored = await latestStored(db, lottery)
  const base = { lottery, latestDraw: stored?.drawNo ?? null, syncedCount: 0, checkedPicks: 0 }

  // 1) 일정으로 먼저 거른다 — 외부 요청 없음
  if (!isBehindSchedule(lottery, stored?.date ?? null, now)) {
    return { ...base, status: 'up-to-date' }
  }

  // 2) 쿨다운. 검사와 기록을 한 문장으로 해야 동시 요청이 함께 빠져나가지 않는다.
  const notBefore = new Date(now.getTime() - COOLDOWN_SECONDS * 1000).toISOString()
  const claimed = await claimSyncAttemptQuery(db, lottery, now.toISOString(), notBefore)
  if (!claimed) {
    const last = await getLastSyncAttemptQuery(db, lottery)
    const elapsed = last ? (now.getTime() - new Date(last).getTime()) / 1000 : 0
    return { ...base, status: 'cooldown', retryAfterSeconds: Math.max(Math.ceil(COOLDOWN_SECONDS - elapsed), 1) }
  }

  const synced = lottery === 'lotto'
    ? await syncLatestLottoResults(db, 5)
    : await syncPensionResults(db, 5)

  const syncedCount = synced.syncedCount
  // 새 회차가 들어왔을 때만 채점한다. 아니면 D1 을 괜히 읽는다.
  const checked = syncedCount > 0 ? await checkSavedPicks(db, lottery) : { checked: 0, won: 0 }

  const after = await latestStored(db, lottery)
  return {
    lottery,
    status: 'synced',
    latestDraw: after?.drawNo ?? null,
    syncedCount,
    checkedPicks: checked.checked,
  }
}

export type SyncStatus = {
  lottery: Lottery
  latestDraw: number | null
  latestDrawDate: string | null
  // 마지막 추첨 시각 (이 뒤로 cron 이 돌았어야 한다)
  lastDrawAt: string
  lastCronAt: string | null
  lastCronOk: boolean | null
  lastSuccessAt: string | null
  // cron 이 마지막 추첨 뒤로 한 번도 돌지 않았다. 2026-10-03 에 실제로 일어났다.
  cronOverdue: boolean
  // 받아와야 할 회차가 아직 안 들어왔다
  behindSchedule: boolean
}

export async function getSyncStatus(db: D1Database, lottery: Lottery, now = new Date()): Promise<SyncStatus> {
  const stored = await latestStored(db, lottery)
  const runs = await getLatestCronRunsQuery(db, lottery, 10)
  const lastDraw = lastDrawTime(lottery, now)

  const last = runs[0] ?? null
  const lastSuccess = runs.find((run) => run.ok === 1) ?? null

  return {
    lottery,
    latestDraw: stored?.drawNo ?? null,
    latestDrawDate: stored?.date ?? null,
    lastDrawAt: lastDraw.toISOString(),
    lastCronAt: last?.ran_at ?? null,
    lastCronOk: last ? last.ok === 1 : null,
    lastSuccessAt: lastSuccess?.ran_at ?? null,
    // 기록이 아예 없으면(기능 추가 직후) 늦었다고 단정하지 않는다.
    // 다만 기록은 있는데 그 안에 성공이 하나도 없으면 늦은 것이다 —
    // cron 이 계속 죽고 있는 바로 그 경우이고, 이 기능이 잡으려던 상황이다.
    cronOverdue: runs.length > 0 && (lastSuccess == null || new Date(lastSuccess.ran_at) < lastDraw),
    behindSchedule: isBehindSchedule(lottery, stored?.date ?? null, now),
  }
}
