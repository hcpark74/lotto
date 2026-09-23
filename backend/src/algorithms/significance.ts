// 백테스트 지표를 "순수 랜덤이면 얼마가 나오는가"(귀무가설)와 비교하는 공통 계산.
// 로또·연금은 귀무가설의 기대값과 표준편차만 다르다.

// 귀무가설 하에서 세트 1개의 점수(일치 수)의 기대값과 표준편차
export type NullModel = {
  expected: number
  std: number
}

export type SignificanceSummary = {
  sampleSize: number
  mean: number
  expected: number
  zScore: number
  ci95: [number, number]
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits))
}

function emptySummary(model: NullModel, digits: number): SignificanceSummary {
  return { sampleSize: 0, mean: 0, expected: round(model.expected, digits), zScore: 0, ci95: [0, 0] }
}

// 세트들이 서로 독립일 때. 표본 평균의 표준오차는 std/√n.
export function summarizeSignificance(totalScore: number, sampleSize: number, model: NullModel, digits = 3): SignificanceSummary {
  if (sampleSize === 0) return emptySummary(model, digits)

  const mean = totalScore / sampleSize
  const standardError = model.std / Math.sqrt(sampleSize)
  const zScore = (mean - model.expected) / standardError
  const halfWidth = 1.96 * standardError

  return {
    sampleSize,
    mean: round(mean, digits),
    expected: round(model.expected, digits),
    zScore: round(zScore, 2),
    ci95: [round(mean - halfWidth, digits), round(mean + halfWidth, digits)],
  }
}

// 한 회차에 여러 세트를 채점하면 세트들이 같은 가중치·같은 target을 공유해 양의 상관을 가진다.
// 이때 세트 수를 n으로 쓰면 표준오차가 과소 추정되므로, 회차별 합계(독립 관측)의 경험 분산으로 계산한다.
export function summarizeSignificanceByDraw(drawTotals: number[], setsPerDraw: number, model: NullModel, digits = 3): SignificanceSummary {
  const drawCount = drawTotals.length
  const sampleSize = drawCount * setsPerDraw
  if (drawCount === 0 || setsPerDraw === 0) return emptySummary(model, digits)

  const totalScore = drawTotals.reduce((a, b) => a + b, 0)
  const mean = totalScore / sampleSize
  const drawMean = totalScore / drawCount
  const drawVariance = drawCount > 1
    ? drawTotals.reduce((acc, value) => acc + (value - drawMean) ** 2, 0) / (drawCount - 1)
    : 0
  // 회차가 1개뿐이거나 분산이 0이면 세트 간 독립을 가정한 이론 분산으로 대체한다.
  const drawStd = drawVariance > 0 ? Math.sqrt(drawVariance) : model.std * Math.sqrt(setsPerDraw)
  const standardError = drawStd / (setsPerDraw * Math.sqrt(drawCount))
  const zScore = (mean - model.expected) / standardError
  const halfWidth = 1.96 * standardError

  return {
    sampleSize,
    mean: round(mean, digits),
    expected: round(model.expected, digits),
    zScore: round(zScore, 2),
    ci95: [round(mean - halfWidth, digits), round(mean + halfWidth, digits)],
  }
}

// 확률분포(점수 → 확률)의 기대값·표준편차
export function describeDistribution(probabilities: Record<number, number>): NullModel {
  const entries = Object.entries(probabilities).map(([k, p]) => [Number(k), p] as const)
  const expected = entries.reduce((acc, [k, p]) => acc + k * p, 0)
  const variance = entries.reduce((acc, [k, p]) => acc + (k - expected) ** 2 * p, 0)
  return { expected, std: Math.sqrt(variance) }
}

export function buildExpectedDistribution(probabilities: Record<number, number>, sampleSize: number) {
  return Object.fromEntries(
    Object.entries(probabilities).map(([k, p]) => [k, round(p * sampleSize, 2)]),
  ) as Record<number, number>
}
