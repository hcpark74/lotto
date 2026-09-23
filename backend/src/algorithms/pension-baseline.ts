// 연금복권720+ 백테스트 지표와 무작위 기준선.
//
// 당첨 규정 (동행복권 https://www.dhlottery.co.kr/pt720/intro "당첨구조"):
//   1등  조 + 6자리 모두 일치          2등  오른쪽 끝부터 연속 6자리 (조 무관)
//   3~7등  오른쪽 끝부터 연속 5~1자리   보너스  보너스 번호와 오른쪽 끝부터 연속 6자리
// 그래서 점수는 "끝자리부터 연속으로 일치한 자리 수(0~6)"다. 추천 번호는 조를 고르지 않으므로
// 6자리 일치는 2등(조까지 맞으면 1등)으로 환산한다.

import type { RandomSource } from '../utils/random'
import { describeDistribution } from './significance'

export const PENSION_DIGIT_COUNT = 6

function normalize(value: string) {
  return value.padStart(PENSION_DIGIT_COUNT, '0').slice(-PENSION_DIGIT_COUNT)
}

// 끝자리부터 연속으로 일치하는 자리 수 (0~6)
export function countTrailingMatches(picked: string, winning: string) {
  const left = normalize(picked)
  const right = normalize(winning)
  let matches = 0

  for (let index = PENSION_DIGIT_COUNT - 1; index >= 0 && left[index] === right[index]; index--) {
    matches += 1
  }

  return matches
}

// 당첨 번호가 균등 무작위라면 어떤 번호를 고르든
// P(정확히 끝 k자리) = 0.9·0.1^k (k < 6),  P(6자리) = 0.1^6
export const PENSION_TRAILING_MATCH_PROBABILITIES: Record<number, number> = Object.fromEntries(
  Array.from({ length: PENSION_DIGIT_COUNT + 1 }, (_, k) => [
    k,
    k < PENSION_DIGIT_COUNT ? 0.9 * 0.1 ** k : 0.1 ** PENSION_DIGIT_COUNT,
  ]),
)

// 기대값 0.111111, 표준편차 0.3514 (test/pension-baseline.test.ts 에서 고정)
export const PENSION_NULL_MODEL = describeDistribution(PENSION_TRAILING_MATCH_PROBABILITIES)

// 끝자리 연속 일치 수 → 등위 (0 이면 낙첨). 6자리 일치는 조를 모르므로 2등으로 본다.
export function trailingMatchesToRank(matches: number) {
  return matches === 0 ? null : 8 - matches
}

export function buildRandomPensionNumber(random: RandomSource = Math.random) {
  return Array.from({ length: PENSION_DIGIT_COUNT }, () => Math.floor(random() * 10)).join('')
}
