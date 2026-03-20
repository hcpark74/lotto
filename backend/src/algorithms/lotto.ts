import type { DrawNumbersRow, GeneratedSet } from '../types/lotto'

type SetConfig = {
  id: string
  label: string
  baseWeight: number
  check: (numbers: number[]) => boolean
}

export type RuleWeightDiagnostic = {
  ruleId: string
  label: string
  weight: number
  score: number
  passRate: number
  recentMatchRate: number
}

const COLS = ['drwtNo1', 'drwtNo2', 'drwtNo3', 'drwtNo4', 'drwtNo5', 'drwtNo6'] as const

export const LOTTO_ALGORITHM_VERSION = 'v3.2'

export const SET_CONFIGS: SetConfig[] = [
  {
    id: 'odd-balance',
    label: '홀짝 균형형',
    baseWeight: 1,
    check: (numbers) => numbers.filter(n => n % 2 === 1).length === 3,
  },
  {
    id: 'no-consecutive-pair',
    label: '연속 독립형',
    baseWeight: 1,
    check: (numbers) => {
      for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] === numbers[i - 1] + 1) return false
      }
      return true
    },
  },
  {
    id: 'stable-sum',
    label: '합계 안정형',
    baseWeight: 1,
    check: (numbers) => {
      const sum = numbers.reduce((a, b) => a + b, 0)
      return sum >= 110 && sum <= 155
    },
  },
  {
    id: 'zone-distribution',
    label: '구간 분포형',
    baseWeight: 1,
    check: (numbers) => new Set(numbers.map(n => Math.ceil(n / 10))).size >= 4,
  },
  {
    id: 'tail-balance',
    label: '끝수 균형형',
    baseWeight: 1,
    check: (numbers) => new Set(numbers.map(n => n % 10)).size === numbers.length,
  },
]

const RECENT_DRAW_COUNT = 50
const COLD_DRAW_COUNT = 15
const AGE_BONUS_WINDOW = 10
const MAX_PICK_ATTEMPTS = 300
const RULE_WEIGHT_LOOKBACK = 24

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function buildFallbackSet(label: string, ruleId?: string, ruleWeight?: number): GeneratedSet {
  const picked = new Set<number>()
  while (picked.size < 6) picked.add(Math.floor(Math.random() * 45) + 1)
  const numbers = Array.from(picked).sort((a, b) => a - b)
  return {
    label,
    numbers,
    meta: buildSetMeta(numbers, ['fallback-random'], ruleId, ruleWeight),
  }
}

function getOddCount(numbers: number[]) {
  return numbers.filter(n => n % 2 === 1).length
}

function getConsecutiveRun(numbers: number[]) {
  let maxRun = 1
  let currentRun = 1

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === numbers[i - 1] + 1) {
      currentRun += 1
      maxRun = Math.max(maxRun, currentRun)
    } else {
      currentRun = 1
    }
  }

  return maxRun
}

function getSum(numbers: number[]) {
  return numbers.reduce((a, b) => a + b, 0)
}

function buildSetMeta(numbers: number[], passedRules: string[], ruleId?: string, ruleWeight?: number) {
  return {
    ruleId,
    ruleWeight,
    sum: getSum(numbers),
    oddCount: getOddCount(numbers),
    maxConsecutiveRun: getConsecutiveRun(numbers),
    passedRules,
  }
}

export function buildRuleWeights(draws: DrawNumbersRow[]): RuleWeightDiagnostic[] {
  const lookbackDraws = draws.slice(-Math.min(RULE_WEIGHT_LOOKBACK, draws.length))

  if (lookbackDraws.length === 0) {
    return SET_CONFIGS.map((config) => ({
      ruleId: config.id,
      label: config.label,
      weight: config.baseWeight,
      score: 0.5,
      passRate: 0.5,
      recentMatchRate: 0.5,
    }))
  }

  return SET_CONFIGS.map((config) => {
    let passCount = 0
    let recentMatchCount = 0

    for (const draw of lookbackDraws) {
      const numbers = COLS.map((col) => draw[col]).sort((a, b) => a - b)
      if (passesCommonRules(numbers) && config.check(numbers)) passCount += 1
      if (config.check(numbers)) recentMatchCount += 1
    }

    const passRate = passCount / lookbackDraws.length
    const recentMatchRate = recentMatchCount / lookbackDraws.length
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

function getZoneCount(numbers: number[]) {
  return new Set(numbers.map(n => Math.ceil(n / 9))).size
}

function passesCommonRules(numbers: number[]) {
  const sum = getSum(numbers)
  const oddCount = getOddCount(numbers)
  const maxConsecutiveRun = getConsecutiveRun(numbers)
  const zoneCount = getZoneCount(numbers)

  return sum >= 110
    && sum <= 170
    && oddCount >= 2
    && oddCount <= 4
    && maxConsecutiveRun < 3
    && zoneCount >= 3
}

function buildWeights(draws: DrawNumbersRow[]) {
  const recentN = Math.min(RECENT_DRAW_COUNT, draws.length)
  const coldN = Math.min(COLD_DRAW_COUNT, draws.length)
  const ageN = Math.min(AGE_BONUS_WINDOW, draws.length)
  const recentDraws = draws.slice(-recentN)
  const coldDraws = recentDraws.slice(-coldN)
  const ageDraws = recentDraws.slice(-ageN)

  const freqMap = new Map<number, number>()
  for (const row of draws) {
    for (const col of COLS) freqMap.set(row[col], (freqMap.get(row[col]) ?? 0) + 1)
  }

  const recentMap = new Map<number, number>()
  for (const row of recentDraws) {
    for (const col of COLS) recentMap.set(row[col], (recentMap.get(row[col]) ?? 0) + 1)
  }

  const ageSet = new Set<number>()
  for (const row of ageDraws) {
    for (const col of COLS) ageSet.add(row[col])
  }

  const coldSet = new Set<number>()
  for (const row of coldDraws) {
    for (const col of COLS) coldSet.add(row[col])
  }

  const maxFreq = Math.max(...freqMap.values(), 1)
  const maxRecent = Math.max(...recentMap.values(), 1)

  const priorMap = new Map<number, number>()
  for (let i = 1; i <= 45; i++) priorMap.set(i, 1)

  for (const [num, count] of freqMap) {
    priorMap.set(num, priorMap.get(num)! + count)
  }

  const totalPrior = Array.from(priorMap.values()).reduce((a, b) => a + b, 0)
  const posteriorMap = new Map<number, number>()
  for (const [num, prior] of priorMap) {
    posteriorMap.set(num, prior / totalPrior)
  }

  return Array.from({ length: 45 }, (_, i) => {
    const num = i + 1
    const recentScore = (recentMap.get(num) ?? 0) / maxRecent
    const isCold = !coldSet.has(num)
    const isOverheat = ageSet.has(num) && (recentMap.get(num) ?? 0) >= 3
    let weight = posteriorMap.get(num)! * 0.5 + recentScore * 0.5
    if (isCold) weight *= 0.5
    if (isOverheat) weight *= 0.7
    return { num, weight: Math.max(weight, 0.02) }
  })
}

function weightedPick(pool: { num: number; weight: number }[]) {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
  let random = Math.random() * total
  for (const entry of pool) {
    random -= entry.weight
    if (random <= 0) return entry.num
  }
  return pool[pool.length - 1].num
}

function pickWeightedNumbers(weights: { num: number; weight: number }[]) {
  const picked = new Set<number>()
  while (picked.size < 6) picked.add(weightedPick(weights.filter(entry => !picked.has(entry.num))))
  return Array.from(picked).sort((a, b) => a - b)
}

function pickSet(config: SetConfig, weights: { num: number; weight: number }[], ruleWeight: number): GeneratedSet {
  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const numbers = pickWeightedNumbers(weights)
    if (passesCommonRules(numbers) && config.check(numbers)) {
      return {
        label: config.label,
        numbers,
        meta: buildSetMeta(numbers, ['common-rules', config.label], config.id, ruleWeight),
      }
    }
  }

  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const numbers = pickWeightedNumbers(weights)
    if (passesCommonRules(numbers)) {
      return {
        label: config.label,
        numbers,
        meta: buildSetMeta(numbers, ['common-rules', 'fallback-set-rule-relaxed'], config.id, ruleWeight),
      }
    }
  }

  return buildFallbackSet(config.label, config.id, ruleWeight)
}

export function buildGeneratedSets(draws: DrawNumbersRow[]): GeneratedSet[] {
  if (draws.length === 0) {
    return SET_CONFIGS.map(({ label, id, baseWeight }) => buildFallbackSet(label, id, baseWeight))
  }

  const weights = buildWeights(draws)
  const ruleWeights = buildRuleWeights(draws)
  const weightMap = new Map(ruleWeights.map((entry) => [entry.ruleId, entry.weight]))

  return SET_CONFIGS
    .slice()
    .sort((a, b) => (weightMap.get(b.id) ?? b.baseWeight) - (weightMap.get(a.id) ?? a.baseWeight))
    .map((config) => pickSet(config, weights, weightMap.get(config.id) ?? config.baseWeight))
}

export function countMatches(picked: number[], draw: DrawNumbersRow) {
  const winning = new Set(COLS.map(col => draw[col]))
  let matches = 0
  for (const num of picked) {
    if (winning.has(num)) matches += 1
  }
  return matches
}
