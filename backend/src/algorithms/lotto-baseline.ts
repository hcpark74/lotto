// 로또 6/45 추첨을 기준으로 한 이론 분포와 랜덤 대조군 유틸.
// 전략 성과를 해석하려면 "순수 랜덤이면 얼마가 나오는가"가 항상 옆에 있어야 한다.

export const LOTTO_POOL_SIZE = 45
export const LOTTO_PICK_COUNT = 6

export function combination(n: number, k: number) {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i
  }
  return Math.round(result)
}

// P(k개 일치) = C(6,k)·C(39,6−k) / C(45,6)
export function hypergeometricMatchProbability(k: number) {
  const total = combination(LOTTO_POOL_SIZE, LOTTO_PICK_COUNT)
  return combination(LOTTO_PICK_COUNT, k) * combination(LOTTO_POOL_SIZE - LOTTO_PICK_COUNT, LOTTO_PICK_COUNT - k) / total
}

export const LOTTO_MATCH_PROBABILITIES: Record<number, number> = Object.fromEntries(
  Array.from({ length: LOTTO_PICK_COUNT + 1 }, (_, k) => [k, hypergeometricMatchProbability(k)]),
)

// 기대값 n·K/N = 6·6/45 = 0.8
export const LOTTO_EXPECTED_MATCHES = LOTTO_PICK_COUNT * LOTTO_PICK_COUNT / LOTTO_POOL_SIZE

// 분산 n·(K/N)·(1−K/N)·(N−n)/(N−1)
export const LOTTO_MATCH_STD = Math.sqrt(
  LOTTO_PICK_COUNT
    * (LOTTO_PICK_COUNT / LOTTO_POOL_SIZE)
    * (1 - LOTTO_PICK_COUNT / LOTTO_POOL_SIZE)
    * (LOTTO_POOL_SIZE - LOTTO_PICK_COUNT) / (LOTTO_POOL_SIZE - 1),
)

export function buildRandomNumbers() {
  const picked = new Set<number>()
  while (picked.size < LOTTO_PICK_COUNT) picked.add(Math.floor(Math.random() * LOTTO_POOL_SIZE) + 1)
  return Array.from(picked).sort((a, b) => a - b)
}

export type SignificanceSummary = {
  sampleSize: number
  mean: number
  expected: number
  zScore: number
  ci95: [number, number]
}

// 귀무가설(순수 랜덤) 하에서 세트별 일치 수는 i.i.d. 초기하분포이므로
// 표본 평균의 표준오차는 0.784/√n 이다.
export function summarizeSignificance(totalMatches: number, sampleSize: number): SignificanceSummary {
  if (sampleSize === 0) {
    return { sampleSize: 0, mean: 0, expected: LOTTO_EXPECTED_MATCHES, zScore: 0, ci95: [0, 0] }
  }

  const mean = totalMatches / sampleSize
  const standardError = LOTTO_MATCH_STD / Math.sqrt(sampleSize)
  const zScore = (mean - LOTTO_EXPECTED_MATCHES) / standardError
  const halfWidth = 1.96 * standardError

  return {
    sampleSize,
    mean: Number(mean.toFixed(3)),
    expected: Number(LOTTO_EXPECTED_MATCHES.toFixed(3)),
    zScore: Number(zScore.toFixed(2)),
    ci95: [Number((mean - halfWidth).toFixed(3)), Number((mean + halfWidth).toFixed(3))],
  }
}

// 한 회차에 여러 세트를 채점하면 세트들이 같은 가중치·같은 target을 공유해 양의 상관을 가진다.
// 이때 세트 수를 n으로 쓰면 표준오차가 과소 추정되므로, 회차별 합계(독립 관측)의 경험 분산으로 계산한다.
export function summarizeSignificanceByDraw(drawTotals: number[], setsPerDraw: number): SignificanceSummary {
  const drawCount = drawTotals.length
  const sampleSize = drawCount * setsPerDraw
  if (drawCount === 0 || setsPerDraw === 0) {
    return { sampleSize: 0, mean: 0, expected: LOTTO_EXPECTED_MATCHES, zScore: 0, ci95: [0, 0] }
  }

  const totalMatches = drawTotals.reduce((a, b) => a + b, 0)
  const mean = totalMatches / sampleSize
  const drawMean = totalMatches / drawCount
  const drawVariance = drawCount > 1
    ? drawTotals.reduce((acc, value) => acc + (value - drawMean) ** 2, 0) / (drawCount - 1)
    : 0
  // 회차가 1개뿐이거나 분산이 0이면 세트 간 독립을 가정한 이론 분산으로 대체한다.
  const drawStd = drawVariance > 0 ? Math.sqrt(drawVariance) : LOTTO_MATCH_STD * Math.sqrt(setsPerDraw)
  const standardError = drawStd / (setsPerDraw * Math.sqrt(drawCount))
  const zScore = (mean - LOTTO_EXPECTED_MATCHES) / standardError
  const halfWidth = 1.96 * standardError

  return {
    sampleSize,
    mean: Number(mean.toFixed(3)),
    expected: Number(LOTTO_EXPECTED_MATCHES.toFixed(3)),
    zScore: Number(zScore.toFixed(2)),
    ci95: [Number((mean - halfWidth).toFixed(3)), Number((mean + halfWidth).toFixed(3))],
  }
}

export function buildExpectedHitDistribution(sampleSize: number) {
  return Object.fromEntries(
    Object.entries(LOTTO_MATCH_PROBABILITIES).map(([k, p]) => [k, Number((p * sampleSize).toFixed(2))]),
  ) as Record<number, number>
}
