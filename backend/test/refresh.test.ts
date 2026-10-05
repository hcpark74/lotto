import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/lotto-results', () => ({ getRecentLottoResults: vi.fn() }))
vi.mock('../src/services/pension-results', () => ({ getRecentPensionResults: vi.fn() }))
vi.mock('../src/services/lotto-sync', () => ({ syncLatestLottoResults: vi.fn() }))
vi.mock('../src/services/pension-sync', () => ({ syncPensionResults: vi.fn() }))
vi.mock('../src/services/saved-picks', () => ({ checkSavedPicks: vi.fn() }))
vi.mock('../src/queries/sync-attempts', () => ({
  getLastSyncAttemptQuery: vi.fn(),
  claimSyncAttemptQuery: vi.fn(),
}))

const { COOLDOWN_SECONDS, refreshLottery } = await import('../src/services/refresh')
const { getRecentLottoResults } = await import('../src/services/lotto-results')
const { syncLatestLottoResults } = await import('../src/services/lotto-sync')
const { checkSavedPicks } = await import('../src/services/saved-picks')
const { getLastSyncAttemptQuery, claimSyncAttemptQuery } = await import('../src/queries/sync-attempts')

const stored = vi.mocked(getRecentLottoResults)
const sync = vi.mocked(syncLatestLottoResults)
const check = vi.mocked(checkSavedPicks)
const lastAttempt = vi.mocked(getLastSyncAttemptQuery)
const claim = vi.mocked(claimSyncAttemptQuery)

const db = {} as D1Database
const kst = (s: string) => new Date(`${s}+09:00`)
const row = (drwNo: number, date: string) => [{ drwNo, drwNoDate: date } as never]

describe('refreshLottery', () => {
  beforeEach(() => {
    stored.mockReset().mockResolvedValue(row(1244, '2026-10-03'))
    sync.mockReset().mockResolvedValue({ syncedCount: 1, latestDraw: 1244, nextDrwNo: 1245 })
    check.mockReset().mockResolvedValue({ checked: 3, won: 0 })
    lastAttempt.mockReset().mockResolvedValue(null)
    claim.mockReset().mockResolvedValue(true)
  })

  // 1차 방어: 평소에는 외부 요청이 아예 나가지 않아야 버튼을 연타해도 안전하다
  it('이미 최신이면 동기화하지 않는다', async () => {
    const result = await refreshLottery(db, 'lotto', kst('2026-10-04T01:00'))
    expect(result.status).toBe('up-to-date')
    expect(sync).not.toHaveBeenCalled()
    expect(claim).not.toHaveBeenCalled()
  })

  it('추첨 전이면 동기화하지 않는다', async () => {
    stored.mockResolvedValue(row(1243, '2026-09-26'))
    const result = await refreshLottery(db, 'lotto', kst('2026-10-02T12:00'))
    expect(result.status).toBe('up-to-date')
    expect(sync).not.toHaveBeenCalled()
  })

  it('추첨 직후 유예 시간 안에도 동기화하지 않는다', async () => {
    stored.mockResolvedValue(row(1243, '2026-09-26'))
    const result = await refreshLottery(db, 'lotto', kst('2026-10-03T20:40'))
    expect(result.status).toBe('up-to-date')
    expect(sync).not.toHaveBeenCalled()
  })

  it('뒤처졌으면 받아오고 저장분을 채점한다', async () => {
    stored.mockResolvedValueOnce(row(1243, '2026-09-26')).mockResolvedValueOnce(row(1244, '2026-10-03'))
    const result = await refreshLottery(db, 'lotto', kst('2026-10-04T01:00'))

    expect(result.status).toBe('synced')
    expect(result.latestDraw).toBe(1244)
    expect(result.syncedCount).toBe(1)
    expect(result.checkedPicks).toBe(3)
    expect(claim).toHaveBeenCalledOnce()
  })

  // 2차 방어: 진짜 뒤처졌을 때도 간격을 강제한다
  // 자리를 못 잡았다 = 쿨다운 안이다. 검사와 기록이 한 문장이라
  // 동시에 들어온 요청 중 하나만 통과한다.
  it('자리를 못 잡으면 받아오지 않고 남은 초를 돌려준다', async () => {
    stored.mockResolvedValue(row(1243, '2026-09-26'))
    const now = kst('2026-10-04T01:00')
    claim.mockResolvedValue(false)
    lastAttempt.mockResolvedValue(new Date(now.getTime() - 20_000).toISOString())

    const result = await refreshLottery(db, 'lotto', now)
    expect(result.status).toBe('cooldown')
    expect(result.retryAfterSeconds).toBe(COOLDOWN_SECONDS - 20)
    expect(sync).not.toHaveBeenCalled()
  })

  it('쿨다운 경계에서도 남은 초는 1 이상이다', async () => {
    stored.mockResolvedValue(row(1243, '2026-09-26'))
    const now = kst('2026-10-04T01:00')
    claim.mockResolvedValue(false)
    lastAttempt.mockResolvedValue(new Date(now.getTime() - COOLDOWN_SECONDS * 1000).toISOString())

    expect((await refreshLottery(db, 'lotto', now)).retryAfterSeconds).toBe(1)
  })

  it('자리를 잡으면 받아온다', async () => {
    stored.mockResolvedValue(row(1243, '2026-09-26'))
    claim.mockResolvedValue(true)

    expect((await refreshLottery(db, 'lotto', kst('2026-10-04T01:00'))).status).toBe('synced')
    expect(sync).toHaveBeenCalledOnce()
  })

  // 발표 전이라 0건이면 채점까지 갈 이유가 없다
  it('받아온 게 없으면 채점하지 않는다', async () => {
    stored.mockResolvedValue(row(1243, '2026-09-26'))
    sync.mockResolvedValue({ syncedCount: 0, latestDraw: 1243, nextDrwNo: 1244 })

    const result = await refreshLottery(db, 'lotto', kst('2026-10-04T01:00'))
    expect(result.syncedCount).toBe(0)
    expect(check).not.toHaveBeenCalled()
  })

  it('저장된 회차가 하나도 없으면 받아온다', async () => {
    stored.mockResolvedValueOnce([]).mockResolvedValueOnce(row(1244, '2026-10-03'))
    expect((await refreshLottery(db, 'lotto', kst('2026-10-04T01:00'))).status).toBe('synced')
  })
})
