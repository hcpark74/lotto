import type { PensionRecommendationSet } from './models'

export type Pension720SyncSummary = {
  syncedCount: number
  latestDraw: number
  nextDrawNo: number
  // 당첨 통계를 아직 받지 못해 다음 sync 에서 재시도할 회차
  pendingPrizeDrawNos: number[]
}

export type PensionGenerateSummary = {
  sets: PensionRecommendationSet[]
  algorithm: string
  rules: {
    sumRange: string
    oddCountRange: string
    minUniqueDigits: number
    noThreeConsecutive: boolean
    maxDuplicateCount: number
    setProfiles?: string[]
    fallback?: string[]
  }
  ruleWeights?: Array<{
    ruleId: string
    label: string
    weight: number
    score: number
    passRate: number
    recentMatchRate: number
  }>
}

export type PensionBacktestSummary = {
  algorithm: string
  evaluatedDraws: number
  setsPerDraw: number
  totalGeneratedSets: number
  averageExactMatchPerSet: number
  averageBestExactMatchPerDraw: number
  exactMatchDistribution: Record<number, number>
  bestExactMatchDistribution: Record<number, number>
  ruleDiagnostics: {
    currentWeights: Array<{
      ruleId: string
      label: string
      weight: number
      score: number
      passRate: number
      recentMatchRate: number
    }>
    performance: Array<{
      ruleId: string
      label: string
      generatedCount: number
      averageExactMatches: number
      exactMatch3PlusRate: number
      exactMatch4PlusRate: number
    }>
  }
}
