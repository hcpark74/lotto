import { describe, expect, it } from 'vitest'
import {
  buildRandomPensionNumber,
  countTrailingMatches,
  PENSION_NULL_MODEL,
  PENSION_TRAILING_MATCH_PROBABILITIES,
  trailingMatchesToRank,
} from '../src/algorithms/pension-baseline'
import { createSeededRandom } from '../src/utils/random'

describe('countTrailingMatches', () => {
  it.each([
    ['123456', '123456', 6],
    ['023456', '123456', 5],
    ['999456', '123456', 3],
    ['123450', '123456', 0],
    // 끝자리가 다르면 앞자리가 같아도 0 (자리별 일치 개수와 다른 점)
    ['123455', '123456', 0],
    ['12356', '012356', 6],
  ])('%s vs %s → %i', (picked, winning, expected) => {
    expect(countTrailingMatches(picked, winning)).toBe(expected)
  })
})

describe('무작위 기준선', () => {
  it('확률 합은 1, 각 확률은 규정 구조와 일치', () => {
    const total = Object.values(PENSION_TRAILING_MATCH_PROBABILITIES).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 12)
    expect(PENSION_TRAILING_MATCH_PROBABILITIES[0]).toBeCloseTo(0.9, 12)
    expect(PENSION_TRAILING_MATCH_PROBABILITIES[1]).toBeCloseTo(0.09, 12)
    expect(PENSION_TRAILING_MATCH_PROBABILITIES[5]).toBeCloseTo(0.000009, 15)
    expect(PENSION_TRAILING_MATCH_PROBABILITIES[6]).toBeCloseTo(0.000001, 15)
  })

  it('기대값 = Σ P(K ≥ k) = 0.111111, 분산 = Σ(2k−1)P(K ≥ k) − 기대값²', () => {
    const tail = [0.1, 0.01, 0.001, 0.0001, 0.00001, 0.000001]
    const expected = tail.reduce((a, b) => a + b, 0)
    const secondMoment = tail.reduce((acc, p, i) => acc + (2 * (i + 1) - 1) * p, 0)

    expect(PENSION_NULL_MODEL.expected).toBeCloseTo(0.111111, 12)
    expect(PENSION_NULL_MODEL.expected).toBeCloseTo(expected, 12)
    expect(PENSION_NULL_MODEL.std).toBeCloseTo(Math.sqrt(secondMoment - expected ** 2), 12)
    expect(PENSION_NULL_MODEL.std).toBeCloseTo(0.3514, 4)
  })

  it('무작위 번호의 평균 일치 수가 이론 기대값에 수렴', () => {
    const random = createSeededRandom(3)
    const n = 200_000
    let total = 0
    for (let i = 0; i < n; i++) total += countTrailingMatches(buildRandomPensionNumber(random), buildRandomPensionNumber(random))
    // 표준오차 0.3514/√n ≈ 0.0008 의 4배 이내
    expect(Math.abs(total / n - PENSION_NULL_MODEL.expected)).toBeLessThan(0.0032)
  })

  it('등위 환산: 6→2등, 1→7등, 0→낙첨', () => {
    expect(trailingMatchesToRank(6)).toBe(2)
    expect(trailingMatchesToRank(5)).toBe(3)
    expect(trailingMatchesToRank(1)).toBe(7)
    expect(trailingMatchesToRank(0)).toBeNull()
  })
})
