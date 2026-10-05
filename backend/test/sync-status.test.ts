import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/lotto-results', () => ({ getRecentLottoResults: vi.fn() }))
vi.mock('../src/services/pension-results', () => ({ getRecentPensionResults: vi.fn() }))
vi.mock('../src/services/lotto-sync', () => ({ syncLatestLottoResults: vi.fn() }))
vi.mock('../src/services/pension-sync', () => ({ syncPensionResults: vi.fn() }))
vi.mock('../src/services/saved-picks', () => ({ checkSavedPicks: vi.fn() }))
vi.mock('../src/queries/sync-attempts', () => ({ getLastSyncAttemptQuery: vi.fn(), markSyncAttemptQuery: vi.fn() }))
vi.mock('../src/queries/cron-runs', () => ({ getLatestCronRunsQuery: vi.fn() }))

const { getSyncStatus } = await import('../src/services/refresh')
const { getRecentLottoResults } = await import('../src/services/lotto-results')
const { getLatestCronRunsQuery } = await import('../src/queries/cron-runs')

const stored = vi.mocked(getRecentLottoResults)
const runs = vi.mocked(getLatestCronRunsQuery)
const db = {} as D1Database
const kst = (s: string) => new Date(`${s}+09:00`)
const run = (at: string, ok: 1 | 0) => ({ lottery: 'lotto', cron: '10 12,13 * * SAT', ran_at: kst(at).toISOString(), ok, synced_count: ok ? 1 : null, detail: '' })

// 1244회 추첨: 2026-10-03(토) 20:35 KST
describe('getSyncStatus', () => {
  beforeEach(() => {
    stored.mockReset().mockResolvedValue([{ drwNo: 1244, drwNoDate: '2026-10-03' } as never])
    runs.mockReset().mockResolvedValue([])
  })

  it('추첨 뒤에 성공 기록이 있으면 늦지 않은 것', async () => {
    runs.mockResolvedValue([run('2026-10-03T22:10', 1)])
    const s = await getSyncStatus(db, 'lotto', kst('2026-10-04T01:00'))
    expect(s.cronOverdue).toBe(false)
    expect(s.behindSchedule).toBe(false)
    expect(s.lastCronOk).toBe(true)
  })

  // 2026-10-03 에 실제로 일어난 상황 — 추첨은 끝났는데 cron 이 한 번도 안 돌았다
  it('마지막 성공이 추첨 이전이면 늦은 것', async () => {
    runs.mockResolvedValue([run('2026-10-03T06:30', 1)])
    const s = await getSyncStatus(db, 'lotto', kst('2026-10-04T01:00'))
    expect(s.cronOverdue).toBe(true)
  })

  it('실패 기록이 맨 앞이어도 마지막 성공으로 판단한다', async () => {
    runs.mockResolvedValue([run('2026-10-03T22:10', 0), run('2026-10-03T06:30', 1)])
    const s = await getSyncStatus(db, 'lotto', kst('2026-10-04T01:00'))
    expect(s.lastCronOk).toBe(false)     // 최근 실행은 실패
    expect(s.cronOverdue).toBe(true)     // 성공은 추첨 전이 마지막
  })

  // 리뷰에서 잡힌 구멍 — 최근 기록이 전부 실패면 lastSuccess 가 없어서
  // "늦지 않았다" 로 빠졌다. cron 이 계속 죽는 바로 그 경우라 거꾸로였다.
  it('최근 기록이 전부 실패면 늦은 것으로 본다', async () => {
    runs.mockResolvedValue([run('2026-10-03T22:10', 0), run('2026-10-03T21:10', 0)])
    const s = await getSyncStatus(db, 'lotto', kst('2026-10-04T01:00'))
    expect(s.cronOverdue).toBe(true)
    expect(s.lastSuccessAt).toBeNull()
  })

  // 기능을 막 넣었을 때 기록이 없다고 "늦었다" 고 하면 거짓 경보가 된다
  it('기록이 아예 없으면 늦었다고 단정하지 않는다', async () => {
    const s = await getSyncStatus(db, 'lotto', kst('2026-10-04T01:00'))
    expect(s.cronOverdue).toBe(false)
    expect(s.lastCronAt).toBeNull()
  })

  it('회차가 안 들어왔으면 behindSchedule 로 알린다', async () => {
    stored.mockResolvedValue([{ drwNo: 1243, drwNoDate: '2026-09-26' } as never])
    runs.mockResolvedValue([run('2026-10-03T22:10', 1)])
    const s = await getSyncStatus(db, 'lotto', kst('2026-10-04T01:00'))
    expect(s.behindSchedule).toBe(true)
    expect(s.cronOverdue).toBe(false)   // cron 은 돌았다 — 발표가 늦은 경우
  })

  it('마지막 추첨 시각을 함께 돌려준다', async () => {
    const s = await getSyncStatus(db, 'lotto', kst('2026-10-04T01:00'))
    expect(s.lastDrawAt).toBe('2026-10-03T11:35:00.000Z')
  })
})
