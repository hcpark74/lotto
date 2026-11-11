// "이 번호를 역대 회차에 전부 샀다면" 을 계산한다.
// 재미로 돌려 보는 기능이지만 쓴 돈·받은 돈을 말하므로 금액은 지어내지 않는다 —
// 실제 지급액이 있으면 그것을, 없으면 그 회차 판매액에서 규칙대로 역산하고 추정이라고 표시한다.

import { combination, LOTTO_PICK_COUNT, LOTTO_POOL_SIZE } from './lotto-baseline'
import { gradeLottoPick } from './saved-picks'

// 1게임 가격. 87회(2004-07-31)까지 2,000원, 88회(2004-08-07)부터 1,000원.
// 판매액으로 확인했다: 87회 837.9억 → 88회 519.1억, 5등 당첨자 수는 89만 → 110만.
export const LOTTO_PRICE_CHANGE_DRAW = 88
export function lottoTicketPrice(drawNo: number) {
  return drawNo < LOTTO_PRICE_CHANGE_DRAW ? 2000 : 1000
}

// 5등은 고정액이다. 2,000원 시절에는 10,000원, 그 뒤로 5,000원.
// 50회로 확인: (1등 총액 ÷ 0.6) + 5등 664,631명 × 10,000 = 판매액의 정확히 50%.
function fixedFifthPrize(drawNo: number) {
  return drawNo < LOTTO_PRICE_CHANGE_DRAW ? 10_000 : 5_000
}

// 지급액이 수록되지 않은 초기 회차(대략 300회 이전)의 배분 규칙.
// 판매액의 50% 에서 5등 총액을 뺀 나머지를 1등 60% · 2등 10% · 3등 10% · 4등 20% 로 나눈다.
// 300회의 수록값이 이 비율과 정확히 맞는다 (1등 100.3억 = 2등 16.7억 × 6, 4등 33.4억 = 2등 × 2).
const PRIZE_POOL_RATE = 0.5
const POOL_SHARES: Record<number, number> = { 1: 0.6, 2: 0.1, 3: 0.1, 4: 0.2 }
// 당첨금을 당첨자끼리 나누는 등위. 내가 샀다면 한 명이 더 나눠 가진다.
// (4등은 초기에 배분식이었지만 당첨자가 수만 명이라 한 명이 늘어도 차이가 없다.)
const SHARED_RANKS = new Set([1, 2, 3])
// 지급액도 판매액도 없을 때의 4등. 지금은 50,000원 고정이다
// (수록값으로 보면 400회(2010-07)는 배분식 60,191원, 500회(2012-06)는 50,000원).
const FALLBACK_FOURTH_PRIZE = 50_000

export const LOTTO_RANKS = [1, 2, 3, 4, 5] as const
export type LottoRank = (typeof LOTTO_RANKS)[number]

// 무작위 한 게임이 각 등위에 들 확률
const TOTAL_COMBINATIONS = combination(LOTTO_POOL_SIZE, LOTTO_PICK_COUNT)
const OTHERS = LOTTO_POOL_SIZE - LOTTO_PICK_COUNT
export const LOTTO_RANK_PROBABILITIES: Record<LottoRank, number> = {
  1: 1 / TOTAL_COMBINATIONS,
  // 5개 + 보너스: 빠진 한 자리가 보너스 번호
  2: combination(LOTTO_PICK_COUNT, 5) / TOTAL_COMBINATIONS,
  // 5개: 빠진 한 자리가 당첨번호도 보너스도 아닌 38개 중 하나
  3: combination(LOTTO_PICK_COUNT, 5) * (OTHERS - 1) / TOTAL_COMBINATIONS,
  4: combination(LOTTO_PICK_COUNT, 4) * combination(OTHERS, 2) / TOTAL_COMBINATIONS,
  5: combination(LOTTO_PICK_COUNT, 3) * combination(OTHERS, 3) / TOTAL_COMBINATIONS,
}

// lotto_history 한 행에서 계산에 쓰는 열. 등위별 열은 집계 전이거나 옛 DB 면 없다.
export type WhatIfDraw = {
  drwNo: number
  drwNoDate?: string | null
  drwtNo1: number
  drwtNo2: number
  drwtNo3: number
  drwtNo4: number
  drwtNo5: number
  drwtNo6: number
  bnusNo: number
  firstWinamnt?: number | null
  rnk1WnNope?: number | null
  rnk2WnNope?: number | null
  rnk3WnNope?: number | null
  rnk4WnNope?: number | null
  rnk5WnNope?: number | null
  rnk1SumWnAmt?: number | null
  rnk2SumWnAmt?: number | null
  rnk3SumWnAmt?: number | null
  rnk4SumWnAmt?: number | null
  rnk5SumWnAmt?: number | null
  salesAmount?: number | null
}

// actual: 수록된 지급액 / estimated: 판매액에서 역산 / unknown: 알 길이 없어 0원
export type PrizeSource = 'actual' | 'estimated' | 'unknown'

const positive = (value: number | null | undefined) => (typeof value === 'number' && value > 0 ? value : null)

// 그 회차에 이 등위로 당첨됐다면 받았을 금액 (세전)
export function prizeIfWon(draw: WhatIfDraw, rank: LottoRank): { amount: number; source: PrizeSource } {
  const winners = positive(draw[`rnk${rank}WnNope`]) ?? 0
  // 나눠 갖는 등위는 내가 한 명 더 낀다. 당첨자가 없던 회차면 혼자 받는다.
  const split = SHARED_RANKS.has(rank) ? winners + 1 : Math.max(winners, 1)

  const paid = positive(draw[`rnk${rank}SumWnAmt`])
  if (paid != null) return { amount: Math.floor(paid / split), source: 'actual' }

  if (rank === 5) return { amount: fixedFifthPrize(draw.drwNo), source: 'actual' }

  // 1등은 1인당 당첨금이 따로 수록돼 있다
  const firstPrize = positive(draw.firstWinamnt)
  if (rank === 1 && firstPrize != null && winners > 0) {
    return { amount: Math.floor(firstPrize * winners / split), source: 'actual' }
  }

  const sales = positive(draw.salesAmount)
  if (sales != null) {
    const fifthTotal = fixedFifthPrize(draw.drwNo) * (positive(draw.rnk5WnNope) ?? 0)
    const pool = Math.max(0, sales * PRIZE_POOL_RATE - fifthTotal) * POOL_SHARES[rank]
    return { amount: Math.floor(pool / split), source: 'estimated' }
  }

  if (rank === 4) return { amount: FALLBACK_FOURTH_PRIZE, source: 'estimated' }
  return { amount: 0, source: 'unknown' }
}

export type WhatIfWin = {
  drawNo: number
  drawDate: string | null
  rankNo: LottoRank
  matchedCount: number
  prize: number
  source: PrizeSource
}

export type LottoWhatIfResult = {
  numbers: number[]
  drawCount: number
  firstDrawNo: number | null
  firstDrawDate: string | null
  latestDrawNo: number | null
  latestDrawDate: string | null
  // 매 회차 1게임씩 산 값 (87회까지 2,000원, 이후 1,000원)
  spent: number
  // 세전 당첨금 합계
  won: number
  // 등위별 당첨 횟수와, 무작위 번호였다면 기대되는 횟수
  ranks: { rankNo: LottoRank; count: number; expected: number; won: number }[]
  // 일치 개수(0~6)별 회차 수
  matchCounts: number[]
  // 당첨금을 판매액에서 역산한 당첨 건수, 알 수 없어 0원으로 센 건수
  estimatedWins: number
  unknownWins: number
  // 당첨금이 큰 순으로 몇 건
  topWins: WhatIfWin[]
}

const TOP_WIN_LIMIT = 5

export function simulateLottoHistory(numbers: number[], draws: WhatIfDraw[]): LottoWhatIfResult {
  const counts: Record<LottoRank, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const wonByRank: Record<LottoRank, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const matchCounts = Array.from({ length: LOTTO_PICK_COUNT + 1 }, () => 0)
  const wins: WhatIfWin[] = []
  let spent = 0
  let estimatedWins = 0
  let unknownWins = 0

  for (const draw of draws) {
    spent += lottoTicketPrice(draw.drwNo)

    const winning = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6]
    const grade = gradeLottoPick(numbers, winning, draw.bnusNo)
    matchCounts[grade.matchedCount] += 1
    if (grade.rankNo == null) continue

    const rankNo = grade.rankNo as LottoRank
    const prize = prizeIfWon(draw, rankNo)
    counts[rankNo] += 1
    wonByRank[rankNo] += prize.amount
    if (prize.source === 'estimated') estimatedWins += 1
    if (prize.source === 'unknown') unknownWins += 1

    wins.push({
      drawNo: draw.drwNo,
      drawDate: draw.drwNoDate ?? null,
      rankNo,
      matchedCount: grade.matchedCount,
      prize: prize.amount,
      source: prize.source,
    })
  }

  const first = draws[0]
  const latest = draws[draws.length - 1]

  return {
    numbers: numbers.slice().sort((a, b) => a - b),
    drawCount: draws.length,
    firstDrawNo: first?.drwNo ?? null,
    firstDrawDate: first?.drwNoDate ?? null,
    latestDrawNo: latest?.drwNo ?? null,
    latestDrawDate: latest?.drwNoDate ?? null,
    spent,
    won: LOTTO_RANKS.reduce((total, rank) => total + wonByRank[rank], 0),
    ranks: LOTTO_RANKS.map((rankNo) => ({
      rankNo,
      count: counts[rankNo],
      expected: LOTTO_RANK_PROBABILITIES[rankNo] * draws.length,
      won: wonByRank[rankNo],
    })),
    matchCounts,
    estimatedWins,
    unknownWins,
    // 큰 당첨부터. 금액이 같으면 최근 회차부터.
    topWins: wins.sort((a, b) => b.prize - a.prize || b.drawNo - a.drawNo).slice(0, TOP_WIN_LIMIT),
  }
}
