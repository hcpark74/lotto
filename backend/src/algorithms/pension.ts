import type { PensionRecommendationSet } from '../types/pension'

export const PENSION_ALGORITHM_VERSION = 'pension-balanced-v1'

export const PENSION_RULES = {
  sumRange: '22-34',
  oddCountRange: '2-4',
  minUniqueDigits: 4,
  noThreeConsecutive: true,
  maxDuplicateCount: 2,
}

function getDigitSum(digits: number[]) {
  return digits.reduce((sum, digit) => sum + digit, 0)
}

function getOddDigitCount(digits: number[]) {
  return digits.filter(digit => digit % 2 === 1).length
}

function getUniqueDigitCount(digits: number[]) {
  return new Set(digits).size
}

function hasThreeConsecutiveDigits(digits: number[]) {
  for (let i = 0; i <= digits.length - 3; i++) {
    const ascending = digits[i] + 1 === digits[i + 1] && digits[i + 1] + 1 === digits[i + 2]
    const descending = digits[i] - 1 === digits[i + 1] && digits[i + 1] - 1 === digits[i + 2]
    if (ascending || descending) return true
  }
  return false
}

function getMaxDuplicateCount(digits: number[]) {
  const counts = new Map<number, number>()
  for (const digit of digits) counts.set(digit, (counts.get(digit) ?? 0) + 1)
  return Math.max(...counts.values(), 1)
}

export function buildPensionRecommendation(label: string): PensionRecommendationSet {
  for (let attempt = 0; attempt < 300; attempt++) {
    const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
    const sum = getDigitSum(digits)
    const oddCount = getOddDigitCount(digits)
    const uniqueDigitCount = getUniqueDigitCount(digits)
    const hasThreeConsecutive = hasThreeConsecutiveDigits(digits)
    const maxDuplicateCount = getMaxDuplicateCount(digits)

    if (sum < 22 || sum > 34) continue
    if (oddCount < 2 || oddCount > 4) continue
    if (uniqueDigitCount < 4) continue
    if (hasThreeConsecutive) continue
    if (maxDuplicateCount >= 3) continue

    return {
      label,
      number: digits.join(''),
      meta: {
        sum,
        oddCount,
        uniqueDigitCount,
        maxDuplicateCount,
        hasThreeConsecutive,
      },
    }
  }

  const fallbackDigits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
  return {
    label,
    number: fallbackDigits.join(''),
    meta: {
      sum: getDigitSum(fallbackDigits),
      oddCount: getOddDigitCount(fallbackDigits),
      uniqueDigitCount: getUniqueDigitCount(fallbackDigits),
      maxDuplicateCount: getMaxDuplicateCount(fallbackDigits),
      hasThreeConsecutive: hasThreeConsecutiveDigits(fallbackDigits),
    },
  }
}

export function buildPensionRecommendations() {
  return [buildPensionRecommendation('정교 추천 1세트')]
}
