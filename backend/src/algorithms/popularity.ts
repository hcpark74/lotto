// 인기 조합 회피 모델 (docs/PLAN.md Phase 3)
//
// 당첨 "확률"은 어떤 조합을 골라도 같다. 바꿀 수 있는 건 배당이다 —
// 1·2·3등은 당첨금을 당첨자끼리 나누므로, 남들이 덜 고르는 조합이면 같은 당첨에 더 받는다.
// (4·5등은 50,000원·5,000원 고정액이라 인기와 무관하다.)
//
// 측정값 — 1,243회차 등위별 당첨자 수로 적합·검증했다.
//   적합 400~1043회차, 보고 1044~1243회차 (적합에 쓰지 않은 구간)
//   표본 외 예측력 r = 0.402 (유의 임계 0.139)
//   점수 최하위 20% 를 골랐을 때 1인당 당첨금
//     2등 1.140배 (z=4.26)   3등 1.077배 (z=4.48)   ← Bonferroni 임계 2.39 통과
//     1등 1.033배 (z=0.37)   ← 구분 불가. 1등 당첨자의 70% 가 자동(균등 무작위) 구매라
//                               사람의 선택 편향이 희석된다. 이 비율은 20년간 안정적이다.
//   1게임 기대값 520원 → 529원 (환급률 52.0% → 52.9%, +0.89%)
//
// 계수를 코드에 박아 둔 이유: 적합 구간을 400/600/800회차로 바꿔도 표본 외 r 이
// 0.40~0.46 으로 안정적이다. 주 1회씩 늘어나는 표본으로 재학습해 봐야 측정 한계 안에서
// 움직인다. D1 학습 테이블과 승인 게이트는 얻는 것 없이 복잡도만 늘린다.

export const POPULARITY_MODEL_VERSION = 'p1'

// 로또 용지는 1~45 를 7열 격자로 찍는다. 사람이 선이나 모양을 그리면 같은 열·행에 몰린다.
const gridCol = (n: number) => (n - 1) % 7
const gridRow = (n: number) => Math.floor((n - 1) / 7)

const maxGroupSize = (numbers: number[], keyOf: (n: number) => number) => {
  const tally = new Map<number, number>()
  for (const n of numbers) tally.set(keyOf(n), (tally.get(keyOf(n)) ?? 0) + 1)
  return Math.max(...tally.values())
}

// 6개 번호 합의 중앙값. 사람은 합이 가운데인 조합을 "그럴듯하다"고 느껴 많이 고른다.
const SUM_CENTER = 138

type Feature = {
  key: string
  // 사람의 선택 습관을 반영한 특징
  of: (sorted: number[]) => number
  mean: number
  sd: number
  // 표준화 계수. 양수면 "그 특징이 클수록 남들도 많이 고른다".
  beta: number
}

// 400~1243회차(843회차) 전체로 적합한 계수. 타깃은
// log(2등 당첨자/판매액) 와 log(3등 당첨자/판매액) 의 평균 —
// 상금이 분할되고 예측이 되는 등위가 이 둘뿐이다.
const INTERCEPT = -11.624611

const FEATURES: Feature[] = [
  // 생일·기념일에서 오는 편향. low12(월·일 범위)가 가장 센 특징이다.
  { key: 'low31', of: (ns) => ns.filter((n) => n <= 31).length, mean: 4.123369, sd: 1.043064, beta: 0.005319 },
  { key: 'low12', of: (ns) => ns.filter((n) => n <= 12).length, mean: 1.570581, sd: 1.003287, beta: 0.054418 },
  { key: 'sumDev', of: (ns) => Math.abs(ns.reduce((a, b) => a + b, 0) - SUM_CENTER), mean: 24.169632, sd: 17.609806, beta: -0.003682 },
  { key: 'consec', of: (ns) => ns.slice(1).filter((n, i) => n === ns[i] + 1).length, mean: 0.661922, sd: 0.729523, beta: -0.013838 },
  { key: 'sameTail', of: (ns) => maxGroupSize(ns, (n) => n % 10), mean: 1.886121, sd: 0.550065, beta: 0.009908 },
  { key: 'maxCol', of: (ns) => maxGroupSize(ns, gridCol), mean: 2.149466, sd: 0.545843, beta: 0.003950 },
  { key: 'maxRow', of: (ns) => maxGroupSize(ns, gridRow), mean: 2.166074, sd: 0.523187, beta: -0.021946 },
  { key: 'spread', of: (ns) => ns[ns.length - 1] - ns[0], mean: 32.667853, sd: 6.795522, beta: -0.029377 },
  { key: 'odd', of: (ns) => ns.filter((n) => n % 2 === 1).length, mean: 3.045077, sd: 1.176221, beta: 0.010413 },
  { key: 'mult5', of: (ns) => ns.filter((n) => n % 5 === 0).length, mean: 1.158956, sd: 0.894626, beta: 0.003130 },
  { key: 'decades', of: (ns) => new Set(ns.map((n) => Math.floor((n - 1) / 10))).size, mean: 3.743772, sd: 0.701342, beta: 0.015297 },
]

// 예측 log(당첨자 수 / 판매액). 낮을수록 남들이 덜 고르는 조합이다.
export function popularityScore(numbers: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b)
  let score = INTERCEPT
  for (const f of FEATURES) score += ((f.of(sorted) - f.mean) / f.sd) * f.beta
  return score
}

// 무작위 조합 100만 개를 이 모델로 채점한 분포 (실측).
// 점수 자체는 log 당첨자 비율이라 그대로 보여줘도 뜻이 전달되지 않아 백분위로 바꾼다.
const SCORE_MEAN = -11.625208
const SCORE_SD = 0.062456

// 0 = 가장 덜 인기, 100 = 가장 인기.
// 같은 100만 표본으로 정규근사를 검증했다: 표준화 분위가 p5 -1.723(정규 -1.645),
// p50 0.018(0.000), p95 1.574(1.645) — 꼬리에서 z 기준 0.08 쯤 벌어지고 백분위로는 2점 안쪽이다.
export function popularityPercentile(numbers: number[]) {
  const z = (popularityScore(numbers) - SCORE_MEAN) / SCORE_SD
  // 정규 누적분포의 로지스틱 근사
  const p = 1 / (1 + Math.exp(-1.702 * z))
  return Math.round(Math.min(Math.max(p, 0), 1) * 100)
}
