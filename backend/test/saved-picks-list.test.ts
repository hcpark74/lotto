import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getNextDraw, listSavedPicks } from '../src/services/saved-picks'
import * as pickQueries from '../src/queries/saved-picks'
import * as lottoQueries from '../src/queries/lotto'
import * as pensionQueries from '../src/queries/pension'
import type { SavedPickRow } from '../src/types/saved-picks'

vi.mock('../src/queries/saved-picks', () => ({ getSavedPicksByClientQuery: vi.fn() }))
vi.mock('../src/queries/lotto', () => ({
  getLottoResultByDrawNoQuery: vi.fn(),
  getLottoResultsByDrawNosQuery: vi.fn(),
  getRecentLottoResultsQuery: vi.fn(),
}))
vi.mock('../src/queries/pension', () => ({
  getPensionResultByDrawNoQuery: vi.fn(),
  getPensionResultsByDrawNosQuery: vi.fn(),
  getRecentPensionResultsQuery: vi.fn(),
}))

const rows = vi.mocked(pickQueries.getSavedPicksByClientQuery)
const lottoByNos = vi.mocked(lottoQueries.getLottoResultsByDrawNosQuery)
const lottoRecent = vi.mocked(lottoQueries.getRecentLottoResultsQuery)
const pensionByNos = vi.mocked(pensionQueries.getPensionResultsByDrawNosQuery)
const pensionRecent = vi.mocked(pensionQueries.getRecentPensionResultsQuery)

const db = {} as D1Database
const CLIENT = 'abcdefghijklmnop'

const row = (over: Partial<SavedPickRow>): SavedPickRow => ({
  id: 'x', client_id: CLIENT, lottery: 'lotto', draw_no: 1243, numbers: '1,2,3,4,5,6',
  label: null, saved_at: '2026-09-25T00:00:00.000Z',
  matched_count: null, bonus_matched: null, rank_no: null, checked_at: null, winning_band: null,
  ...over,
})

const graded = { matched_count: 3, bonus_matched: 0, rank_no: 5, checked_at: '2026-09-26T13:00:00.000Z' }

// 1243회 (2026-09-26) 까지 결과가 들어와 있다
const draw1243 = {
  drwNo: 1243, drwNoDate: '2026-09-26',
  drwtNo1: 1, drwtNo2: 2, drwtNo3: 3, drwtNo4: 10, drwtNo5: 20, drwtNo6: 30, bnusNo: 7,
} as Awaited<ReturnType<typeof lottoQueries.getRecentLottoResultsQuery>>[number]

describe('listSavedPicks', () => {
  beforeEach(() => {
    rows.mockReset()
    lottoByNos.mockReset().mockResolvedValue([draw1243])
    lottoRecent.mockReset().mockResolvedValue([draw1243])
    pensionByNos.mockReset()
    pensionRecent.mockReset()
  })

  it('채점된 저장분에 당첨번호와 실제 추첨일을 싣는다', async () => {
    rows.mockResolvedValue([row(graded)])

    const [pick] = await listSavedPicks(db, CLIENT, 'lotto')
    expect(pick.drawDate).toBe('2026-09-26')
    expect(pick.result?.winning).toEqual({ numbers: '1,2,3,10,20,30', bonus: '7' })
  })

  it('추첨 전 저장분에는 최신 회차에서 센 예정일을 싣는다', async () => {
    rows.mockResolvedValue([row({ id: 'a', draw_no: 1244 }), row({ id: 'b', draw_no: 1245 })])
    lottoByNos.mockResolvedValue([])

    const picks = await listSavedPicks(db, CLIENT, 'lotto')
    expect(picks.map((p) => p.drawDate)).toEqual(['2026-10-03', '2026-10-10'])
    expect(picks.every((p) => p.result === null)).toBe(true)
  })

  // 저장분이 5세트씩 같은 회차에 몰려 있다. 회차를 세트마다 묻지 않는다.
  it('회차는 중복 없이 한 번에 묻는다', async () => {
    rows.mockResolvedValue([row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c', draw_no: 1244 })])

    await listSavedPicks(db, CLIENT, 'lotto')
    expect(lottoByNos).toHaveBeenCalledOnce()
    expect(lottoByNos.mock.calls[0][1]).toEqual([1243, 1244])
  })

  it('저장분이 없으면 회차를 묻지 않는다', async () => {
    rows.mockResolvedValue([])

    expect(await listSavedPicks(db, CLIENT, 'lotto')).toEqual([])
    expect(lottoByNos).not.toHaveBeenCalled()
    expect(lottoRecent).not.toHaveBeenCalled()
  })

  // 곁들이는 정보 때문에 내 번호가 통째로 안 보이면 안 된다
  it('회차 정보를 못 읽어도 저장분은 돌려준다', async () => {
    rows.mockResolvedValue([row(graded)])
    lottoByNos.mockRejectedValue(new Error('D1_ERROR'))
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    const [pick] = await listSavedPicks(db, CLIENT, 'lotto')
    expect(pick.result?.matchedCount).toBe(3)
    expect(pick.result?.winning).toBeNull()
    expect(pick.drawDate).toBeNull()
    logged.mockRestore()
  })

  it('연금은 6자리와 보너스 6자리를 싣는다', async () => {
    const draw = {
      draw_no: 330, draw_date: '2026-09-24', winning_band: '4',
      winning_number: '956029', bonus_number: '022049', synced_at: '',
    } as Awaited<ReturnType<typeof pensionQueries.getRecentPensionResultsQuery>>[number]
    rows.mockResolvedValue([row({
      ...graded, lottery: 'pension', draw_no: 330, numbers: '111029', winning_band: '4',
    })])
    pensionByNos.mockResolvedValue([draw])
    pensionRecent.mockResolvedValue([draw])

    const [pick] = await listSavedPicks(db, CLIENT, 'pension')
    expect(pick.drawDate).toBe('2026-09-24')
    expect(pick.result?.winning).toEqual({ numbers: '956029', bonus: '022049' })
    expect(pick.result?.winningBand).toBe('4')
  })
})

describe('getNextDraw', () => {
  const kst = (s: string) => new Date(`${s}+09:00`)

  beforeEach(() => {
    lottoRecent.mockReset().mockResolvedValue([draw1243])
  })

  it('저장 대상 회차와 추첨일을 함께 돌려준다', async () => {
    expect(await getNextDraw(db, 'lotto', kst('2026-09-28T09:00'))).toMatchObject({ drawNo: 1244, drawDate: '2026-10-03' })
  })

  // 1244회 추첨은 10/3 20:35. 결과가 들어오기 전에 저장하면 1245회로 간다.
  it('방금 추첨한 회차로는 저장하지 않는다', async () => {
    expect(await getNextDraw(db, 'lotto', kst('2026-10-03T21:00'))).toMatchObject({ drawNo: 1245, drawDate: '2026-10-10' })
  })

  it('회차 데이터가 없으면 null', async () => {
    lottoRecent.mockResolvedValue([])
    expect(await getNextDraw(db, 'lotto')).toBeNull()
  })
})
