import { buildGeneratedSets, buildRuleWeights, countMatches, LOTTO_ALGORITHM_VERSION, SET_CONFIGS } from '../algorithms/lotto'
import {
  buildExpectedHitDistribution,
  buildRandomNumbers,
  buildShuffledPool,
  LOTTO_PICK_COUNT,
  LOTTO_EXPECTED_MATCHES,
  LOTTO_MATCH_PROBABILITIES,
  LOTTO_MATCH_STD,
  summarizeSignificance,
  summarizeSignificanceByDraw,
} from '../algorithms/lotto-baseline'
import { getAllLottoBacktestRowsQuery, getLottoDataVersionQuery } from '../queries/lotto'
import { dataVersionOf, withBacktestCache } from './backtest-cache'
import type { DrawNumbersRow, LottoBacktestSummary } from '../types/lotto'
import { createSeededRandom, type RandomSource } from '../utils/random'

// 대조군의 최고 일치·커버리지는 회차당 1벌만 뽑으면 표준오차가 0.04 라 화면에 쓸 수 없다.
// 회차마다 여러 벌을 뽑아 평균 낸다 (z 계산에는 1벌만 쓴다 — 전략과 같은 조건이어야 하므로).
const BASELINE_REPEATS = 8
const MIN_BACKTEST_DRAWS = 40
const MIN_TRAINING_DRAWS = 30
// 같은 데이터면 같은 결과가 나오도록 백테스트는 기본으로 시드를 고정한다
export const LOTTO_BACKTEST_SEED = 645

export function runLottoBacktest(
  results: DrawNumbersRow[],
  lookback: number,
  random: RandomSource = createSeededRandom(LOTTO_BACKTEST_SEED),
  // 대조군은 난수 스트림을 분리한다. 같은 스트림을 쓰면 대조군 표본 수를 바꾸는 것만으로
  // 전략이 받는 난수열이 밀려 전략 성과까지 달라진다.
  controlRandom: RandomSource = createSeededRandom(LOTTO_BACKTEST_SEED + 1),
): LottoBacktestSummary {
  if (results.length < MIN_BACKTEST_DRAWS) {
    throw new Error('백테스트에 필요한 데이터가 부족합니다.')
  }

  // 회차 오름차순을 전제로 대상 회차 이전 데이터를 slice 로 자른다
  const sorted = results.slice().sort((a, b) => (a.drwNo ?? 0) - (b.drwNo ?? 0))
  const startIndex = Math.max(MIN_TRAINING_DRAWS, sorted.length - lookback)
  const targetDraws = sorted.slice(startIndex)

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
  let controlBestSum = 0
  let controlBest3Count = 0
  let controlDistinctSum = 0
  // 겹치지 않는 5세트 대조군: 1~45 를 섞어 6개씩 잘라 쓴다. 커버리지 상한(30/30)의 성과.
  let disjointBestSum = 0
  let disjointBest3Count = 0
  // 전략 5세트가 실제로 덮는 서로 다른 번호 수
  let distinctSum = 0
  let best3Count = 0
  let best4Count = 0
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

  for (let targetIndex = startIndex; targetIndex < sorted.length; targetIndex++) {
    const target = sorted[targetIndex]
    const sets = buildGeneratedSets(sorted.slice(0, targetIndex), random)
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
    if (bestMatch >= 3) best3Count += 1
    if (bestMatch >= 4) best4Count += 1

    const usedNumbers = new Set<number>()
    for (const set of sets) for (const num of set.numbers) usedNumbers.add(num)
    distinctSum += usedNumbers.size

    for (let repeat = 0; repeat < BASELINE_REPEATS; repeat++) {
      let controlDrawTotal = 0
      let controlBest = 0
      const controlUsed = new Set<number>()
      for (let i = 0; i < sets.length; i++) {
        const numbers = buildRandomNumbers(controlRandom)
        const matches = countMatches(numbers, target)
        controlDrawTotal += matches
        if (matches > controlBest) controlBest = matches
        for (const num of numbers) controlUsed.add(num)
        // z·분포는 전략과 같은 조건(회차당 5세트 1벌)이어야 하므로 첫 벌만 센다
        if (repeat === 0) {
          controlSets += 1
          controlHitDistribution[matches] += 1
        }
      }
      if (repeat === 0) controlDrawTotals.push(controlDrawTotal)
      controlBestSum += controlBest
      controlDistinctSum += controlUsed.size
      if (controlBest >= 3) controlBest3Count += 1

      const shuffled = buildShuffledPool(controlRandom)
      let disjointBest = 0
      for (let i = 0; i < sets.length; i++) {
        const matches = countMatches(shuffled.slice(i * LOTTO_PICK_COUNT, (i + 1) * LOTTO_PICK_COUNT), target)
        if (matches > disjointBest) disjointBest = matches
      }
      disjointBestSum += disjointBest
      if (disjointBest >= 3) disjointBest3Count += 1
    }
  }

  const drawCount = targetDraws.length
  const baselineCount = drawCount * BASELINE_REPEATS
  const pct = (count: number) => Number((count / drawCount * 100).toFixed(2))
  const per = (sum: number) => Number((sum / drawCount).toFixed(3))
  const baselinePct = (count: number) => Number((count / baselineCount * 100).toFixed(2))
  const baselinePer = (sum: number) => Number((sum / baselineCount).toFixed(3))
  const overall = summarizeSignificanceByDraw(drawTotals, SET_CONFIGS.length)
  const control = summarizeSignificanceByDraw(controlDrawTotals, SET_CONFIGS.length)

  return {
    algorithm: LOTTO_ALGORITHM_VERSION,
    evaluatedDraws: targetDraws.length,
    setsPerDraw: SET_CONFIGS.length,
    totalGeneratedSets: totalSets,
    averageMatchPerSet: Number((totalMatches / totalSets).toFixed(3)),
    averageBestMatchPerDraw: per(bestMatchSum),
    coverage: {
      averageDistinctNumbers: Number((distinctSum / drawCount).toFixed(2)),
      maxDistinctNumbers: SET_CONFIGS.length * LOTTO_PICK_COUNT,
    },
    drawHitRate: {
      best3Plus: pct(best3Count),
      best4Plus: pct(best4Count),
    },
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
        averageBestMatchPerDraw: baselinePer(controlBestSum),
        averageDistinctNumbers: Number((controlDistinctSum / baselineCount).toFixed(2)),
        best3PlusRate: baselinePct(controlBest3Count),
        hitDistribution: controlHitDistribution,
        zScore: control.zScore,
        ci95: control.ci95,
      },
      disjointControl: {
        averageBestMatchPerDraw: baselinePer(disjointBestSum),
        best3PlusRate: baselinePct(disjointBest3Count),
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
      // 현재 우선순위: /generate 와 같은 입력(전체 회차)으로 계산한다. 백테스트 창 이전이 아니다.
      currentWeights: buildRuleWeights(sorted),
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
  return withBacktestCache(
    db,
    { kind: 'lotto', algorithm: LOTTO_ALGORITHM_VERSION, lookback },
    () => getLottoDataVersionQuery(db),
    async () => {
      const rows = await getAllLottoBacktestRowsQuery(db)
      return { result: runLottoBacktest(rows, lookback), dataVersion: dataVersionOf(rows, (row) => row.drwNo) }
    },
  )
}
