import { countTrailingMatches, PENSION_DIGIT_COUNT, trailingMatchesToRank } from './pension-baseline'

// 로또 등위 (dhlottery.co.kr/lt645/intro 기준): 6개=1등, 5개+보너스=2등, 5개=3등, 4개=4등, 3개=5등.
// 그 아래는 낙첨이라 null 을 돌려준다.
export function lottoRankOf(matchedCount: number, bonusMatched: boolean) {
  if (matchedCount === 6) return 1
  if (matchedCount === 5) return bonusMatched ? 2 : 3
  if (matchedCount === 4) return 4
  if (matchedCount === 3) return 5
  return null
}

export function gradeLottoPick(numbers: number[], winning: number[], bonus: number) {
  const winningSet = new Set(winning)
  const matchedCount = numbers.filter((n) => winningSet.has(n)).length
  const bonusMatched = numbers.includes(bonus)
  return { matchedCount, bonusMatched, rankNo: lottoRankOf(matchedCount, bonusMatched) }
}

// 연금복권은 끝자리부터 연속으로 일치한 자리 수로 등위가 갈린다 (6자리=2등 … 1자리=7등).
// 추천은 조를 고르지 않으므로 1등은 판정하지 않는다. 보너스 번호와 6자리가 맞으면 보너스 등위로 본다.
export const PENSION_BONUS_RANK = 8

export function gradePensionPick(number: string, winningNumber: string, bonusNumber: string | null) {
  const matchedCount = countTrailingMatches(number, winningNumber)
  const bonusMatched = bonusNumber != null && countTrailingMatches(number, bonusNumber) === PENSION_DIGIT_COUNT
  const rankNo = bonusMatched && matchedCount < PENSION_DIGIT_COUNT
    ? PENSION_BONUS_RANK
    : trailingMatchesToRank(matchedCount)
  return { matchedCount, bonusMatched, rankNo }
}
