// HTTP API 응답 타입. 프론트엔드가 `import type` 으로 직접 가져가는 파일이므로
// 다른 모듈(D1Database, Workers 타입, 백엔드 내부 타입)을 import 하지 않는다.
// 응답 JSON 형태를 바꾸면 이 파일도 함께 바꾼다.

// ── 공통 ────────────────────────────────────────────────

// 대부분의 오류 응답 (4xx/5xx)
export type ApiErrorResponse = {
  error: string
}

// POST /sync 계열의 오류 응답
export type SyncErrorResponse = {
  success: false
  error: string
}

export type ConfidenceInterval95 = [number, number]

// 최근 회차에서 규칙이 얼마나 맞았는지로 매긴 규칙 가중치 (로또·연금 공통)
export type RuleWeight = {
  ruleId: string
  label: string
  weight: number
  score: number
  passRate: number
  recentMatchRate: number
}

// ── 로또 6/45 ───────────────────────────────────────────

// GET /api/results (배열), GET /api/results?drwNo= (단건)
export type LottoDrawResult = {
  drwNo: number
  drwNoDate: string
  drwtNo1: number
  drwtNo2: number
  drwtNo3: number
  drwtNo4: number
  drwtNo5: number
  drwtNo6: number
  bnusNo: number
  // 1등 당첨자가 없던 회차는 0, 원본에 값이 없으면 null
  firstWinamnt: number | null
}

// GET /api/stats/hot
export type LottoHotNumber = {
  num: number
  count: number
}

export type LottoGeneratedSet = {
  label: string
  numbers: number[]
  meta?: {
    ruleId?: string
    ruleWeight?: number
    sum: number
    oddCount: number
    maxConsecutiveRun: number
    passedRules: string[]
  }
}

// POST /api/generate
export type LottoGenerateResponse = {
  sets: LottoGeneratedSet[]
  algorithm: string
  ruleWeights?: RuleWeight[]
}

export type LottoRulePerformance = {
  ruleId: string
  label: string
  generatedCount: number
  averageMatches: number
  zScore: number
  ci95: ConfidenceInterval95
  commonRulePassRate: number
  relaxedFallbackRate: number
  randomFallbackRate: number
}

// GET /api/generate/backtest?draws=
export type LottoBacktestResponse = {
  algorithm: string
  evaluatedDraws: number
  setsPerDraw: number
  totalGeneratedSets: number
  averageMatchPerSet: number
  averageBestMatchPerDraw: number
  // 5장을 합쳐 실제로 몇 칸을 덮는가. 세트 간 번호가 겹치면 줄어든다.
  coverage: {
    averageDistinctNumbers: number
    maxDistinctNumbers: number
  }
  // 회차마다 5세트 중 최고 일치가 k 이상이었던 비율 (세트 단위인 setHitRate 와 다르다)
  drawHitRate: {
    best3Plus: number
    best4Plus: number
  }
  baseline: {
    theoretical: {
      expectedMatchPerSet: number
      matchStdPerSet: number
      matchProbabilities: Record<number, number>
      expectedHitDistribution: Record<number, number>
    }
    randomControl: {
      totalSets: number
      averageMatchPerSet: number
      averageBestMatchPerDraw: number
      averageDistinctNumbers: number
      best3PlusRate: number
      hitDistribution: Record<number, number>
      zScore: number
      ci95: ConfidenceInterval95
    }
    // 번호가 겹치지 않는 5세트(30개 전부 다름). 커버리지를 넓혔을 때의 상한선이다.
    disjointControl: {
      averageBestMatchPerDraw: number
      best3PlusRate: number
    }
    overall: {
      zScore: number
      ci95: ConfidenceInterval95
      significant: boolean
    }
  }
  generationQuality: {
    commonRulePassRate: number
    relaxedFallbackRate: number
    randomFallbackRate: number
  }
  setHitRate: {
    match3Plus: number
    match4Plus: number
    match5Plus: number
    match5PlusBonus: number
  }
  hitDistribution: Record<number, number>
  bestHitDistribution: Record<number, number>
  ruleDiagnostics: {
    currentWeights: RuleWeight[]
    performance: LottoRulePerformance[]
  }
}

export type LottoSyncSummary = {
  syncedCount: number
  latestDraw: number
  nextDrwNo: number
}

// POST /api/sync (성공). 실패는 SyncErrorResponse
export type LottoSyncResponse = LottoSyncSummary & { success: true }

// ── 연금복권 720+ ──────────────────────────────────────

// GET /api/pension/results (배열)
export type PensionDrawResult = {
  draw_no: number
  draw_date: string
  winning_band: string
  winning_number: string
  bonus_number: string
  synced_at: string
}

export type PensionPrizeCount = {
  rank_no: number
  internet_count: number
  store_count: number
  total_count: number
  win_amount: number | null
  total_amount: number | null
}

// GET /api/pension/results?drawNo= (단건)
export type PensionDrawDetail = PensionDrawResult & {
  prize_counts: PensionPrizeCount[]
}

export type PensionRecommendationSet = {
  label: string
  number: string
  meta: {
    ruleId?: string
    ruleWeight?: number
    sum: number
    oddCount: number
    uniqueDigitCount: number
    maxDuplicateCount: number
    hasThreeConsecutive: boolean
  }
}

export type PensionRules = {
  sumRange: string
  oddCountRange: string
  minUniqueDigits: number
  noThreeConsecutive: boolean
  maxDuplicateCount: number
  setProfiles?: string[]
  fallback?: string[]
}

// POST /api/pension/generate
export type PensionGenerateResponse = {
  sets: PensionRecommendationSet[]
  algorithm: string
  rules: PensionRules
  ruleWeights?: RuleWeight[]
}

// 점수 = 1등 번호와 끝자리부터 연속으로 일치한 자리 수 (0~6). 연금복권720+ 등위 기준과 같다.
// 3+ = 5등 이상, 4+ = 4등 이상
export type PensionRulePerformance = {
  ruleId: string
  label: string
  generatedCount: number
  averageMatches: number
  zScore: number
  ci95: ConfidenceInterval95
  match3PlusRate: number
  match4PlusRate: number
}

// 등위별 적중 세트 수. 추천 번호는 조를 고르지 않으므로 6자리 일치는 rank2 에 센다
// (조까지 맞으면 1등). bonus 는 보너스 번호와 6자리가 모두 일치한 세트 수.
export type PensionRankHits = {
  rank2: number
  rank3: number
  rank4: number
  rank5: number
  rank6: number
  rank7: number
  bonus: number
}

// GET /api/pension/generate/backtest?draws=
// hitDistribution 등의 키는 끝자리 연속 일치 수 (0~6)
export type PensionBacktestResponse = {
  algorithm: string
  evaluatedDraws: number
  setsPerDraw: number
  totalGeneratedSets: number
  averageMatchPerSet: number
  averageBestMatchPerDraw: number
  baseline: {
    theoretical: {
      // 무작위 기대값 0.1111, 표준편차 0.3514
      expectedMatchPerSet: number
      matchStdPerSet: number
      // P(정확히 끝 k자리) = 0.9·0.1^k (k<6), P(6) = 10^-6
      matchProbabilities: Record<number, number>
      expectedHitDistribution: Record<number, number>
    }
    randomControl: {
      totalSets: number
      averageMatchPerSet: number
      hitDistribution: Record<number, number>
      zScore: number
      ci95: ConfidenceInterval95
    }
    overall: {
      zScore: number
      ci95: ConfidenceInterval95
      significant: boolean
    }
  }
  hitDistribution: Record<number, number>
  bestHitDistribution: Record<number, number>
  rankHits: PensionRankHits
  ruleDiagnostics: {
    currentWeights: RuleWeight[]
    performance: PensionRulePerformance[]
  }
}

export type PensionSyncSummary = {
  syncedCount: number
  latestDraw: number
  nextDrawNo: number
  // 당첨 통계를 아직 다 받지 못해 다음 sync 에서 재시도할 회차
  pendingPrizeDrawNos: number[]
}

// POST /api/pension/sync (성공). 실패는 SyncErrorResponse
export type PensionSyncResponse = PensionSyncSummary & { success: true }
