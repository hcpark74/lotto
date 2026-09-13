import { describe, expect, it } from 'vitest'
import {
  buildExpectedHitDistribution,
  buildRandomNumbers,
  combination,
  LOTTO_EXPECTED_MATCHES,
  LOTTO_MATCH_PROBABILITIES,
  LOTTO_MATCH_STD,
  summarizeSignificance,
  summarizeSignificanceByDraw,
} from '../src/algorithms/lotto-baseline'

describe('combination', () => {
  it('C(45,6) = 8,145,060', () => {
    expect(combination(45, 6)).toBe(8_145_060)
  })

  it('경계값', () => {
    expect(combination(6, 0)).toBe(1)
    expect(combination(6, 6)).toBe(1)
    expect(combination(6, 7)).toBe(0)
  })
})

describe('초기하분포', () => {
  it('확률 합은 1', () => {
    const total = Object.values(LOTTO_MATCH_PROBABILITIES).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 12)
  })

  it('1등 확률은 1/8,145,060', () => {
    expect(LOTTO_MATCH_PROBABILITIES[6]).toBeCloseTo(1 / 8_145_060, 15)
  })

  it('3개 일치(5등) 확률은 182,780/8,145,060', () => {
    expect(LOTTO_MATCH_PROBABILITIES[3]).toBeCloseTo(182_780 / 8_145_060, 12)
  })

  it('기대 일치 수 0.8, 표준편차 ≈ 0.784', () => {
    expect(LOTTO_EXPECTED_MATCHES).toBeCloseTo(0.8, 12)
    const meanFromPmf = Object.entries(LOTTO_MATCH_PROBABILITIES).reduce((acc, [k, p]) => acc + Number(k) * p, 0)
    expect(meanFromPmf).toBeCloseTo(0.8, 12)
    const varianceFromPmf = Object.entries(LOTTO_MATCH_PROBABILITIES)
      .reduce((acc, [k, p]) => acc + (Number(k) - 0.8) ** 2 * p, 0)
    expect(LOTTO_MATCH_STD).toBeCloseTo(Math.sqrt(varianceFromPmf), 12)
    expect(LOTTO_MATCH_STD).toBeCloseTo(0.784, 3)
  })

  it('기대 분포는 표본 수에 비례', () => {
    const dist = buildExpectedHitDistribution(1000)
    const total = Object.values(dist).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1000, 0)
    // 최빈값은 1개 일치: P(0)≈0.4006, P(1)≈0.4241
    expect(dist[0]).toBeCloseTo(400.6, 0)
    expect(dist[1]).toBeCloseTo(424.1, 0)
  })
})

describe('buildRandomNumbers', () => {
  it('1~45 범위, 중복 없음, 오름차순 6개', () => {
    for (let i = 0; i < 200; i++) {
      const numbers = buildRandomNumbers()
      expect(numbers).toHaveLength(6)
      expect(new Set(numbers).size).toBe(6)
      expect(numbers.every(n => n >= 1 && n <= 45)).toBe(true)
      expect([...numbers].sort((a, b) => a - b)).toEqual(numbers)
    }
  })
})

describe('summarizeSignificance', () => {
  it('표본 0이면 z=0', () => {
    expect(summarizeSignificance(0, 0).zScore).toBe(0)
  })

  it('평균이 정확히 0.8이면 z=0이고 CI가 평균을 포함', () => {
    const result = summarizeSignificance(80, 100)
    expect(result.mean).toBe(0.8)
    expect(result.zScore).toBe(0)
    expect(result.ci95[0]).toBeLessThan(0.8)
    expect(result.ci95[1]).toBeGreaterThan(0.8)
  })

  it('z = (mean − 0.8) / (0.784/√n)', () => {
    const n = 400
    const result = summarizeSignificance(0.9 * n, n)
    expect(result.zScore).toBeCloseTo((0.9 - 0.8) / (LOTTO_MATCH_STD / Math.sqrt(n)), 1)
  })

  it('표본이 늘면 CI 폭이 줄어든다', () => {
    const small = summarizeSignificance(80, 100)
    const large = summarizeSignificance(800, 1000)
    expect(large.ci95[1] - large.ci95[0]).toBeLessThan(small.ci95[1] - small.ci95[0])
  })
})

describe('summarizeSignificanceByDraw', () => {
  it('회차 0이면 z=0', () => {
    expect(summarizeSignificanceByDraw([], 5).zScore).toBe(0)
  })

  it('평균은 총 일치 수 / (회차 × 세트 수)', () => {
    const result = summarizeSignificanceByDraw([4, 4, 4, 4], 5)
    expect(result.sampleSize).toBe(20)
    expect(result.mean).toBe(0.8)
    expect(result.zScore).toBe(0)
  })

  it('회차별 분산이 0이면 이론 분산(세트 독립)으로 대체', () => {
    // 모든 회차 합계가 5 → 평균 1.0, 세트 독립 가정 SE = 0.784/√20
    const result = summarizeSignificanceByDraw([5, 5, 5, 5], 5)
    expect(result.zScore).toBeCloseTo((1.0 - 0.8) / (LOTTO_MATCH_STD / Math.sqrt(20)), 1)
  })

  it('세트가 완전히 상관되면 z는 세트 수가 아니라 회차 수를 따른다', () => {
    // 각 회차의 5세트가 동일하다고 가정: 회차별 합계 = 5 × 세트 일치 수
    const perSet = [0, 1, 2, 1, 0, 1, 1, 2, 0, 1]
    const correlated = summarizeSignificanceByDraw(perSet.map(m => m * 5), 5)
    const single = summarizeSignificanceByDraw(perSet, 1)
    expect(correlated.mean).toBe(single.mean)
    expect(correlated.zScore).toBe(single.zScore)
    // 세트 수 n=50 으로 잘못 계산하면 z가 √5 배 부풀려진다
    const naive = summarizeSignificance(perSet.reduce((a, b) => a + b, 0) * 5, 50)
    expect(Math.abs(naive.zScore)).toBeGreaterThan(Math.abs(correlated.zScore))
  })
})
