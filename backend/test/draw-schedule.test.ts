import { describe, expect, it } from 'vitest'
import { isBehindSchedule, lastDrawTime, PUBLISH_GRACE_MINUTES } from '../src/algorithms/draw-schedule'

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
