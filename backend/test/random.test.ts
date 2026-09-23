import { describe, expect, it } from 'vitest'
import { buildGeneratedSets } from '../src/algorithms/lotto'
import { buildPensionRecommendations } from '../src/algorithms/pension'
import { runLottoBacktest } from '../src/services/lotto-backtest'
import { runPensionBacktest } from '../src/services/pension-backtest'
import { createSeededRandom } from '../src/utils/random'
import { buildPseudoDraws } from './helpers'

describe('createSeededRandom', () => {
  it('같은 시드면 같은 수열, [0, 1) 범위', () => {
    const a = createSeededRandom(7)
    const b = createSeededRandom(7)
    const seqA = Array.from({ length: 1000 }, a)
    expect(Array.from({ length: 1000 }, b)).toEqual(seqA)
    expect(seqA.every((value) => value >= 0 && value < 1)).toBe(true)
    expect(Array.from({ length: 1000 }, createSeededRandom(8))).not.toEqual(seqA)
  })
})

describe('시드 주입', () => {
  const draws = buildPseudoDraws(80, 31)
  const pensionRows = Array.from({ length: 60 }, (_, i) => ({ draw_no: i + 1, winning_number: String(100000 + i * 7919).slice(-6) }))

  it('추천 세트는 같은 시드면 같다', () => {
    expect(buildGeneratedSets(draws, createSeededRandom(1))).toEqual(buildGeneratedSets(draws, createSeededRandom(1)))
    expect(buildPensionRecommendations(['123456'], createSeededRandom(1))).toEqual(buildPensionRecommendations(['123456'], createSeededRandom(1)))
  })

  it('백테스트는 기본 시드로 재현된다', () => {
    expect(runLottoBacktest(draws, 30)).toEqual(runLottoBacktest(draws, 30))
    expect(runPensionBacktest(pensionRows, 30)).toEqual(runPensionBacktest(pensionRows, 30))
  })

  it('다른 시드를 주입하면 결과가 달라질 수 있다', () => {
    expect(runLottoBacktest(draws, 30, createSeededRandom(1))).not.toEqual(runLottoBacktest(draws, 30, createSeededRandom(2)))
  })
})
