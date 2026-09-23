import { describe, expect, it } from 'vitest'
import { runPensionBacktest } from '../src/services/pension-backtest'

describe('runPensionBacktest', () => {
  it('규칙 가중치는 운영 추천처럼 최근 회차 기준으로 계산한다', () => {
    // 학습 구간 30회 중 가장 오래된 6회만 공통 규칙을 통과하지 못하는 번호
    const rows = Array.from({ length: 50 }, (_, i) => ({
      draw_no: i + 1,
      winning_number: i < 6 ? '000000' : '357246',
    }))

    const summary = runPensionBacktest(rows, 20)
    const balanced = summary.ruleDiagnostics.currentWeights.find((entry) => entry.ruleId === 'balanced-core')

    // 최근 24회(7~30회)는 모두 균형형을 통과한다. 오래된 24회를 쓰면 18/24 = 0.75 가 된다.
    expect(balanced?.passRate).toBe(1)
  })
})
