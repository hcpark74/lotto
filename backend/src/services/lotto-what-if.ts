import { simulateLottoHistory, type WhatIfDraw } from '../algorithms/lotto-what-if'
import { getAllLottoWhatIfRowsQuery } from '../queries/lotto'

// 전 회차를 매번 읽으면 호출 한 번이 1,200행 넘는 조회다. 토큰 없이 열려 있고 사용자가
// 번호를 바꿔 가며 연달아 부르는 경로라, isolate 안에서 잠깐 들고 있는다.
// 새 회차는 주 1회 들어오므로 10분 낡은 것은 문제가 되지 않는다.
const CACHE_TTL_MS = 10 * 60_000

let cached: { draws: WhatIfDraw[]; loadedAt: number } | null = null

async function loadDraws(db: D1Database, now: number) {
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.draws

  const draws = await getAllLottoWhatIfRowsQuery(db)
  // 빈 결과는 붙잡아 두지 않는다 (동기화 전의 빈 DB 가 10분 동안 굳는다)
  if (draws.length > 0) cached = { draws, loadedAt: now }
  return draws
}

// 테스트에서 호출 사이의 캐시를 비운다
export function resetLottoWhatIfCache() {
  cached = null
}

export async function simulateLottoPickFromDb(db: D1Database, numbers: number[], now = Date.now()) {
  const draws = await loadDraws(db, now)
  if (draws.length === 0) throw new Error('대입할 회차 데이터가 없습니다.')

  return simulateLottoHistory(numbers, draws)
}
