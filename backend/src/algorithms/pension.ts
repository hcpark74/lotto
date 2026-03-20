import type { PensionRecommendationSet } from '../types/pension'

type PensionSetConfig = {
  id: string
  label: string
  baseWeight: number
  check: (digits: number[]) => boolean
}

export type PensionRuleWeightDiagnostic = {
  ruleId: string
  label: string
  weight: number
  score: number
  passRate: number
  recentMatchRate: number
}

export const PENSION_ALGORITHM_VERSION = 'pension-multi-set-v2.2'

export const PENSION_RULES = {
  sumRange: '22-34',
  oddCountRange: '2-4',
  minUniqueDigits: 4,
  noThreeConsecutive: true,
  maxDuplicateCount: 2,
  setProfiles: ['균형형', '홀수 집중형', '고유수 확장형', '저합계 안정형'],
  fallback: ['세트 규칙', '공통 규칙 완화 폴백', '통계 기반 폴백', '랜덤 폴백'],
}

const MAX_PENSION_ATTEMPTS = 300
const PENSION_HISTORY_LOOKBACK = 60
const PENSION_RULE_LOOKBACK = 24

const PENSION_SET_CONFIGS: PensionSetConfig[] = [
  {
    id: 'balanced-core',
    label: '균형형 추천',
    baseWeight: 1,
    check: (digits) => getOddDigitCount(digits) === 3,
  },
  {
    id: 'odd-focus',
    label: '홀수 집중형 추천',
    baseWeight: 1,
    check: (digits) => getOddDigitCount(digits) === 4,
  },
  {
    id: 'unique-focus',
    label: '고유수 확장형 추천',
    baseWeight: 1,
    check: (digits) => getUniqueDigitCount(digits) >= 5,
  },
  {
    id: 'low-sum-stable',
    label: '저합계 안정형 추천',
    baseWeight: 1,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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

function parseHistoryDigits(historyNumbers: string[]) {
  return historyNumbers
    .slice(0, PENSION_RULE_LOOKBACK)
    .map((raw) => raw.padStart(6, '0').slice(-6).split('').map(Number))
    .filter((digits) => digits.length === 6 && digits.every((digit) => Number.isFinite(digit)))
}

export function buildPensionRuleWeights(historyNumbers: string[]): PensionRuleWeightDiagnostic[] {
  const historyDigits = parseHistoryDigits(historyNumbers)

  if (historyDigits.length === 0) {
    return PENSION_SET_CONFIGS.map((config) => ({
      ruleId: config.id,
      label: config.label,
      weight: config.baseWeight,
      score: 0.5,
      passRate: 0.5,
      recentMatchRate: 0.5,
    }))
  }

  return PENSION_SET_CONFIGS.map((config) => {
    let passCount = 0
    let matchCount = 0

    for (const digits of historyDigits) {
      if (passesCommonPensionRules(digits) && config.check(digits)) passCount += 1
      if (config.check(digits)) matchCount += 1
    }

    const passRate = passCount / historyDigits.length
    const recentMatchRate = matchCount / historyDigits.length
    const score = clamp(passRate * 0.65 + recentMatchRate * 0.35, 0.05, 1)
    const weight = Number((config.baseWeight * (0.75 + score)).toFixed(3))

    return {
      ruleId: config.id,
      label: config.label,
      weight,
      score: Number(score.toFixed(3)),
      passRate: Number(passRate.toFixed(3)),
      recentMatchRate: Number(recentMatchRate.toFixed(3)),
    }
  }).sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, 'ko'))
}

function weightedDigitPick(pool: number[]) {
  const total = pool.reduce((sum, weight) => sum + weight, 0)
  let random = Math.random() * total

  for (let digit = 0; digit < pool.length; digit++) {
    random -= pool[digit]
    if (random <= 0) return digit
  }

  return pool.length - 1
}

function buildHistoricalDigitWeights(historyNumbers: string[]) {
  const positionWeights = Array.from({ length: 6 }, () => Array.from({ length: 10 }, () => 1))

  for (const raw of historyNumbers.slice(0, PENSION_HISTORY_LOOKBACK)) {
    const digits = raw.padStart(6, '0').slice(-6).split('').map(Number)
    if (digits.some((digit) => Number.isNaN(digit))) continue

    digits.forEach((digit, index) => {
      positionWeights[index][digit] += 1
    })
  }

  return positionWeights
}

function buildStatisticalFallback(config: PensionSetConfig, historyNumbers: string[], ruleWeight?: number): PensionRecommendationSet | null {
  if (historyNumbers.length === 0) return null

  const positionWeights = buildHistoricalDigitWeights(historyNumbers)

  for (let attempt = 0; attempt < MAX_PENSION_ATTEMPTS; attempt++) {
    const digits = positionWeights.map((weights) => weightedDigitPick(weights))
    if (!passesCommonPensionRules(digits)) continue

    return {
      label: config.label,
      number: digits.join(''),
      meta: {
        ...buildPensionMeta(digits),
        ruleId: config.id,
        ruleWeight,
      },
    }
  }

  return null
}

export function buildPensionRecommendation(config: PensionSetConfig, historyNumbers: string[] = [], ruleWeight?: number): PensionRecommendationSet {
  for (let attempt = 0; attempt < MAX_PENSION_ATTEMPTS; attempt++) {
    const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
    if (!passesCommonPensionRules(digits)) continue
    if (!config.check(digits)) continue

    return {
      label: config.label,
      number: digits.join(''),
      meta: {
        ...buildPensionMeta(digits),
        ruleId: config.id,
        ruleWeight,
      },
    }
  }

  for (let attempt = 0; attempt < MAX_PENSION_ATTEMPTS; attempt++) {
    const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
    if (!passesCommonPensionRules(digits)) continue

    return {
      label: config.label,
      number: digits.join(''),
      meta: {
        ...buildPensionMeta(digits),
        ruleId: config.id,
        ruleWeight,
      },
    }
  }

  const statisticalFallback = buildStatisticalFallback(config, historyNumbers, ruleWeight)
  if (statisticalFallback) return statisticalFallback

  const fallbackDigits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
  return {
    label: config.label,
    number: fallbackDigits.join(''),
    meta: {
      ...buildPensionMeta(fallbackDigits),
      ruleId: config.id,
      ruleWeight,
    },
  }
}

export function buildPensionRecommendations(historyNumbers: string[] = []) {
  const ruleWeights = buildPensionRuleWeights(historyNumbers)
  const weightMap = new Map(ruleWeights.map((entry) => [entry.ruleId, entry.weight]))

  return PENSION_SET_CONFIGS
    .slice()
    .sort((a, b) => (weightMap.get(b.id) ?? b.baseWeight) - (weightMap.get(a.id) ?? a.baseWeight))
    .map((config) => buildPensionRecommendation(config, historyNumbers, weightMap.get(config.id) ?? config.baseWeight))
}
