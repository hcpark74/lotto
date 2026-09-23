import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/clients/pension', () => ({
  fetchPensionDrawList: vi.fn(),
  fetchPensionPrizeCounts: vi.fn(),
  findLatestPensionDrawNo: vi.fn(() => 3),
}))
vi.mock('../src/queries/pension', () => ({
  clearPensionPrizeSyncAttempts: vi.fn(),
  ensurePensionPrizeSyncAttemptsTable: vi.fn(),
  getPensionDrawNosWithIncompletePrizeCounts: vi.fn(),
  getStoredPensionDrawNos: vi.fn(),
  recordPensionPrizeSyncFailure: vi.fn(async () => 1),
  upsertPensionDraw: vi.fn(),
  upsertPensionPrizeCount: vi.fn(),
}))

const { countDistinctPrizeRanks, syncPensionResults } = await import('../src/services/pension-sync')
const clients = await import('../src/clients/pension')
const queries = await import('../src/queries/pension')

const db = {} as D1Database
const prizeRows = (drawNo: number, ranks: number[]) => ranks.map((rank) => ({ ltEpsd: drawNo, wnRnk: rank, wnTotalCnt: 1 }))
const listItem = (drawNo: number) => ({ psltEpsd: drawNo, psltRflYmd: '20260917', wnBndNo: '1', wnRnkVl: '123456', bnsRnkVl: '654321' })

describe('countDistinctPrizeRanks', () => {
  const record = (rank_no: number) => ({ draw_no: 1, rank_no, internet_count: 0, store_count: 0, total_count: 0, win_amount: null, total_amount: null })

  it('서로 다른 1~8 등위만 센다', () => {
    expect(countDistinctPrizeRanks([1, 2, 3, 4, 5, 6, 7, 8].map(record))).toBe(8)
    expect(countDistinctPrizeRanks([1, 2, 3, 4, 5, 6, 7, 7].map(record))).toBe(7)
    expect(countDistinctPrizeRanks([1, 2, 3, 4, 5, 6, 7, 99].map(record))).toBe(7)
  })
})

describe('syncPensionResults 당첨 통계 완결 판정', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const fn of Object.values(queries)) vi.mocked(fn as () => unknown).mockClear()
    vi.mocked(queries.recordPensionPrizeSyncFailure).mockResolvedValue(1)
    vi.mocked(clients.fetchPensionDrawList).mockResolvedValue([listItem(1), listItem(2), listItem(3)])
    vi.mocked(queries.getStoredPensionDrawNos).mockResolvedValue([1])
    vi.mocked(queries.getPensionDrawNosWithIncompletePrizeCounts).mockResolvedValue([1])
  })

  it('중복·누락 등위는 불완전, 1~8 이 모두 있으면 완결', async () => {
    vi.mocked(clients.fetchPensionPrizeCounts).mockImplementation(async (drawNo) => {
      if (drawNo === 1) return prizeRows(1, [1, 2, 3, 4, 5, 6, 7, 7]) // 8행이지만 7개 등위
      if (drawNo === 2) return prizeRows(2, [1, 2, 3, 4, 5, 6, 7, 8])
      throw new Error('503')
    })

    const summary = await syncPensionResults(db)

    expect(queries.ensurePensionPrizeSyncAttemptsTable).toHaveBeenCalledOnce()
    expect(summary.pendingPrizeDrawNos).toEqual([1, 3])
    expect(vi.mocked(queries.recordPensionPrizeSyncFailure).mock.calls.map(([, d]) => d)).toEqual([1, 3])
    expect(vi.mocked(queries.clearPensionPrizeSyncAttempts).mock.calls.map(([, d]) => d)).toEqual([2])
    expect(summary).toMatchObject({ syncedCount: 2, latestDraw: 3, nextDrawNo: 4 })
  })

  it('시도 한도에 닿으면 error 로그를 남긴다', async () => {
    vi.mocked(clients.fetchPensionDrawList).mockResolvedValue([listItem(1)])
    vi.mocked(clients.fetchPensionPrizeCounts).mockResolvedValue(prizeRows(1, [1, 2]))
    vi.mocked(queries.recordPensionPrizeSyncFailure).mockResolvedValue(14)

    await syncPensionResults(db)

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('연금복권 1회 당첨 통계가 14번 시도에도 불완전해 재시도를 멈춥니다.'))
  })
})
