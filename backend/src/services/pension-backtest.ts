import {
  buildPensionRecommendations,
  buildPensionRuleWeights,
  PENSION_ALGORITHM_VERSION,
} from '../algorithms/pension'
import { getAllPensionBacktestRowsQuery } from '../queries/pension/results'
import type { PensionBacktestRow } from '../types/pension/models'
import type { PensionBacktestSummary } from '../types/pension/summaries'

const MIN_PENSION_BACKTEST_DRAWS = 30
const MIN_PENSION_TRAINING_DRAWS = 20

function countExactDigitMatches(picked: string, winning: string) {
  let matches = 0
  const left = picked.padStart(6, '0').slice(-6)
  const right = winning.padStart(6, '0').slice(-6)

  for (let index = 0; index < 6; index += 1) {
    if (left[index] === right[index]) matches += 1
  }

  return matches
}

export function runPensionBacktest(rows: PensionBacktestRow[], lookback: number): PensionBacktestSummary {
  if (rows.length < MIN_PENSION_BACKTEST_DRAWS) {
    throw new Error('연금복권 백테스트에 필요한 데이터가 부족합니다.')
  }

  const startIndex = Math.max(MIN_PENSION_TRAINING_DRAWS, rows.length - lookback)
  const targetRows = rows.slice(startIndex)

  let totalSets = 0
  let totalExactMatches = 0
  let bestExactMatchSum = 0
  const exactMatchDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<number, number>
  const bestExactMatchDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<number, number>
  const rulePerf = new Map<string, {
    ruleId: string
    label: string
    generatedCount: number
    totalExactMatches: number
    exactMatch3PlusCount: number
    exactMatch4PlusCount: number
  }>()

  for (const target of targetRows) {
    const historyNumbers = rows
      .filter((row) => row.draw_no < target.draw_no)
      .map((row) => row.winning_number)
    const sets = buildPensionRecommendations(historyNumbers)
    const matchCounts = sets.map((set) => countExactDigitMatches(set.number, target.winning_number))
    const bestMatch = Math.max(...matchCounts)

    for (let index = 0; index < sets.length; index += 1) {
      const set = sets[index]
      const matches = matchCounts[index]
      const ruleId = (set.meta as { ruleId?: string } | undefined)?.ruleId ?? 'unknown'
      const perf = rulePerf.get(ruleId) ?? {
        ruleId,
        label: set.label,
        generatedCount: 0,
        totalExactMatches: 0,
        exactMatch3PlusCount: 0,
        exactMatch4PlusCount: 0,
      }

      perf.generatedCount += 1
      perf.totalExactMatches += matches
      if (matches >= 3) perf.exactMatch3PlusCount += 1
      if (matches >= 4) perf.exactMatch4PlusCount += 1
      rulePerf.set(ruleId, perf)

      totalSets += 1
      totalExactMatches += matches
      exactMatchDistribution[matches] += 1
    }

    bestExactMatchSum += bestMatch
    bestExactMatchDistribution[bestMatch] += 1
  }

  return {
    algorithm: PENSION_ALGORITHM_VERSION,
    evaluatedDraws: targetRows.length,
    setsPerDraw: targetRows.length === 0 ? 0 : totalSets / targetRows.length,
    totalGeneratedSets: totalSets,
    averageExactMatchPerSet: Number((totalExactMatches / totalSets).toFixed(3)),
    averageBestExactMatchPerDraw: Number((bestExactMatchSum / targetRows.length).toFixed(3)),
    exactMatchDistribution,
    bestExactMatchDistribution,
    ruleDiagnostics: {
      currentWeights: buildPensionRuleWeights(rows.slice(0, startIndex).map((row) => row.winning_number)),
      performance: Array.from(rulePerf.values()).map((entry) => ({
        ruleId: entry.ruleId,
        label: entry.label,
        generatedCount: entry.generatedCount,
        averageExactMatches: Number((entry.totalExactMatches / Math.max(entry.generatedCount, 1)).toFixed(3)),
        exactMatch3PlusRate: Number((entry.exactMatch3PlusCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
        exactMatch4PlusRate: Number((entry.exactMatch4PlusCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
      })),
    },
  }
}

export async function runPensionBacktestFromDb(db: D1Database, lookback: number) {
  return runPensionBacktest(await getAllPensionBacktestRowsQuery(db), lookback)
}
