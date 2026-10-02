import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/lotto', () => ({
  syncLatestLottoResults: vi.fn(),
}))
vi.mock('../src/services/saved-picks', () => ({
  checkSavedPicks: vi.fn(async () => ({ checked: 0, won: 0 })),
}))
vi.mock('../src/services/pension', () => ({
  syncPensionResults: vi.fn(),
}))

const { default: worker } = await import('../src/index')
const { syncLatestLottoResults } = await import('../src/services/lotto')
const { syncPensionResults } = await import('../src/services/pension')
const { checkSavedPicks } = await import('../src/services/saved-picks')

const lottoSync = vi.mocked(syncLatestLottoResults)
const pensionSync = vi.mocked(syncPensionResults)
const pickCheck = vi.mocked(checkSavedPicks)
const env = { DB: {} as D1Database }
const ctx = {} as ExecutionContext

function run(cron = '30 21 * * *') {
  return worker.scheduled({ cron, scheduledTime: 0, type: 'scheduled', noRetry() {} } as ScheduledEvent, env, ctx)
}

describe('scheduled', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    lottoSync.mockReset().mockResolvedValue({ syncedCount: 1, nextDrwNo: 2, latestDraw: 1 })
    pensionSync.mockReset().mockResolvedValue({ syncedCount: 1, latestDraw: 1, nextDrawNo: 2, pendingPrizeDrawNos: [] })
    pickCheck.mockReset().mockResolvedValue({ checked: 0, won: 0 })
  })

  it('매일 cron 은 로또·연금을 모두 동기화', async () => {
    await run()
    expect(lottoSync).toHaveBeenCalledOnce()
    expect(pensionSync).toHaveBeenCalledOnce()
  })

  // 동기화 직후 저장된 번호를 채점하는 것이 "동기화 시 당첨 체크"의 전부다.
  it('동기화 뒤 저장된 번호를 복권별로 채점한다', async () => {
    await run()
    expect(pickCheck).toHaveBeenCalledTimes(2)
    expect(pickCheck).toHaveBeenCalledWith(env.DB, 'lotto')
    expect(pickCheck).toHaveBeenCalledWith(env.DB, 'pension')
  })

  it('동기화가 실패하면 그 복권은 채점하지 않는다', async () => {
    lottoSync.mockRejectedValue(new Error('boom'))

    await expect(run()).rejects.toThrow('Cron failed: lotto')
    expect(pickCheck).toHaveBeenCalledTimes(1)
    expect(pickCheck).toHaveBeenCalledWith(env.DB, 'pension')
  })

  it('한쪽이 실패해도 다른 쪽은 실행된 뒤 실패를 알린다', async () => {
    lottoSync.mockRejectedValue(new Error('boom'))

    await expect(run()).rejects.toThrow('Cron failed: lotto')
    expect(pensionSync).toHaveBeenCalledOnce()
  })
})
