import { describe, expect, it } from 'vitest'
import { POPULARITY_CANDIDATES, buildGeneratedSets } from '../src/algorithms/lotto'
import { POPULARITY_MODEL_VERSION, popularityPercentile, popularityScore } from '../src/algorithms/popularity'
import { createSeededRandom } from '../src/utils/random'

const draws = Array.from({ length: 120 }, (_, i) => ({
  drwNo: i + 1,
  drwtNo1: ((i * 7) % 40) + 1, drwtNo2: ((i * 11) % 40) + 2, drwtNo3: ((i * 13) % 40) + 3,
  drwtNo4: ((i * 17) % 40) + 4, drwtNo5: ((i * 19) % 40) + 5, drwtNo6: ((i * 23) % 40) + 6,
})).map((d) => {
  // 중복이 생기면 백테스트 유틸과 어긋나므로 6개가 서로 다르게 보정한다
  const seen = new Set<number>()
  const cols = ['drwtNo1', 'drwtNo2', 'drwtNo3', 'drwtNo4', 'drwtNo5', 'drwtNo6'] as const
  for (const c of cols) {
    let v = ((d[c] - 1) % 45) + 1
    while (seen.has(v)) v = (v % 45) + 1
    seen.add(v)
    d[c] = v
  }
  return d
})

describe('popularityScore', () => {
  it('번호 순서에 영향받지 않는다', () => {
    expect(popularityScore([3, 11, 19, 24, 38, 44])).toBeCloseTo(popularityScore([44, 19, 3, 38, 24, 11]), 12)
  })

  // 1~12(월·일)가 많은 조합이 가장 센 인기 신호다. 계수 0.054 로 다른 특징의 2배 이상이다.
  it('생일 범위에 몰린 조합을 더 인기 있다고 본다', () => {
    const birthday = popularityScore([1, 2, 3, 7, 11, 12])
    const high = popularityScore([33, 35, 37, 40, 43, 45])
    expect(birthday).toBeGreaterThan(high)
  })

  it('백분위는 0~100 이고 무작위 조합의 중앙은 50 근처다', () => {
    const random = createSeededRandom(4242)
    const pcts: number[] = []
    for (let i = 0; i < 4000; i++) {
      const pool = new Set<number>()
      while (pool.size < 6) pool.add(1 + Math.floor(random() * 45))
      const p = popularityPercentile([...pool])
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
      pcts.push(p)
    }
    const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length
    expect(mean).toBeGreaterThan(45)
    expect(mean).toBeLessThan(55)
  })

  it('모델 버전이 박혀 있다', () => {
    expect(POPULARITY_MODEL_VERSION).toBe('p1')
  })
})

describe('buildGeneratedSets 의 인기 회피', () => {
  // 후보를 모아 그중 최저 인기를 고르므로, 끈 경우(후보 1개)보다 백분위가 낮아야 한다.
  it('후보를 늘리면 인기 백분위가 내려간다', () => {
    const mean = (candidates: number) => {
      const random = createSeededRandom(777)
      const pcts: number[] = []
      for (let i = 0; i < 40; i++) {
        for (const set of buildGeneratedSets(draws, random, undefined, candidates)) {
          pcts.push(set.meta!.popularityPercentile)
        }
      }
      return pcts.reduce((a, b) => a + b, 0) / pcts.length
    }

    const off = mean(1)
    const on = mean(POPULARITY_CANDIDATES)
    expect(on).toBeLessThan(off - 15)
  })

  it('모든 세트가 백분위를 담는다', () => {
    const sets = buildGeneratedSets(draws, createSeededRandom(5))
    expect(sets).toHaveLength(5)
    for (const set of sets) {
      expect(set.meta?.popularityPercentile).toBeTypeOf('number')
      expect(new Set(set.numbers).size).toBe(6)
    }
  })

  // 회차 데이터가 없을 때의 폴백도 meta 를 채워야 화면이 깨지지 않는다
  it('회차가 없어도 백분위가 들어간다', () => {
    for (const set of buildGeneratedSets([], createSeededRandom(9))) {
      expect(set.meta?.popularityPercentile).toBeTypeOf('number')
    }
  })
})
