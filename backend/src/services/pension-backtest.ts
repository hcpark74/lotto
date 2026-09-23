import {
  buildPensionRecommendations,
  buildPensionRuleWeights,
  PENSION_ALGORITHM_VERSION,
} from '../algorithms/pension'
import {
  buildRandomPensionNumber,
  countTrailingMatches,
  PENSION_DIGIT_COUNT,
  PENSION_NULL_MODEL,
  PENSION_TRAILING_MATCH_PROBABILITIES,
  trailingMatchesToRank,
} from '../algorithms/pension-baseline'
import {
  buildExpectedDistribution,
  summarizeSignificance,
  summarizeSignificanceByDraw,
} from '../algorithms/significance'
import { getAllPensionBacktestRowsQuery, getPensionDataVersionQuery } from '../queries/pension'
import type { PensionRankHits } from '../types/api'
import type { PensionBacktestRow } from '../types/pension/models'
import type { PensionBacktestSummary } from '../types/pension/summaries'
import { createSeededRandom, type RandomSource } from '../utils/random'
import { dataVersionOf, withBacktestCache } from './backtest-cache'

const MIN_PENSION_BACKTEST_DRAWS = 30
const MIN_PENSION_TRAINING_DRAWS = 20
// 같은 데이터면 같은 결과가 나오도록 백테스트는 기본으로 시드를 고정한다
export const PENSION_BACKTEST_SEED = 720
// 연금 평균 일치 수는 0.1 안팎이라 소수 넷째 자리까지 둔다
const DIGITS = 4

function emptyDistribution() {
  return Object.fromEntries(Array.from({ length: PENSION_DIGIT_COUNT + 1 }, (_, k) => [k, 0])) as Record<number, number>
}

function rate(count: number, total: number) {
  return Number((count / Math.max(total, 1) * 100).toFixed(2))
}

export function runPensionBacktest(
  rows: PensionBacktestRow[],
  lookback: number,
  random: RandomSource = createSeededRandom(PENSION_BACKTEST_SEED),
): PensionBacktestSummary {
  if (rows.length < MIN_PENSION_BACKTEST_DRAWS) {
    throw new Error('연금복권 백테스트에 필요한 데이터가 부족합니다.')
  }

  const sorted = rows.slice().sort((a, b) => a.draw_no - b.draw_no)
  const startIndex = Math.max(MIN_PENSION_TRAINING_DRAWS, sorted.length - lookback)
  const targetRows = sorted.slice(startIndex)
  // 알고리즘은 최신 회차가 앞에 오는 배열을 기대한다 (운영 조회가 draw_no DESC).
  // newestFirst.slice(n - i) = i 번째 회차 이전 전체를 최신순으로.
  const newestFirst = sorted.map((row) => row.winning_number).reverse()

  let totalSets = 0
  let totalMatches = 0
  let bestMatchSum = 0
  const hitDistribution = emptyDistribution()
  const bestHitDistribution = emptyDistribution()
  const rankHits: PensionRankHits = { rank2: 0, rank3: 0, rank4: 0, rank5: 0, rank6: 0, rank7: 0, bonus: 0 }
  // 회차별 점수 합계. 같은 회차의 세트들은 상관되어 있어 유의성 계산은 이 단위로 한다.
  const drawTotals: number[] = []
  // 랜덤 대조군: 회차마다 전략과 같은 수의 균등 무작위 번호를 같은 target 에 채점한다.
  let controlSets = 0
  const controlDrawTotals: number[] = []
  const controlHitDistribution = emptyDistribution()
  const rulePerf = new Map<string, {
    ruleId: string
    label: string
    generatedCount: number
    totalMatches: number
    match3PlusCount: number
    match4PlusCount: number
  }>()

  for (let targetIndex = startIndex; targetIndex < sorted.length; targetIndex++) {
    const target = sorted[targetIndex]
    const historyNumbers = newestFirst.slice(sorted.length - targetIndex)
    const sets = buildPensionRecommendations(historyNumbers, random)
    const matchCounts = sets.map((set) => countTrailingMatches(set.number, target.winning_number))

    for (let index = 0; index < sets.length; index += 1) {
      const set = sets[index]
      const matches = matchCounts[index]
      const ruleId = set.meta.ruleId ?? 'unknown'
      const perf = rulePerf.get(ruleId) ?? {
        ruleId,
        label: set.label,
        generatedCount: 0,
        totalMatches: 0,
        match3PlusCount: 0,
        match4PlusCount: 0,
      }

      perf.generatedCount += 1
      perf.totalMatches += matches
      if (matches >= 3) perf.match3PlusCount += 1
      if (matches >= 4) perf.match4PlusCount += 1
      rulePerf.set(ruleId, perf)

      totalSets += 1
      totalMatches += matches
      hitDistribution[matches] += 1

      const rank = trailingMatchesToRank(matches)
      if (rank !== null) rankHits[`rank${rank}` as keyof PensionRankHits] += 1
      if (target.bonus_number && countTrailingMatches(set.number, target.bonus_number) === PENSION_DIGIT_COUNT) {
        rankHits.bonus += 1
      }
    }

    const bestMatch = Math.max(...matchCounts)
    bestMatchSum += bestMatch
    bestHitDistribution[bestMatch] += 1
    drawTotals.push(matchCounts.reduce((a, b) => a + b, 0))

    let controlDrawTotal = 0
    for (let index = 0; index < sets.length; index += 1) {
      const matches = countTrailingMatches(buildRandomPensionNumber(random), target.winning_number)
      controlSets += 1
      controlDrawTotal += matches
      controlHitDistribution[matches] += 1
    }
    controlDrawTotals.push(controlDrawTotal)
  }

  // 세트 수는 규칙 수로 고정이지만, 혹시 달라져도 평균이 맞도록 실제 값으로 계산한다
  const setsPerDraw = totalSets / targetRows.length
  const overall = summarizeSignificanceByDraw(drawTotals, setsPerDraw, PENSION_NULL_MODEL, DIGITS)
  const control = summarizeSignificanceByDraw(controlDrawTotals, setsPerDraw, PENSION_NULL_MODEL, DIGITS)

  return {
    algorithm: PENSION_ALGORITHM_VERSION,
    evaluatedDraws: targetRows.length,
    setsPerDraw,
    totalGeneratedSets: totalSets,
    averageMatchPerSet: Number((totalMatches / totalSets).toFixed(DIGITS)),
    averageBestMatchPerDraw: Number((bestMatchSum / targetRows.length).toFixed(DIGITS)),
    baseline: {
      theoretical: {
        expectedMatchPerSet: Number(PENSION_NULL_MODEL.expected.toFixed(DIGITS)),
        matchStdPerSet: Number(PENSION_NULL_MODEL.std.toFixed(DIGITS)),
        matchProbabilities: PENSION_TRAILING_MATCH_PROBABILITIES,
        expectedHitDistribution: buildExpectedDistribution(PENSION_TRAILING_MATCH_PROBABILITIES, totalSets),
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
    hitDistribution,
    bestHitDistribution,
    rankHits,
    ruleDiagnostics: {
      // 현재 우선순위: /pension/generate 와 같은 입력(최신순 전체 회차)으로 계산한다. 백테스트 창 이전이 아니다.
      currentWeights: buildPensionRuleWeights(newestFirst),
      performance: Array.from(rulePerf.values()).map((entry) => {
        // 규칙당 회차마다 1세트라 세트 간 독립으로 본다
        const significance = summarizeSignificance(entry.totalMatches, entry.generatedCount, PENSION_NULL_MODEL, DIGITS)
        return {
          ruleId: entry.ruleId,
          label: entry.label,
          generatedCount: entry.generatedCount,
          averageMatches: significance.mean,
          zScore: significance.zScore,
          ci95: significance.ci95,
          match3PlusRate: rate(entry.match3PlusCount, entry.generatedCount),
          match4PlusRate: rate(entry.match4PlusCount, entry.generatedCount),
        }
      }),
    },
  }
}

export async function runPensionBacktestFromDb(db: D1Database, lookback: number) {
  return withBacktestCache(
    db,
    { kind: 'pension', algorithm: PENSION_ALGORITHM_VERSION, lookback },
    () => getPensionDataVersionQuery(db),
    async () => {
      const rows = await getAllPensionBacktestRowsQuery(db)
      return { result: runPensionBacktest(rows, lookback), dataVersion: dataVersionOf(rows, (row) => row.draw_no) }
    },
  )
}
