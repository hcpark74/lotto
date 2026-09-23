import { describe, expect, it } from 'vitest'
import { countTrailingMatches } from '../src/algorithms/pension-baseline'
import { runPensionBacktest } from '../src/services/pension-backtest'
import { createSeededRandom } from '../src/utils/random'

describe('runPensionBacktest', () => {
  it('규칙 가중치는 운영 추천처럼 최근 회차 기준으로 계산한다', () => {
    // 학습 구간 30회 중 가장 오래된 6회만 공통 규칙을 통과하지 못하는 번호
    const rows = Array.from({ length: 50 }, (_, i) => ({
      draw_no: i + 1,
      winning_number: i < 6 ? '000000' : '357246',
    }))

    const summary = runPensionBacktest(rows, 20)
    const balanced = summary.ruleDiagnostics.currentWeights.find((entry) => entry.ruleId === 'balanced-core')

    // 최근 24회(7~30회)는 모두 균형형을 통과한다. 오래된 24회를 쓰면 18/24 = 0.75 가 된다.
    expect(balanced?.passRate).toBe(1)
  })

  function pseudoRows(count: number, seed = 5) {
    const random = createSeededRandom(seed)
    const digits = () => Array.from({ length: 6 }, () => Math.floor(random() * 10)).join('')
    return Array.from({ length: count }, (_, i) => ({ draw_no: i + 1, winning_number: digits(), bonus_number: digits() }))
  }

  it('데이터가 30회 미만이면 오류', () => {
    expect(() => runPensionBacktest(pseudoRows(29), 20)).toThrow('연금복권 백테스트에 필요한 데이터가 부족합니다.')
  })

  it('기준선·분포·등위 환산이 서로 맞는다', () => {
    const summary = runPensionBacktest(pseudoRows(120), 80)
    const sum = (record: Record<number, number>) => Object.values(record).reduce((a, b) => a + b, 0)

    expect(summary.evaluatedDraws).toBe(80)
    expect(summary.setsPerDraw).toBe(4)
    expect(sum(summary.hitDistribution)).toBe(summary.totalGeneratedSets)
    expect(sum(summary.bestHitDistribution)).toBe(summary.evaluatedDraws)

    expect(summary.baseline.theoretical.expectedMatchPerSet).toBe(0.1111)
    expect(summary.baseline.theoretical.matchStdPerSet).toBe(0.3514)
    expect(sum(summary.baseline.theoretical.expectedHitDistribution)).toBeCloseTo(summary.totalGeneratedSets, 0)

    expect(summary.baseline.randomControl.totalSets).toBe(summary.totalGeneratedSets)
    expect(sum(summary.baseline.randomControl.hitDistribution)).toBe(summary.totalGeneratedSets)

    const [lo, hi] = summary.baseline.overall.ci95
    expect(lo).toBeLessThanOrEqual(summary.averageMatchPerSet)
    expect(hi).toBeGreaterThanOrEqual(summary.averageMatchPerSet)
    expect(summary.baseline.overall.significant).toBe(Math.abs(summary.baseline.overall.zScore) >= 1.96)

    // 등위 환산은 끝자리 연속 일치 수 분포와 같다 (k자리 → 8−k 등)
    for (let k = 1; k <= 6; k++) {
      expect(summary.rankHits[`rank${8 - k}` as 'rank2']).toBe(summary.hitDistribution[k])
    }

    for (const entry of summary.ruleDiagnostics.performance) {
      expect(entry.generatedCount).toBe(80)
      expect(entry.ci95[0]).toBeLessThanOrEqual(entry.averageMatches)
      expect(entry.ci95[1]).toBeGreaterThanOrEqual(entry.averageMatches)
    }
  })

  it('점수는 자리별 일치가 아니라 끝자리부터 연속 일치', () => {
    // 끝자리만 다르고 나머지 5자리가 모두 같아도 0점
    expect(countTrailingMatches('123455', '123456')).toBe(0)
  })
})

