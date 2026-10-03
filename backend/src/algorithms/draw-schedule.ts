// 저장된 최신 회차가 "지금쯤 있어야 할 회차"보다 뒤처졌는지 판단한다.
// 이 판단이 있어야 새로고침이 평소에는 외부 요청을 아예 쓰지 않는다 —
// 다음 추첨 시각이 지나지 않았으면 받아올 것도 없기 때문이다.
//
// 추첨 시각 (dhlottery.co.kr, 2026-09 확인):
//   로또6/45   매주 토요일 20:35 KST
//   연금720+   매주 목요일 19:05 KST
import type { Lottery } from '../types/saved-picks'

const KST_OFFSET_MINUTES = 9 * 60

type Schedule = { weekday: number; hour: number; minute: number }

// weekday 는 KST 기준 요일 (0=일 … 6=토). Date#getUTCDay 와 같은 체계다.
const SCHEDULES: Record<Lottery, Schedule> = {
  lotto: { weekday: 6, hour: 20, minute: 35 },
  pension: { weekday: 4, hour: 19, minute: 5 },
}

// 동행복권이 추첨 직후 바로 올리지 않는다. 2026-10-03 1244회는 추첨 20:35 뒤
// 21:18 에도 없었고 22:13 에 올라왔다. 그 전에 조르지 않도록 여유를 둔다.
export const PUBLISH_GRACE_MINUTES = 60

function toKst(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MINUTES * 60_000)
}

function fromKst(kst: Date) {
  return new Date(kst.getTime() - KST_OFFSET_MINUTES * 60_000)
}

// 주어진 시점 기준으로 가장 최근에 지나간 추첨 시각 (KST 달력으로 계산해 UTC 로 돌려준다)
export function lastDrawTime(lottery: Lottery, now: Date): Date {
  const { weekday, hour, minute } = SCHEDULES[lottery]
  const kst = toKst(now)

  const candidate = new Date(kst)
  candidate.setUTCHours(hour, minute, 0, 0)
  // 이번 주의 해당 요일로 맞춘 뒤, 아직 안 지났으면 한 주 뒤로 물린다
  candidate.setUTCDate(candidate.getUTCDate() + ((weekday - candidate.getUTCDay() + 7) % 7))
  if (candidate > kst) candidate.setUTCDate(candidate.getUTCDate() - 7)

  return fromKst(candidate)
}

// 저장된 최신 회차의 추첨일(YYYY-MM-DD) 이 마지막 추첨보다 이전이면 뒤처진 것이다.
// 유예 시간이 지나기 전에는 뒤처졌다고 보지 않는다 — 어차피 발표 전이다.
export function isBehindSchedule(lottery: Lottery, latestStoredDate: string | null, now: Date) {
  const last = lastDrawTime(lottery, now)
  if (now.getTime() < last.getTime() + PUBLISH_GRACE_MINUTES * 60_000) return false
  if (!latestStoredDate) return true

  // 저장된 날짜도 KST 달력 기준이므로 같은 기준으로 비교한다
  const storedDay = latestStoredDate.slice(0, 10)
  const lastDay = toKst(last).toISOString().slice(0, 10)
  return storedDay < lastDay
}
