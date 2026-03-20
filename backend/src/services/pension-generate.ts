import {
  buildPensionRuleWeights,
  buildPensionRecommendations,
  PENSION_ALGORITHM_VERSION,
  PENSION_RULES,
} from '../algorithms/pension'
import { getRecentPensionWinningNumbersQuery } from '../queries/pension/results'
import type { PensionGenerateSummary } from '../types/pension'

export async function generatePensionSets(db: D1Database): Promise<PensionGenerateSummary> {
  const historyRows = await getRecentPensionWinningNumbersQuery(db, 60)
  const historyNumbers = historyRows.map((row) => row.winning_number).filter(Boolean)

  return {
    sets: buildPensionRecommendations(historyNumbers),
    algorithm: PENSION_ALGORITHM_VERSION,
    rules: PENSION_RULES,
    ruleWeights: buildPensionRuleWeights(historyNumbers),
  }
}
