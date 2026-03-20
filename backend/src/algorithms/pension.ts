import type { PensionRecommendationSet } from '../types/pension'

type PensionSetConfig = {
  id: string
  label: string
  check: (digits: number[]) => boolean
}

export const PENSION_ALGORITHM_VERSION = 'pension-multi-set-v2'

export const PENSION_RULES = {
  sumRange: '22-34',
  oddCountRange: '2-4',
  minUniqueDigits: 4,
  noThreeConsecutive: true,
  maxDuplicateCount: 2,
  setProfiles: ['균형형', '홀수 집중형', '고유수 확장형', '저합계 안정형'],
}

const MAX_PENSION_ATTEMPTS = 300

const PENSION_SET_CONFIGS: PensionSetConfig[] = [
  {
    id: 'balanced-core',
    label: '균형형 추천',
    check: (digits) => getOddDigitCount(digits) === 3,
  },
  {
    id: 'odd-focus',
    label: '홀수 집중형 추천',
    check: (digits) => getOddDigitCount(digits) === 4,
  },
  {
    id: 'unique-focus',
    label: '고유수 확장형 추천',
    check: (digits) => getUniqueDigitCount(digits) >= 5,
  },
  {
    id: 'low-sum-stable',
    label: '저합계 안정형 추천',
    check: (digits) => {
      const sum = getDigitSum(digits)
      return sum >= 22 && sum <= 28
    },
  },
]

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

function passesCommonPensionRules(digits: number[]) {
  const sum = getDigitSum(digits)
  const oddCount = getOddDigitCount(digits)
  const uniqueDigitCount = getUniqueDigitCount(digits)
  const hasThreeConsecutive = hasThreeConsecutiveDigits(digits)
  const maxDuplicateCount = getMaxDuplicateCount(digits)

  return sum >= 22
    && sum <= 34
    && oddCount >= 2
    && oddCount <= 4
    && uniqueDigitCount >= 4
    && !hasThreeConsecutive
    && maxDuplicateCount < 3
}

function buildPensionMeta(digits: number[]) {
  return {
    sum: getDigitSum(digits),
    oddCount: getOddDigitCount(digits),
    uniqueDigitCount: getUniqueDigitCount(digits),
    maxDuplicateCount: getMaxDuplicateCount(digits),
    hasThreeConsecutive: hasThreeConsecutiveDigits(digits),
  }
}

export function buildPensionRecommendation(config: PensionSetConfig): PensionRecommendationSet {
  for (let attempt = 0; attempt < MAX_PENSION_ATTEMPTS; attempt++) {
    const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
    if (!passesCommonPensionRules(digits)) continue
    if (!config.check(digits)) continue

    return {
      label: config.label,
      number: digits.join(''),
      meta: buildPensionMeta(digits),
    }
  }

  for (let attempt = 0; attempt < MAX_PENSION_ATTEMPTS; attempt++) {
    const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
    if (!passesCommonPensionRules(digits)) continue

    return {
      label: config.label,
      number: digits.join(''),
      meta: buildPensionMeta(digits),
    }
  }

  const fallbackDigits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
  return {
    label: config.label,
    number: fallbackDigits.join(''),
    meta: buildPensionMeta(fallbackDigits),
  }
}

export function buildPensionRecommendations() {
  return PENSION_SET_CONFIGS.map((config) => buildPensionRecommendation(config))
}
