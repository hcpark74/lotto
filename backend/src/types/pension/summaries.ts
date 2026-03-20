import type { PensionRecommendationSet } from './models'

export type Pension720SyncSummary = {
  syncedCount: number
  latestDraw: number
  nextDrawNo: number
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
  }
}
