import type { DrawNumbersRow } from '../src/types/lotto'

export function toRow(numbers: number[], drwNo?: number): DrawNumbersRow {
  const [drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6] = numbers
  return { drwNo, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo: 45 }
}

// 선형 합동 생성기로 결정적인 가짜 회차를 만든다.
export function buildPseudoDraws(count: number, seedBase = 17): DrawNumbersRow[] {
  return Array.from({ length: count }, (_, i) => {
    const picked = new Set<number>()
    let seed = i * 7919 + seedBase
    while (picked.size < 6) {
      seed = (seed * 1103515245 + 12345) % 2147483648
      picked.add((seed % 45) + 1)
    }
    return toRow(Array.from(picked).sort((a, b) => a - b), i + 1)
  })
}
