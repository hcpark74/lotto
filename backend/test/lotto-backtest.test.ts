import { describe, expect, it } from 'vitest'
import { runLottoBacktest } from '../src/services/lotto-backtest'
import { buildPseudoDraws } from './helpers'

describe('runLottoBacktest', () => {
  it('데이터가 40회 미만이면 오류', () => {
    expect(() => runLottoBacktest(buildPseudoDraws(39), 20)).toThrow('백테스트에 필요한 데이터가 부족합니다.')
  })

  it('baseline 섹션이 이론값·대조군·유의성을 포함', () => {
    const summary = runLottoBacktest(buildPseudoDraws(80, 31), 30)

    expect(summary.evaluatedDraws).toBe(30)
    expect(summary.baseline.theoretical.expectedMatchPerSet).toBe(0.8)
    expect(summary.baseline.theoretical.matchStdPerSet).toBeCloseTo(0.784, 3)

    const expectedTotal = Object.values(summary.baseline.theoretical.expectedHitDistribution).reduce((a, b) => a + b, 0)
    expect(expectedTotal).toBeCloseTo(summary.totalGeneratedSets, 0)

    expect(summary.baseline.randomControl.totalSets).toBe(summary.totalGeneratedSets)
    const controlTotal = Object.values(summary.baseline.randomControl.hitDistribution).reduce((a, b) => a + b, 0)
    expect(controlTotal).toBe(summary.totalGeneratedSets)

    const [lo, hi] = summary.baseline.overall.ci95
    expect(lo).toBeLessThanOrEqual(summary.averageMatchPerSet)
    expect(hi).toBeGreaterThanOrEqual(summary.averageMatchPerSet)
    expect(summary.baseline.overall.significant).toBe(Math.abs(summary.baseline.overall.zScore) >= 1.96)
  })

  it('전략별 성과에 z-score와 CI가 붙는다', () => {
    const summary = runLottoBacktest(buildPseudoDraws(80, 31), 30)

    for (const entry of summary.ruleDiagnostics.performance) {
      expect(entry.generatedCount).toBe(30)
      expect(typeof entry.zScore).toBe('number')
      expect(entry.ci95[0]).toBeLessThanOrEqual(entry.averageMatches)
      expect(entry.ci95[1]).toBeGreaterThanOrEqual(entry.averageMatches)
    }

    const setTotal = summary.ruleDiagnostics.performance.reduce((a, b) => a + b.generatedCount, 0)
    expect(setTotal).toBe(summary.totalGeneratedSets)
  })
})
