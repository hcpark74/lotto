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

const WEEK_MS = 7 * 24 * 60 * 60_000

// 아직 열리지 않은 가장 가까운 추첨 시각
export function nextDrawTime(lottery: Lottery, now: Date): Date {
  return new Date(lastDrawTime(lottery, now).getTime() + WEEK_MS)
}

// 'YYYY-MM-DD' 를 날짜끼리 빼고 더하기 위한 값으로. 시각이 붙어 있어도 앞 10자만 본다.
function dayToMs(day: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

export type StoredDraw = { drawNo: number; date: string | null }

// 저장된 최신 회차에서 7일씩 세어 얻은 회차의 추첨일(KST, YYYY-MM-DD).
// 두 복권 모두 매주 같은 요일에 빠짐없이 추첨하므로 회차 차이가 곧 주 차이다.
export function projectDrawDate(latest: StoredDraw, drawNo: number) {
  const base = latest.date ? dayToMs(latest.date) : null
  if (base == null) return null
  return new Date(base + (drawNo - latest.drawNo) * WEEK_MS).toISOString().slice(0, 10)
}

// 지금 저장하면 걸리는 회차와 그 추첨일.
// "저장된 최신 회차 + 1" 이 아니다. 추첨은 끝났는데 결과가 아직 안 들어온 사이에는
// (로또라면 토 20:35 ~ 발표) 최신 + 1 이 방금 추첨한 회차라, 거기에 저장하면
// 나온 번호를 보고 담을 수 있다. 아직 열리지 않은 추첨까지 건너뛴다.
export function upcomingDraw(lottery: Lottery, latest: StoredDraw, now: Date) {
  const base = latest.date ? dayToMs(latest.date) : null
  // 날짜를 모르면 몇 주 뒤처졌는지 알 수 없다. 예전 동작(최신 + 1)으로 물러난다.
  if (base == null) return { drawNo: latest.drawNo + 1, drawDate: null }

  const nextDay = dayToMs(toKst(nextDrawTime(lottery, now)).toISOString())!
  const drawNo = latest.drawNo + Math.max(1, Math.round((nextDay - base) / WEEK_MS))
  return { drawNo, drawDate: projectDrawDate(latest, drawNo) }
}
