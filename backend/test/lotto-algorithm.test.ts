import { describe, expect, it } from 'vitest'
import { buildGeneratedSets, countMatches, passesCommonRules, SET_CONFIGS } from '../src/algorithms/lotto'
import { buildPseudoDraws, toRow } from './helpers'

describe('countMatches', () => {
  const draw = toRow([3, 11, 19, 27, 35, 43])

  it('전부 일치', () => {
    expect(countMatches([3, 11, 19, 27, 35, 43], draw)).toBe(6)
  })

  it('일부 일치', () => {
    expect(countMatches([3, 11, 20, 28, 36, 44], draw)).toBe(2)
  })

  it('보너스 번호는 세지 않는다', () => {
    expect(countMatches([1, 2, 4, 5, 6, 45], draw)).toBe(0)
  })
})

describe('passesCommonRules', () => {
  it('합 110~170, 홀수 2~4, 3연속 금지, 9단위 구간 3개 이상', () => {
    expect(passesCommonRules([5, 12, 23, 31, 38, 44])).toBe(true)
  })

  it('합이 110 미만이면 실패', () => {
    expect(passesCommonRules([1, 2, 4, 6, 8, 10])).toBe(false)
  })

  it('합이 170 초과면 실패', () => {
    expect(passesCommonRules([30, 32, 34, 40, 42, 45])).toBe(false)
  })

  it('홀수가 1개면 실패', () => {
    expect(passesCommonRules([2, 12, 22, 27, 32, 40])).toBe(false)
  })

  it('홀수가 5개면 실패', () => {
    expect(passesCommonRules([3, 11, 19, 27, 35, 40])).toBe(false)
  })

  it('3연속이면 실패', () => {
    expect(passesCommonRules([10, 11, 12, 25, 33, 41])).toBe(false)
  })

  it('9단위 구간이 3개 미만이면 실패', () => {
    // 19~27 한 구간(9단위 3번째 구간), 합 140, 홀수 4개, 연속 없음 → 구간 조건만 걸린다
    expect(passesCommonRules([19, 21, 23, 24, 26, 27])).toBe(false)
  })
})

describe('buildGeneratedSets', () => {
  it('데이터가 없으면 랜덤 폴백 세트를 SET_CONFIGS 수만큼 반환', () => {
    const sets = buildGeneratedSets([])
    expect(sets).toHaveLength(SET_CONFIGS.length)
    for (const set of sets) {
      expect(set.numbers).toHaveLength(6)
      expect(set.meta?.passedRules).toContain('fallback-random')
    }
  })

  it('데이터가 있으면 세트마다 6개 고유 번호를 반환', () => {
    const sets = buildGeneratedSets(buildPseudoDraws(60))
    expect(sets).toHaveLength(SET_CONFIGS.length)
    for (const set of sets) {
      expect(new Set(set.numbers).size).toBe(6)
      expect(set.numbers.every(n => n >= 1 && n <= 45)).toBe(true)
      expect(set.meta?.ruleId).toBeDefined()
    }
  })
})
