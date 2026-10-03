import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_PICKS_PER_CLIENT, MAX_PICKS_PER_REQUEST, savePicks } from '../src/services/saved-picks'
import * as queries from '../src/queries/saved-picks'

vi.mock('../src/queries/saved-picks', () => ({
  countSavedPicksByClientQuery: vi.fn(),
  insertSavedPicksQuery: vi.fn(async (_db: unknown, rows: unknown[]) => rows),
}))

const count = vi.mocked(queries.countSavedPicksByClientQuery)
const insert = vi.mocked(queries.insertSavedPicksQuery)
const db = {} as D1Database
const CLIENT = 'abcdefghijklmnop'

const entries = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ numbers: `1,2,3,4,5,${i + 6}`, label: `세트 ${i + 1}` }))

describe('savePicks', () => {
  beforeEach(() => {
    count.mockReset().mockResolvedValue(0)
    insert.mockClear()
  })

  it('세트 전체를 한 번의 batch 로 넣는다', async () => {
    const saved = await savePicks(db, CLIENT, 'lotto', 1244, entries(5))

    expect(saved).toHaveLength(5)
    // 요청 1번 — 낱개 저장처럼 5번 왕복하지 않는다
    expect(insert).toHaveBeenCalledOnce()
    expect(insert.mock.calls[0][1]).toHaveLength(5)
  })

  it('회차와 라벨을 그대로 담고 결과는 비워 둔다', async () => {
    const [first] = await savePicks(db, CLIENT, 'lotto', 1244, entries(2))

    expect(first.drawNo).toBe(1244)
    expect(first.label).toBe('세트 1')
    expect(first.result).toBeNull()
  })

  it('각 세트가 서로 다른 id 를 받는다', async () => {
    const saved = await savePicks(db, CLIENT, 'lotto', 1244, entries(5))
    expect(new Set(saved.map((p) => p.id)).size).toBe(5)
  })

  // 낱개 저장이면 한도 직전에서 일부만 들어가고 나머지가 실패한다.
  // 합쳐서 한 번 검사하므로 그런 중간 상태가 생기지 않는다.
  it('한도를 넘기면 하나도 넣지 않는다', async () => {
    count.mockResolvedValue(MAX_PICKS_PER_CLIENT - 3)

    await expect(savePicks(db, CLIENT, 'lotto', 1244, entries(5)))
      .rejects.toThrow(/최대 200개/)
    expect(insert).not.toHaveBeenCalled()
  })

  it('한도에 딱 맞으면 들어간다', async () => {
    count.mockResolvedValue(MAX_PICKS_PER_CLIENT - 5)

    const saved = await savePicks(db, CLIENT, 'lotto', 1244, entries(5))
    expect(saved).toHaveLength(5)
  })

  it('한 번에 보낼 수 있는 개수를 넘기면 거절한다', async () => {
    await expect(savePicks(db, CLIENT, 'lotto', 1244, entries(MAX_PICKS_PER_REQUEST + 1)))
      .rejects.toThrow(new RegExp(`한 번에 ${MAX_PICKS_PER_REQUEST}개까지`))
    expect(insert).not.toHaveBeenCalled()
  })

  it('빈 배열은 거절한다', async () => {
    await expect(savePicks(db, CLIENT, 'lotto', 1244, [])).rejects.toThrow(/저장할 번호가 없습니다/)
    expect(insert).not.toHaveBeenCalled()
  })
})
