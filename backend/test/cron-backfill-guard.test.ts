import { describe, expect, it, vi } from 'vitest'

// 백필은 보조 작업이다. 동행복권이 5xx 한 번 내면 동기화·채점이 이미 끝났는데도
// 실행 전체가 실패로 기록되고, 그게 쌓이면 화면에 "자동 갱신이 멈춰 있습니다" 가 뜬다.
vi.mock('../src/services/lotto', () => ({
  syncLatestLottoResults: vi.fn(async () => ({ syncedCount: 1, latestDraw: 1244, nextDrwNo: 1245 })),
  backfillLottoPrizeStats: vi.fn(async () => { throw new Error('로또 1200회 주변 조회 실패 (503)') }),
}))
vi.mock('../src/services/pension', () => ({ syncPensionResults: vi.fn(async () => ({ syncedCount: 0, latestDraw: 335, pendingPrizeDrawNos: [] })) }))
vi.mock('../src/services/saved-picks', () => ({ checkSavedPicks: vi.fn(async () => ({ checked: 3, won: 0 })) }))
vi.mock('../src/queries/cron-runs', () => ({ recordCronRunQuery: vi.fn(), pruneCronRunsQuery: vi.fn() }))

const worker = (await import('../src/index')).default
const { recordCronRunQuery } = await import('../src/queries/cron-runs')
const { backfillLottoPrizeStats } = await import('../src/services/lotto')
const record = vi.mocked(recordCronRunQuery)

describe('cron 의 백필 실패 처리', () => {
  it('백필이 실패해도 로또 실행은 성공으로 기록된다', async () => {
    const env = { DB: {} } as never
    await worker.scheduled({ cron: '10 12,13 * * SAT' } as never, env, {} as never)

    expect(vi.mocked(backfillLottoPrizeStats)).toHaveBeenCalled()

    const lotto = record.mock.calls.map(([, row]) => row).find((row) => row.lottery === 'lotto')
    expect(lotto).toBeDefined()
    expect(lotto!.ok).toBe(1)                      // 동기화·채점은 성공했다
    expect(lotto!.synced_count).toBe(1)
    expect(lotto!.detail).toContain('checked=3')
    expect(lotto!.detail).toMatch(/backfill=failed/)  // 실패 사실은 남긴다
  })
})
