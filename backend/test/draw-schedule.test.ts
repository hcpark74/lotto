import { describe, expect, it } from 'vitest'
import {
  drawTimeOf,
  isBehindSchedule,
  lastDrawTime,
  nextDrawTime,
  projectDrawDate,
  PUBLISH_GRACE_MINUTES,
  upcomingDraw,
} from '../src/algorithms/draw-schedule'

// KST 시각을 UTC Date 로. 테스트를 KST 로 읽히게 하려는 도우미다.
const kst = (s: string) => new Date(`${s}+09:00`)

describe('lastDrawTime', () => {
  // 1244회 추첨: 2026-10-03(토) 20:35 KST
  it('로또는 직전 토요일 20:35 을 가리킨다', () => {
    expect(lastDrawTime('lotto', kst('2026-10-03T22:00')).toISOString()).toBe('2026-10-03T11:35:00.000Z')
    expect(lastDrawTime('lotto', kst('2026-10-04T01:00')).toISOString()).toBe('2026-10-03T11:35:00.000Z')
    // 추첨 직전이면 한 주 전 추첨이 마지막이다
    expect(lastDrawTime('lotto', kst('2026-10-03T20:00')).toISOString()).toBe('2026-09-26T11:35:00.000Z')
  })

  it('연금은 직전 목요일 19:05 을 가리킨다', () => {
    expect(lastDrawTime('pension', kst('2026-10-03T22:00')).toISOString()).toBe('2026-10-01T10:05:00.000Z')
    expect(lastDrawTime('pension', kst('2026-10-01T18:00')).toISOString()).toBe('2026-09-24T10:05:00.000Z')
  })

  // KST 로 토요일 밤이면 UTC 로는 아직 토요일 낮이다. 요일 계산이 UTC 로 새면 한 주 밀린다.
  it('자정을 넘겨도 KST 달력으로 센다', () => {
    expect(lastDrawTime('lotto', kst('2026-10-04T00:30')).toISOString()).toBe('2026-10-03T11:35:00.000Z')
  })
})

describe('isBehindSchedule', () => {
  const now = kst('2026-10-04T01:00')

  it('마지막 추첨 회차가 없으면 뒤처진 것', () => {
    expect(isBehindSchedule('lotto', '2026-09-26', now)).toBe(true)
  })

  it('이미 받아왔으면 뒤처지지 않은 것', () => {
    expect(isBehindSchedule('lotto', '2026-10-03', now)).toBe(false)
  })

  // 추첨 직후에는 동행복권이 아직 안 올린다. 조르지 않는다.
  it('유예 시간 안에는 뒤처졌다고 보지 않는다', () => {
    const justAfter = kst('2026-10-03T20:40')
    expect(isBehindSchedule('lotto', '2026-09-26', justAfter)).toBe(false)

    const afterGrace = new Date(kst('2026-10-03T20:35').getTime() + (PUBLISH_GRACE_MINUTES + 1) * 60_000)
    expect(isBehindSchedule('lotto', '2026-09-26', afterGrace)).toBe(true)
  })

  it('추첨 전이면 지난 회차만 있어도 뒤처지지 않은 것', () => {
    expect(isBehindSchedule('lotto', '2026-09-26', kst('2026-10-02T12:00'))).toBe(false)
  })

  it('저장된 회차가 아예 없으면 뒤처진 것', () => {
    expect(isBehindSchedule('lotto', null, now)).toBe(true)
  })

  it('연금도 같은 규칙', () => {
    expect(isBehindSchedule('pension', '2026-09-24', kst('2026-10-01T21:00'))).toBe(true)
    expect(isBehindSchedule('pension', '2026-10-01', kst('2026-10-01T21:00'))).toBe(false)
    expect(isBehindSchedule('pension', '2026-09-24', kst('2026-10-01T19:30'))).toBe(false)
  })
})

describe('nextDrawTime', () => {
  it('아직 열리지 않은 가장 가까운 추첨을 가리킨다', () => {
    expect(nextDrawTime('lotto', kst('2026-10-03T20:00')).toISOString()).toBe('2026-10-03T11:35:00.000Z')
    expect(nextDrawTime('lotto', kst('2026-10-03T20:36')).toISOString()).toBe('2026-10-10T11:35:00.000Z')
    expect(nextDrawTime('pension', kst('2026-10-03T22:00')).toISOString()).toBe('2026-10-08T10:05:00.000Z')
  })
})

describe('projectDrawDate', () => {
  const latest = { drawNo: 1243, date: '2026-09-26' }

  it('회차 차이만큼 7일씩 센다', () => {
    expect(projectDrawDate(latest, 1244)).toBe('2026-10-03')
    expect(projectDrawDate(latest, 1246)).toBe('2026-10-17')
    expect(projectDrawDate(latest, 1243)).toBe('2026-09-26')
  })

  it('해를 넘겨도 달력대로 센다', () => {
    expect(projectDrawDate({ drawNo: 100, date: '2026-12-26' }, 101)).toBe('2027-01-02')
  })

  it('날짜를 모르면 null', () => {
    expect(projectDrawDate({ drawNo: 1243, date: null }, 1244)).toBeNull()
    expect(projectDrawDate({ drawNo: 1243, date: '날짜 없음' }, 1244)).toBeNull()
  })
})

// 저장 대상 회차. 1243회(9/26) 까지 들어와 있고 1244회 추첨은 10/3(토) 20:35 다.
describe('upcomingDraw', () => {
  const latest = { drawNo: 1243, date: '2026-09-26' }

  it('추첨 전에는 최신 + 1', () => {
    expect(upcomingDraw('lotto', latest, kst('2026-09-28T09:00'))).toMatchObject({ drawNo: 1244, drawDate: '2026-10-03' })
    expect(upcomingDraw('lotto', latest, kst('2026-10-03T20:34'))).toMatchObject({ drawNo: 1244, drawDate: '2026-10-03' })
  })

  // 추첨은 끝났고 결과는 아직 안 들어온 사이. 여기서 1244회로 저장하면 나온 번호를 보고 담을 수 있다.
  it('추첨이 끝났는데 결과가 아직이면 그다음 회차로 건너뛴다', () => {
    expect(upcomingDraw('lotto', latest, kst('2026-10-03T20:36'))).toMatchObject({ drawNo: 1245, drawDate: '2026-10-10' })
    expect(upcomingDraw('lotto', latest, kst('2026-10-04T09:00'))).toMatchObject({ drawNo: 1245, drawDate: '2026-10-10' })
  })

  it('결과가 들어오면 다시 최신 + 1', () => {
    expect(upcomingDraw('lotto', { drawNo: 1244, date: '2026-10-03' }, kst('2026-10-03T22:30')))
      .toMatchObject({ drawNo: 1245, drawDate: '2026-10-10' })
  })

  // 동기화가 몇 주 멈춰 있어도 지난 회차로 저장되지 않는다
  it('여러 주 뒤처져 있어도 아직 열리지 않은 회차를 고른다', () => {
    expect(upcomingDraw('lotto', latest, kst('2026-10-20T12:00'))).toMatchObject({ drawNo: 1247, drawDate: '2026-10-24' })
  })

  it('연금은 목요일 19:05 기준', () => {
    const pension = { drawNo: 330, date: '2026-09-24' }
    expect(upcomingDraw('pension', pension, kst('2026-10-01T19:00'))).toMatchObject({ drawNo: 331, drawDate: '2026-10-01' })
    expect(upcomingDraw('pension', pension, kst('2026-10-01T19:06'))).toMatchObject({ drawNo: 332, drawDate: '2026-10-08' })
  })

  // 몇 주 뒤처졌는지 알 길이 없다. 예전 동작으로 물러나고 날짜는 내지 않는다.
  it('최신 회차의 날짜를 모르면 최신 + 1, 날짜 없음', () => {
    expect(upcomingDraw('lotto', { drawNo: 1243, date: null }, kst('2026-10-04T09:00')))
      .toEqual({ drawNo: 1244, drawDate: null, drawAt: null })
  })

  // 화면이 "추첨까지 얼마" 를 세는 기준
  it('추첨 시각을 함께 돌려준다', () => {
    expect(upcomingDraw('lotto', latest, kst('2026-09-28T09:00')).drawAt).toBe('2026-10-03T11:35:00.000Z')
    expect(upcomingDraw('pension', { drawNo: 330, date: '2026-09-24' }, kst('2026-09-28T09:00')).drawAt)
      .toBe('2026-10-01T10:05:00.000Z')
  })

  // 저장 대상은 아직 열리지 않은 추첨이다. 그 시각이 지금보다 앞이면 규칙이 깨진 것이다.
  it('추첨 시각은 언제나 지금보다 뒤다', () => {
    for (const at of ['2026-10-03T20:34', '2026-10-03T20:36', '2026-10-04T00:10', '2026-10-20T12:00']) {
      const now = kst(at)
      expect(new Date(upcomingDraw('lotto', latest, now).drawAt!).getTime()).toBeGreaterThan(now.getTime())
    }
  })
})

describe('drawTimeOf', () => {
  it('그 날의 추첨 시각을 UTC 로 돌려준다', () => {
    expect(drawTimeOf('lotto', '2026-10-03')).toBe('2026-10-03T11:35:00.000Z')
    expect(drawTimeOf('pension', '2026-10-01')).toBe('2026-10-01T10:05:00.000Z')
  })

  it('날짜를 모르면 null', () => {
    expect(drawTimeOf('lotto', null)).toBeNull()
    expect(drawTimeOf('lotto', '날짜 없음')).toBeNull()
  })
})
