import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/lotto', () => ({
  syncLatestLottoResults: vi.fn(),
}))
vi.mock('../src/services/pension', () => ({
  syncPensionResults: vi.fn(),
}))

const { default: worker } = await import('../src/index')
const { syncLatestLottoResults } = await import('../src/services/lotto')
const { syncPensionResults } = await import('../src/services/pension')

const lottoSync = vi.mocked(syncLatestLottoResults)
const pensionSync = vi.mocked(syncPensionResults)
const env = { DB: {} as D1Database }
const ctx = {} as ExecutionContext

function run(cron: string) {
  return worker.scheduled({ cron, scheduledTime: 0, type: 'scheduled', noRetry() {} } as ScheduledEvent, env, ctx)
}

describe('scheduled', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    lottoSync.mockReset().mockResolvedValue({ syncedCount: 1, nextDrwNo: 2, latestDraw: 1, debug: null })
    pensionSync.mockReset().mockResolvedValue({ syncedCount: 1, latestDraw: 1, nextDrawNo: 2, pendingPrizeDrawNos: [] })
  })

  it('로또 cron 은 로또만 동기화', async () => {
    await run('30 21 * * 6')
    expect(lottoSync).toHaveBeenCalledOnce()
    expect(pensionSync).not.toHaveBeenCalled()
  })

  it('연금 cron 은 연금만 동기화', async () => {
    await run('30 21 * * 4')
    expect(pensionSync).toHaveBeenCalledOnce()
    expect(lottoSync).not.toHaveBeenCalled()
  })

  it('알 수 없는 cron 이면 둘 다 실행하고, 한쪽이 실패해도 다른 쪽은 실행된 뒤 실패를 알린다', async () => {
    lottoSync.mockRejectedValue(new Error('boom'))

    await expect(run('* * * * *')).rejects.toThrow('Cron failed: lotto')
    expect(lottoSync).toHaveBeenCalledOnce()
    expect(pensionSync).toHaveBeenCalledOnce()
  })
})
