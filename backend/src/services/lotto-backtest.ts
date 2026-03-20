import { buildGeneratedSets, buildRuleWeights, countMatches, LOTTO_ALGORITHM_VERSION, SET_CONFIGS } from '../algorithms/lotto'
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
  }

  return {
    algorithm: LOTTO_ALGORITHM_VERSION,
    evaluatedDraws: targetDraws.length,
    setsPerDraw: SET_CONFIGS.length,
    totalGeneratedSets: totalSets,
    averageMatchPerSet: Number((totalMatches / totalSets).toFixed(3)),
    averageBestMatchPerDraw: Number((bestMatchSum / targetDraws.length).toFixed(3)),
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
      performance: Array.from(rulePerf.values()).map((entry) => ({
        ruleId: entry.ruleId,
        label: entry.label,
        generatedCount: entry.generatedCount,
        averageMatches: Number((entry.totalMatches / Math.max(entry.generatedCount, 1)).toFixed(3)),
        commonRulePassRate: Number((entry.commonRulePassCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
        relaxedFallbackRate: Number((entry.relaxedFallbackCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
        randomFallbackRate: Number((entry.randomFallbackCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
      })),
    },
  }
}

export async function runLottoBacktestFromDb(db: D1Database, lookback: number) {
  return runLottoBacktest(await getAllLottoBacktestRowsQuery(db), lookback)
}
