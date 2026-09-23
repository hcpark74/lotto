// 로또 6/45 추첨을 기준으로 한 이론 분포와 랜덤 대조군 유틸.
// 전략 성과를 해석하려면 "순수 랜덤이면 얼마가 나오는가"가 항상 옆에 있어야 한다.

import type { RandomSource } from '../utils/random'
import {
  buildExpectedDistribution,
  summarizeSignificance as summarizeSignificanceWith,
  summarizeSignificanceByDraw as summarizeSignificanceByDrawWith,
  type SignificanceSummary,
} from './significance'

export const LOTTO_POOL_SIZE = 45
export const LOTTO_PICK_COUNT = 6

export function combination(n: number, k: number) {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i
  }
  return Math.round(result)
}

// P(k개 일치) = C(6,k)·C(39,6−k) / C(45,6)
export function hypergeometricMatchProbability(k: number) {
  const total = combination(LOTTO_POOL_SIZE, LOTTO_PICK_COUNT)
  return combination(LOTTO_PICK_COUNT, k) * combination(LOTTO_POOL_SIZE - LOTTO_PICK_COUNT, LOTTO_PICK_COUNT - k) / total
}

export const LOTTO_MATCH_PROBABILITIES: Record<number, number> = Object.fromEntries(
  Array.from({ length: LOTTO_PICK_COUNT + 1 }, (_, k) => [k, hypergeometricMatchProbability(k)]),
)

// 기대값 n·K/N = 6·6/45 = 0.8
export const LOTTO_EXPECTED_MATCHES = LOTTO_PICK_COUNT * LOTTO_PICK_COUNT / LOTTO_POOL_SIZE

// 분산 n·(K/N)·(1−K/N)·(N−n)/(N−1)
export const LOTTO_MATCH_STD = Math.sqrt(
  LOTTO_PICK_COUNT
    * (LOTTO_PICK_COUNT / LOTTO_POOL_SIZE)
    * (1 - LOTTO_PICK_COUNT / LOTTO_POOL_SIZE)
    * (LOTTO_POOL_SIZE - LOTTO_PICK_COUNT) / (LOTTO_POOL_SIZE - 1),
)

export function buildRandomNumbers(random: RandomSource = Math.random) {
  const picked = new Set<number>()
  while (picked.size < LOTTO_PICK_COUNT) picked.add(Math.floor(random() * LOTTO_POOL_SIZE) + 1)
  return Array.from(picked).sort((a, b) => a - b)
}

export type { SignificanceSummary } from './significance'

const LOTTO_NULL_MODEL = { expected: LOTTO_EXPECTED_MATCHES, std: LOTTO_MATCH_STD }

// 귀무가설(순수 랜덤) 하에서 세트별 일치 수는 i.i.d. 초기하분포이므로
// 표본 평균의 표준오차는 0.784/√n 이다.
export function summarizeSignificance(totalMatches: number, sampleSize: number): SignificanceSummary {
  return summarizeSignificanceWith(totalMatches, sampleSize, LOTTO_NULL_MODEL)
}

// 회차별 합계의 경험 분산으로 계산한다 (algorithms/significance.ts 참고)
export function summarizeSignificanceByDraw(drawTotals: number[], setsPerDraw: number): SignificanceSummary {
  return summarizeSignificanceByDrawWith(drawTotals, setsPerDraw, LOTTO_NULL_MODEL)
}

export function buildExpectedHitDistribution(sampleSize: number) {
  return buildExpectedDistribution(LOTTO_MATCH_PROBABILITIES, sampleSize)
}
