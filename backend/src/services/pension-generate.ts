import {
  buildPensionRecommendations,
  PENSION_ALGORITHM_VERSION,
  PENSION_RULES,
} from '../algorithms/pension'
import type { PensionGenerateSummary } from '../types/pension'

export function generatePensionSets(): PensionGenerateSummary {
  return {
    sets: buildPensionRecommendations(),
    algorithm: PENSION_ALGORITHM_VERSION,
    rules: PENSION_RULES,
  }
}
