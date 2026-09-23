import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/clients/lotto', () => ({
  getLatestDrawNo: vi.fn(),
  fetchLottoResult: vi.fn(),
}))
vi.mock('../src/queries/lotto', () => ({
  getLatestStoredLottoDrawNo: vi.fn(),
  insertLottoResult: vi.fn(),
}))

const { syncLatestLottoResults } = await import('../src/services/lotto-sync')
const clients = await import('../src/clients/lotto')
const queries = await import('../src/queries/lotto')

const db = {} as D1Database
const record = (drwNo: number) => ({
  drwNo, drwNoDate: '2026-09-19', drwtNo1: 1, drwtNo2: 2, drwtNo3: 3, drwtNo4: 4, drwtNo5: 5, drwtNo6: 6, bnusNo: 7, firstWinamnt: 0,
})

describe('syncLatestLottoResults', () => {
  beforeEach(() => {
    vi.mocked(clients.getLatestDrawNo).mockReset().mockResolvedValue(12)
    vi.mocked(queries.getLatestStoredLottoDrawNo).mockReset().mockResolvedValue(10)
    vi.mocked(queries.insertLottoResult).mockReset()
    vi.mocked(clients.fetchLottoResult).mockReset()
  })

  it('이미 최신이면 회차 결과를 요청하지 않는다', async () => {
    vi.mocked(queries.getLatestStoredLottoDrawNo).mockResolvedValue(12)
    await expect(syncLatestLottoResults(db)).resolves.toEqual({ syncedCount: 0, nextDrwNo: 13, latestDraw: 12 })
    expect(clients.fetchLottoResult).not.toHaveBeenCalled()
  })

  it('발표된 회차의 결과가 null 이면 error 로그를 남기고 멈춘다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(clients.fetchLottoResult).mockImplementation(async (drwNo) => drwNo === 11 ? record(11) : null)

    await expect(syncLatestLottoResults(db)).resolves.toEqual({ syncedCount: 1, nextDrwNo: 12, latestDraw: 12 })
    expect(queries.insertLottoResult).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('로또 12회는 발표됐지만(최신 12회)'))
    error.mockRestore()
  })
})
