import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LOTTO_RANK_PROBABILITIES,
  lottoTicketPrice,
  prizeIfWon,
  simulateLottoHistory,
  type WhatIfDraw,
} from '../src/algorithms/lotto-what-if'
import { resetLottoWhatIfCache, simulateLottoPickFromDb } from '../src/services/lotto-what-if'
import * as queries from '../src/queries/lotto'

vi.mock('../src/queries/lotto', () => ({ getAllLottoWhatIfRowsQuery: vi.fn() }))
const allRows = vi.mocked(queries.getAllLottoWhatIfRowsQuery)

const draw = (drwNo: number, numbers: number[], bnusNo: number, extra: Partial<WhatIfDraw> = {}): WhatIfDraw => {
  const [drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6] = numbers
  return { drwNo, drwNoDate: '2026-01-03', drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo, ...extra }
}

// 운영 DB 의 실제 값 (2026-11-12 조회). 금액 규칙을 이 숫자들로 확인했다.
// 50회: 지급액 미수록. 1등 3명 × 5,227,061,400, 5등 664,631명, 판매액 655.6억.
const draw50: Partial<WhatIfDraw> = {
  firstWinamnt: 5_227_061_400, salesAmount: 65_563_234_000,
  rnk1WnNope: 3, rnk2WnNope: 22, rnk3WnNope: 1_000, rnk4WnNope: 50_000, rnk5WnNope: 664_631,
  rnk1SumWnAmt: 0, rnk2SumWnAmt: 0, rnk3SumWnAmt: 0, rnk4SumWnAmt: 0, rnk5SumWnAmt: 0,
}
// 300회: 지급액 수록. 4등이 아직 배분식이다 (33.4억 ÷ 70,193명 = 47,645원).
const draw300: Partial<WhatIfDraw> = {
  firstWinamnt: 836_092_425,
  rnk1WnNope: 12, rnk2WnNope: 34, rnk3WnNope: 1_416, rnk4WnNope: 70_193, rnk5WnNope: 1_102_135,
  rnk1SumWnAmt: 10_033_109_100, rnk2SumWnAmt: 1_672_184_850, rnk3SumWnAmt: 1_672_184_850,
  rnk4SumWnAmt: 3_344_369_700, rnk5SumWnAmt: 5_510_675_000,
}

describe('lottoTicketPrice', () => {
  it('87회까지 2,000원, 88회부터 1,000원', () => {
    expect(lottoTicketPrice(1)).toBe(2000)
    expect(lottoTicketPrice(87)).toBe(2000)
    expect(lottoTicketPrice(88)).toBe(1000)
    expect(lottoTicketPrice(1249)).toBe(1000)
  })
})

describe('LOTTO_RANK_PROBABILITIES', () => {
  // 동행복권이 공시하는 당첨 확률
  it('공시된 확률과 같다', () => {
    expect(1 / LOTTO_RANK_PROBABILITIES[1]).toBeCloseTo(8_145_060, 0)
    expect(1 / LOTTO_RANK_PROBABILITIES[2]).toBeCloseTo(1_357_510, 0)
    expect(1 / LOTTO_RANK_PROBABILITIES[3]).toBeCloseTo(35_724, 0)
    expect(1 / LOTTO_RANK_PROBABILITIES[4]).toBeCloseTo(733, 0)
    expect(1 / LOTTO_RANK_PROBABILITIES[5]).toBeCloseTo(45, 0)
  })
})

describe('prizeIfWon', () => {
  const d300 = draw(300, [1, 2, 3, 4, 5, 6], 7, draw300)
  const d50 = draw(50, [1, 2, 3, 4, 5, 6], 7, draw50)

  it('고정액 등위는 수록된 1인당 금액 그대로', () => {
    expect(prizeIfWon(d300, 5)).toEqual({ amount: 5_000, source: 'actual' })
    // 배분식이던 시절의 4등: 3,344,369,700 ÷ 70,193
    expect(prizeIfWon(d300, 4)).toEqual({ amount: 47_645, source: 'actual' })
  })

  // 내가 샀다면 당첨자가 한 명 늘어 같은 총액을 나눈다
  it('나눠 갖는 등위는 한 명 더 끼워 나눈다', () => {
    expect(prizeIfWon(d300, 1)).toEqual({ amount: Math.floor(10_033_109_100 / 13), source: 'actual' })
    expect(prizeIfWon(d300, 2)).toEqual({ amount: Math.floor(1_672_184_850 / 35), source: 'actual' })
    expect(prizeIfWon(d300, 3)).toEqual({ amount: Math.floor(1_672_184_850 / 1_417), source: 'actual' })
  })

  it('지급액이 없는 초기 회차의 5등은 그 시절 고정액', () => {
    expect(prizeIfWon(d50, 5)).toEqual({ amount: 10_000, source: 'actual' })
    expect(prizeIfWon(draw(88, [1, 2, 3, 4, 5, 6], 7, { ...draw50 }), 5)).toEqual({ amount: 5_000, source: 'actual' })
  })

  it('지급액이 없으면 1등은 수록된 1인당 당첨금에서 계산한다', () => {
    // 3명 × 5,227,061,400 을 4명이 나눈다
    expect(prizeIfWon(d50, 1)).toEqual({ amount: Math.floor(5_227_061_400 * 3 / 4), source: 'actual' })
  })

  // 판매액의 50% − 5등 총액 = 26,135,307,000. 1등 60% 가 수록값(3 × 5,227,061,400)과 정확히 맞는다.
  it('지급액이 없는 2~4등은 판매액에서 역산하고 추정이라고 표시한다', () => {
    const pool = 65_563_234_000 * 0.5 - 664_631 * 10_000
    expect(pool * 0.6).toBe(5_227_061_400 * 3)
    expect(prizeIfWon(d50, 2)).toEqual({ amount: Math.floor(pool * 0.1 / 23), source: 'estimated' })
    expect(prizeIfWon(d50, 3)).toEqual({ amount: Math.floor(pool * 0.1 / 1_001), source: 'estimated' })
    expect(prizeIfWon(d50, 4)).toEqual({ amount: Math.floor(pool * 0.2 / 50_000), source: 'estimated' })
  })

  it('1등 당첨자가 없던 회차면 혼자 받는 것으로 역산한다', () => {
    const rollover = draw(5, [1, 2, 3, 4, 5, 6], 7, { ...draw50, rnk1WnNope: 0, firstWinamnt: 0 })
    const pool = 65_563_234_000 * 0.5 - 664_631 * 10_000
    expect(prizeIfWon(rollover, 1)).toEqual({ amount: Math.floor(pool * 0.6), source: 'estimated' })
  })

  // 추첨 직후에는 등위별 집계가 통째로 비어 있다
  it('아무 금액 정보도 없으면 고정액 등위만 채우고 나머지는 모른다고 한다', () => {
    const bare = draw(1250, [1, 2, 3, 4, 5, 6], 7)
    expect(prizeIfWon(bare, 5)).toEqual({ amount: 5_000, source: 'actual' })
    expect(prizeIfWon(bare, 4)).toEqual({ amount: 50_000, source: 'estimated' })
    expect(prizeIfWon(bare, 3)).toEqual({ amount: 0, source: 'unknown' })
    expect(prizeIfWon(bare, 1)).toEqual({ amount: 0, source: 'unknown' })
  })
})

describe('simulateLottoHistory', () => {
  const mine = [1, 2, 3, 4, 5, 6]
  const draws = [
    draw(87, [10, 11, 12, 13, 14, 15], 16, draw50),          // 0개 — 낙첨, 2,000원
    draw(88, [1, 2, 3, 20, 21, 22], 23, draw50),             // 3개 — 5등 5,000원
    draw(300, [1, 2, 3, 4, 30, 31], 32, draw300),            // 4개 — 4등 47,645원
    draw(301, [1, 2, 3, 4, 5, 40], 6, draw300),              // 5개 + 보너스 — 2등
    draw(302, [1, 2, 7, 8, 9, 10], 3, draw300),              // 2개 (보너스 맞음) — 낙첨
  ]
  const result = simulateLottoHistory(mine, draws)

  it('회차마다 그 시절 가격으로 한 게임씩 산다', () => {
    expect(result.drawCount).toBe(5)
    expect(result.spent).toBe(2000 + 1000 * 4)
  })

  it('등위별 횟수를 센다', () => {
    expect(result.ranks.map((r) => r.count)).toEqual([0, 1, 0, 1, 1])
  })

  it('받은 돈은 회차별 당첨금의 합이다', () => {
    const second = Math.floor(1_672_184_850 / 35)
    expect(result.won).toBe(5_000 + 47_645 + second)
    expect(result.ranks.find((r) => r.rankNo === 2)?.won).toBe(second)
  })

  it('일치 개수별 회차 수를 낸다', () => {
    expect(result.matchCounts).toEqual([1, 0, 1, 1, 1, 1, 0])
    expect(result.matchCounts.reduce((a, b) => a + b)).toBe(result.drawCount)
  })

  it('큰 당첨부터 늘어놓는다', () => {
    expect(result.topWins.map((w) => [w.drawNo, w.rankNo])).toEqual([[301, 2], [300, 4], [88, 5]])
  })

  it('무작위 번호의 기대 횟수를 같이 낸다', () => {
    const fifth = result.ranks.find((r) => r.rankNo === 5)!
    expect(fifth.expected).toBeCloseTo(5 * 182_780 / 8_145_060, 10)
  })

  it('처음과 마지막 회차를 알려 준다', () => {
    expect([result.firstDrawNo, result.latestDrawNo]).toEqual([87, 302])
  })

  it('추정으로 계산한 당첨을 센다', () => {
    const early = simulateLottoHistory(mine, [draw(50, [1, 2, 3, 4, 30, 31], 32, draw50)])
    expect(early.estimatedWins).toBe(1)
    expect(early.topWins[0].source).toBe('estimated')
  })

  it('입력 순서와 무관하게 번호를 정렬해 돌려준다', () => {
    expect(simulateLottoHistory([6, 5, 4, 3, 2, 1], draws).numbers).toEqual(mine)
  })
})

describe('simulateLottoPickFromDb', () => {
  const db = {} as D1Database
  const rows = [draw(1, [1, 2, 3, 4, 5, 6], 7)]

  beforeEach(() => {
    resetLottoWhatIfCache()
    allRows.mockReset().mockResolvedValue(rows)
  })

  // 번호를 바꿔 가며 연달아 부르는 경로다. 매번 전 회차를 읽지 않는다.
  it('전 회차를 한 번 읽고 잠깐 들고 있는다', async () => {
    await simulateLottoPickFromDb(db, [1, 2, 3, 4, 5, 6], 0)
    await simulateLottoPickFromDb(db, [7, 8, 9, 10, 11, 12], 9 * 60_000)
    expect(allRows).toHaveBeenCalledOnce()

    await simulateLottoPickFromDb(db, [1, 2, 3, 4, 5, 6], 11 * 60_000)
    expect(allRows).toHaveBeenCalledTimes(2)
  })

  // 동기화 전의 빈 DB 가 10분 동안 굳으면 안 된다
  it('빈 결과는 들고 있지 않는다', async () => {
    allRows.mockResolvedValueOnce([])
    await expect(simulateLottoPickFromDb(db, [1, 2, 3, 4, 5, 6], 0)).rejects.toThrow('대입할 회차 데이터가 없습니다.')

    expect((await simulateLottoPickFromDb(db, [1, 2, 3, 4, 5, 6], 1000)).drawCount).toBe(1)
    expect(allRows).toHaveBeenCalledTimes(2)
  })
})
