import type { GeneratedSet, LottoResultRecord } from './models'

export type LottoSyncSummary = {
  syncedCount: number
  latestDraw: number
  nextDrwNo: number
  debug: LottoResultRecord | null
}

export type LottoBacktestSummary = {
  algorithm: string
  evaluatedDraws: number
  setsPerDraw: number
  totalGeneratedSets: number
  averageMatchPerSet: number
  averageBestMatchPerDraw: number
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
