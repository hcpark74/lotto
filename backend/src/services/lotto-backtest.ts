import { buildGeneratedSets, buildRuleWeights, countMatches, LOTTO_ALGORITHM_VERSION, SET_CONFIGS } from '../algorithms/lotto'
import {
  buildExpectedHitDistribution,
  buildRandomNumbers,
  LOTTO_EXPECTED_MATCHES,
  LOTTO_MATCH_PROBABILITIES,
  LOTTO_MATCH_STD,
  summarizeSignificance,
  summarizeSignificanceByDraw,
} from '../algorithms/lotto-baseline'
import { getAllLottoBacktestRowsQuery } from '../queries/lotto'
import type { DrawNumbersRow, LottoBacktestSummary } from '../types/lotto'

const MIN_BACKTEST_DRAWS = 40
const MIN_TRAINING_DRAWS = 30

export function runLottoBacktest(results: DrawNumbersRow[], lookback: number): LottoBacktestSummary {
  if (results.length < MIN_BACKTEST_DRAWS) {
    throw new Error('백테스트에 필요한 데이터가 부족합니다.')
  }

  const startIndex = Math.max(MIN_TRAINING_DRAWS, results.length - lookback)
  const targetDraws = results.slice(startIndex)

  let totalSets = 0
  let totalMatches = 0
  let bestMatchSum = 0
  let bonusHitCount = 0
  let commonRulePassCount = 0
  let relaxedFallbackCount = 0
  let randomFallbackCount = 0
  const hitDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<number, number>
  const bestHitDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<number, number>
  // 회차별 일치 수 합계. 같은 회차의 세트들은 상관되어 있어 유의성 계산은 이 단위로 한다.
  const drawTotals: number[] = []
  // 랜덤 대조군: 회차마다 전략과 같은 수의 순수 랜덤 세트를 뽑아 같은 target에 채점한다.
  let controlSets = 0
  const controlDrawTotals: number[] = []
  const controlHitDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<number, number>
  let threePlusCount = 0
  let fourPlusCount = 0
  let fivePlusCount = 0
  const rulePerf = new Map(SET_CONFIGS.map((config) => [config.id, {
    ruleId: config.id,
    label: config.label,
    generatedCount: 0,
    totalMatches: 0,
    commonRulePassCount: 0,
    relaxedFallbackCount: 0,
    randomFallbackCount: 0,
  }]))

  for (const target of targetDraws) {
    const sets = buildGeneratedSets(results.filter(row => (row.drwNo ?? 0) < (target.drwNo ?? 0)))
    const matchCounts = sets.map(set => countMatches(set.numbers, target))
    const bestMatch = Math.max(...matchCounts)

    for (let i = 0; i < sets.length; i++) {
      const matches = matchCounts[i]
      const meta = sets[i].meta
      const passedRules = meta?.passedRules ?? []
      const perf = meta?.ruleId ? rulePerf.get(meta.ruleId) : undefined

      totalSets += 1
      totalMatches += matches
      hitDistribution[matches] += 1

      if (perf) {
        perf.generatedCount += 1
        perf.totalMatches += matches
        if (passedRules.includes('common-rules')) perf.commonRulePassCount += 1
        if (passedRules.includes('fallback-set-rule-relaxed')) perf.relaxedFallbackCount += 1
        if (passedRules.includes('fallback-random')) perf.randomFallbackCount += 1
      }

      if (passedRules.includes('common-rules')) commonRulePassCount += 1
      if (passedRules.includes('fallback-set-rule-relaxed')) relaxedFallbackCount += 1
      if (passedRules.includes('fallback-random')) randomFallbackCount += 1
      if (matches >= 3) threePlusCount += 1
      if (matches >= 4) fourPlusCount += 1
      if (matches >= 5) fivePlusCount += 1
      if (matches === 5 && sets[i].numbers.includes(target.bnusNo ?? -1)) bonusHitCount += 1
    }

    bestMatchSum += bestMatch
    bestHitDistribution[bestMatch] += 1
    drawTotals.push(matchCounts.reduce((a, b) => a + b, 0))

    let controlDrawTotal = 0
    for (let i = 0; i < sets.length; i++) {
      const matches = countMatches(buildRandomNumbers(), target)
      controlSets += 1
      controlDrawTotal += matches
      controlHitDistribution[matches] += 1
    }
    controlDrawTotals.push(controlDrawTotal)
  }

  const overall = summarizeSignificanceByDraw(drawTotals, SET_CONFIGS.length)
  const control = summarizeSignificanceByDraw(controlDrawTotals, SET_CONFIGS.length)

  return {
    algorithm: LOTTO_ALGORITHM_VERSION,
    evaluatedDraws: targetDraws.length,
    setsPerDraw: SET_CONFIGS.length,
    totalGeneratedSets: totalSets,
    averageMatchPerSet: Number((totalMatches / totalSets).toFixed(3)),
    averageBestMatchPerDraw: Number((bestMatchSum / targetDraws.length).toFixed(3)),
    baseline: {
      theoretical: {
        expectedMatchPerSet: Number(LOTTO_EXPECTED_MATCHES.toFixed(3)),
        matchStdPerSet: Number(LOTTO_MATCH_STD.toFixed(3)),
        matchProbabilities: LOTTO_MATCH_PROBABILITIES,
        expectedHitDistribution: buildExpectedHitDistribution(totalSets),
      },
      randomControl: {
        totalSets: controlSets,
        averageMatchPerSet: control.mean,
        hitDistribution: controlHitDistribution,
        zScore: control.zScore,
        ci95: control.ci95,
      },
      overall: {
        zScore: overall.zScore,
        ci95: overall.ci95,
        // |z| ≥ 1.96 이면 5% 유의수준에서 랜덤과 다르다고 본다
        significant: Math.abs(overall.zScore) >= 1.96,
      },
    },
    generationQuality: {
      commonRulePassRate: Number((commonRulePassCount / totalSets * 100).toFixed(2)),
      relaxedFallbackRate: Number((relaxedFallbackCount / totalSets * 100).toFixed(2)),
      randomFallbackRate: Number((randomFallbackCount / totalSets * 100).toFixed(2)),
    },
    setHitRate: {
      match3Plus: Number((threePlusCount / totalSets * 100).toFixed(2)),
      match4Plus: Number((fourPlusCount / totalSets * 100).toFixed(2)),
      match5Plus: Number((fivePlusCount / totalSets * 100).toFixed(2)),
      match5PlusBonus: Number((bonusHitCount / totalSets * 100).toFixed(2)),
    },
    hitDistribution,
    bestHitDistribution,
    ruleDiagnostics: {
      currentWeights: buildRuleWeights(results.slice(0, startIndex)),
      performance: Array.from(rulePerf.values()).map((entry) => {
        const significance = summarizeSignificance(entry.totalMatches, entry.generatedCount)
        const denominator = Math.max(entry.generatedCount, 1)
        return {
          ruleId: entry.ruleId,
          label: entry.label,
          generatedCount: entry.generatedCount,
          averageMatches: significance.mean,
          zScore: significance.zScore,
          ci95: significance.ci95,
          commonRulePassRate: Number((entry.commonRulePassCount / denominator * 100).toFixed(2)),
          relaxedFallbackRate: Number((entry.relaxedFallbackCount / denominator * 100).toFixed(2)),
          randomFallbackRate: Number((entry.randomFallbackCount / denominator * 100).toFixed(2)),
        }
      }),
    },
  }
}

export async function runLottoBacktestFromDb(db: D1Database, lookback: number) {
  return runLottoBacktest(await getAllLottoBacktestRowsQuery(db), lookback)
}
