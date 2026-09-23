import { describe, expect, it, vi } from 'vitest'

// /pension/generate 는 D1 에서 최신 60회를 최신순으로 읽는다. 같은 데이터를 돌려주도록 mock 한다.
const pensionRows = Array.from({ length: 120 }, (_, i) => ({
  draw_no: i + 1,
  winning_number: String((i * 7919 + 12345) % 1_000_000).padStart(6, '0'),
}))
vi.mock('../src/queries/pension/results', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/queries/pension/results')>()),
  getRecentPensionWinningNumbersQuery: async (_db: D1Database, limit: number) =>
    pensionRows.slice().reverse().slice(0, limit).map(({ winning_number }) => ({ winning_number })),
}))

const { generateLottoSets } = await import('../src/services/lotto-generate')
const { runLottoBacktest } = await import('../src/services/lotto-backtest')
const { generatePensionSets } = await import('../src/services/pension-generate')
const { runPensionBacktest } = await import('../src/services/pension-backtest')
const { buildPseudoDraws } = await import('./helpers')

describe('백테스트 currentWeights = 같은 시점 generate 의 ruleWeights', () => {
  it('로또', () => {
    const draws = buildPseudoDraws(150, 11)
    for (const lookback of [20, 100, 120]) {
      expect(runLottoBacktest(draws, lookback).ruleDiagnostics.currentWeights).toEqual(generateLottoSets(draws).ruleWeights)
    }
  })

  it('연금', async () => {
    const generated = await generatePensionSets({} as D1Database)
    for (const lookback of [20, 60, 100]) {
      expect(runPensionBacktest(pensionRows, lookback).ruleDiagnostics.currentWeights).toEqual(generated.ruleWeights)
    }
  })
})
