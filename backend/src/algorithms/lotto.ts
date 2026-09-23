import type { DrawNumbersRow, GeneratedSet } from '../types/lotto'
import type { RandomSource } from '../utils/random'
import { buildRandomNumbers } from './lotto-baseline'

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

function buildFallbackSet(random: RandomSource, label: string, ruleId?: string, ruleWeight?: number): GeneratedSet {
  const numbers = buildRandomNumbers(random)
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

  const lookbackNumbers = lookbackDraws.map((draw) => COLS.map((col) => draw[col]).sort((a, b) => a - b))
  const commonPass = lookbackNumbers.map(passesCommonRules)

  return SET_CONFIGS.map((config) => {
    let passCount = 0
    let recentMatchCount = 0

    lookbackNumbers.forEach((numbers, index) => {
      const matched = config.check(numbers)
      if (commonPass[index] && matched) passCount += 1
      if (matched) recentMatchCount += 1
    })

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
  let zones = 0
  for (const n of numbers) zones |= 1 << Math.ceil(n / 9)
  let count = 0
  for (; zones !== 0; zones &= zones - 1) count += 1
  return count
}

export function passesCommonRules(numbers: number[]) {
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

  // 번호(1~45)를 인덱스로 쓰는 배열. 백테스트가 회차마다 전체 이력을 다시 세므로 Map 대신 배열로 센다.
  const freq = new Array<number>(46).fill(0)
  for (const row of draws) {
    for (const col of COLS) freq[row[col]] += 1
  }

  const recent = new Array<number>(46).fill(0)
  for (const row of recentDraws) {
    for (const col of COLS) recent[row[col]] += 1
  }

  const inAge = new Array<boolean>(46).fill(false)
  for (const row of ageDraws) {
    for (const col of COLS) inAge[row[col]] = true
  }

  const inCold = new Array<boolean>(46).fill(false)
  for (const row of coldDraws) {
    for (const col of COLS) inCold[row[col]] = true
  }

  const maxRecent = Math.max(...recent, 1)

  // 사전분포: 모든 번호 1회 + 실제 출현 횟수
  let totalPrior = 0
  for (let num = 1; num <= 45; num++) totalPrior += 1 + freq[num]

  return Array.from({ length: 45 }, (_, i) => {
    const num = i + 1
    const recentScore = recent[num] / maxRecent
    const isCold = !inCold[num]
    const isOverheat = inAge[num] && recent[num] >= 3
    let weight = (1 + freq[num]) / totalPrior * 0.5 + recentScore * 0.5
    if (isCold) weight *= 0.5
    if (isOverheat) weight *= 0.7
    return { num, weight: Math.max(weight, 0.02) }
  })
}

// 비복원 가중 추출. 뽑힌 번호를 건너뛰고 total 에서 빼는 방식이라 매 추출마다 배열을 새로 만들지 않는다.
// (백테스트에서 세트당 수백 번 호출되는 핫스팟)
function pickWeightedNumbers(weights: { num: number; weight: number }[], random: RandomSource) {
  const picked = new Set<number>()
  let total = weights.reduce((sum, entry) => sum + entry.weight, 0)

  while (picked.size < 6) {
    let remaining = random() * total
    let chosen: { num: number; weight: number } | undefined

    for (const entry of weights) {
      if (picked.has(entry.num)) continue
      chosen = entry
      remaining -= entry.weight
      if (remaining <= 0) break
    }

    picked.add(chosen!.num)
    total -= chosen!.weight
  }

  return Array.from(picked).sort((a, b) => a - b)
}

function pickSet(config: SetConfig, weights: { num: number; weight: number }[], ruleWeight: number, random: RandomSource): GeneratedSet {
  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const numbers = pickWeightedNumbers(weights, random)
    if (passesCommonRules(numbers) && config.check(numbers)) {
      return {
        label: config.label,
        numbers,
        meta: buildSetMeta(numbers, ['common-rules', config.label], config.id, ruleWeight),
      }
    }
  }

  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const numbers = pickWeightedNumbers(weights, random)
    if (passesCommonRules(numbers)) {
      return {
        label: config.label,
        numbers,
        meta: buildSetMeta(numbers, ['common-rules', 'fallback-set-rule-relaxed'], config.id, ruleWeight),
      }
    }
  }

  return buildFallbackSet(random, config.label, config.id, ruleWeight)
}

export function buildGeneratedSets(draws: DrawNumbersRow[], random: RandomSource = Math.random): GeneratedSet[] {
  if (draws.length === 0) {
    return SET_CONFIGS.map(({ label, id, baseWeight }) => buildFallbackSet(random, label, id, baseWeight))
  }

  const weights = buildWeights(draws)
  const ruleWeights = buildRuleWeights(draws)
  const weightMap = new Map(ruleWeights.map((entry) => [entry.ruleId, entry.weight]))

  return SET_CONFIGS
    .slice()
    .sort((a, b) => (weightMap.get(b.id) ?? b.baseWeight) - (weightMap.get(a.id) ?? a.baseWeight))
    .map((config) => pickSet(config, weights, weightMap.get(config.id) ?? config.baseWeight, random))
}

export function countMatches(picked: number[], draw: DrawNumbersRow) {
  const winning = new Set(COLS.map(col => draw[col]))
  let matches = 0
  for (const num of picked) {
    if (winning.has(num)) matches += 1
  }
  return matches
}
