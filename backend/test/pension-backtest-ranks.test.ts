import { describe, expect, it, vi } from 'vitest'

// 추천 결과를 고정 번호 1세트로 바꿔 등위·보너스 집계를 정확히 검증한다
vi.mock('../src/algorithms/pension', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/algorithms/pension')>()),
  buildPensionRecommendations: () => [{
    label: '고정',
    number: '123456',
    meta: { ruleId: 'fixed', sum: 21, oddCount: 3, uniqueDigitCount: 6, maxDuplicateCount: 1, hasThreeConsecutive: true },
  }],
}))

const { runPensionBacktest } = await import('../src/services/pension-backtest')

describe('연금 백테스트 등위 집계', () => {
  it('끝자리 연속 일치 수로 등위를 매기고, 보너스는 따로 센다', () => {
    // 학습 구간 30회 뒤의 10회가 평가 대상
    const targets = [
      { winning_number: '123456', bonus_number: '000000' }, // 6자리 → 2등
      { winning_number: '923456', bonus_number: '000000' }, // 5자리 → 3등
      { winning_number: '000056', bonus_number: '000000' }, // 2자리 → 6등
      { winning_number: '123450', bonus_number: '123456' }, // 낙첨 + 보너스
      { winning_number: '123455', bonus_number: '000000' }, // 끝자리가 달라 낙첨 (자리별로는 5개 일치)
      ...Array.from({ length: 5 }, () => ({ winning_number: '000000', bonus_number: '000000' })),
    ]
    const rows = [
      ...Array.from({ length: 30 }, (_, i) => ({ draw_no: i + 1, winning_number: '000000', bonus_number: '000000' })),
      ...targets.map((target, i) => ({ draw_no: 31 + i, ...target })),
    ]

    const summary = runPensionBacktest(rows, 10)

    expect(summary.rankHits).toEqual({ rank2: 1, rank3: 1, rank4: 0, rank5: 0, rank6: 1, rank7: 0, bonus: 1 })
    expect(summary.hitDistribution).toEqual({ 0: 7, 1: 0, 2: 1, 3: 0, 4: 0, 5: 1, 6: 1 })
    expect(summary.averageMatchPerSet).toBe(1.3)
  })
})
