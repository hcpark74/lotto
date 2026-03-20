import { buildGeneratedSets, buildRuleWeights, LOTTO_ALGORITHM_VERSION } from '../algorithms/lotto'
import { getAllLottoDrawNumbersQuery, getLottoResultCountQuery } from '../queries/lotto'
import type { DrawNumbersRow, LottoGenerateSummary } from '../types/lotto'

export function generateLottoSets(draws: DrawNumbersRow[]): LottoGenerateSummary {
  if (draws.length === 0) {
    return {
      sets: buildGeneratedSets([]),
      algorithm: `${LOTTO_ALGORITHM_VERSION} (랜덤 - 데이터 없음)`,
      ruleWeights: [],
    }
  }

  return {
    sets: buildGeneratedSets(draws),
    algorithm: LOTTO_ALGORITHM_VERSION,
    ruleWeights: buildRuleWeights(draws),
  }
}

export async function generateLottoSetsFromDb(db: D1Database) {
  const total = await getLottoResultCountQuery(db)

  if (total === 0) {
    return generateLottoSets([])
  }

  return generateLottoSets(await getAllLottoDrawNumbersQuery(db))
}
