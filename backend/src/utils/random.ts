// [0, 1) 난수를 돌려주는 함수. 기본은 Math.random, 백테스트·테스트는 시드 고정 PRNG 를 주입한다.
export type RandomSource = () => number

// mulberry32. 같은 시드면 같은 수열을 돌려준다 (백테스트 재현용이며 암호학적 용도가 아니다).
export function createSeededRandom(seed: number): RandomSource {
  let state = seed | 0
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
