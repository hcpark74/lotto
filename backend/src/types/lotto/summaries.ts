import type { GeneratedSet } from './models'

export type LottoSyncSummary = {
  syncedCount: number
  latestDraw: number
  nextDrwNo: number
}

export type LottoBacktestSummary = {
  algorithm: string
  evaluatedDraws: number
  setsPerDraw: number
  totalGeneratedSets: number
  averageMatchPerSet: number
  averageBestMatchPerDraw: number
  baseline: {
    theoretical: {
      expectedMatchPerSet: number
      matchStdPerSet: number
      matchProbabilities: Record<number, number>
      expectedHitDistribution: Record<number, number>
    }
    randomControl: {
      totalSets: number
      averageMatchPerSet: number
      hitDistribution: Record<number, number>
      zScore: number
      ci95: [number, number]
    }
    overall: {
      zScore: number
      ci95: [number, number]
      significant: boolean
    }
  }
  generationQuality: {
    commonRulePassRate: number
    relaxedFallbackRate: number
    randomFallbackRate: number
  }
  setHitRate: {
    match3Plus: number
    match4Plus: number
    match5Plus: number
    match5PlusBonus: number
  }
  hitDistribution: Record<number, number>
  bestHitDistribution: Record<number, number>
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
      averageMatches: number
      zScore: number
      ci95: [number, number]
      commonRulePassRate: number
      relaxedFallbackRate: number
      randomFallbackRate: number
    }>
  }
}

export type LottoHotNumber = {
  num: number
  count: number
}

export type LottoGenerateSummary = {
  sets: GeneratedSet[]
  algorithm: string
  ruleWeights?: Array<{
    ruleId: string
    label: string
    weight: number
    score: number
    passRate: number
    recentMatchRate: number
  }>
}
