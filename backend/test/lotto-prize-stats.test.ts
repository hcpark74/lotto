import { describe, expect, it } from 'vitest'
import { parsePrizeStats, toLottoResultRecord } from '../src/clients/lotto/results'
import type { LottoHistoryItem } from '../src/types/lotto'

// 2026-09-26 동행복권 응답(1243회) 실측값
const item: LottoHistoryItem = {
  ltEpsd: 1243, ltRflYmd: '20260926',
  tm1WnNo: 9, tm2WnNo: 18, tm3WnNo: 24, tm4WnNo: 38, tm5WnNo: 43, tm6WnNo: 44, bnsWnNo: 35,
  rnk1WnAmt: 2592525282,
  rnk1WnNope: 12, rnk2WnNope: 115, rnk3WnNope: 3591, rnk4WnNope: 174306, rnk5WnNope: 2853501,
  rnk1SumWnAmt: 31110303384, rnk2SumWnAmt: 5185050655, rnk3SumWnAmt: 5185052082,
  rnk4SumWnAmt: 8715300000, rnk5SumWnAmt: 14267505000,
  rlvtEpsdSumNtslAmt: 64463211121,
  winType1: 10, winType2: 2, winType3: 0,
}

describe('parsePrizeStats', () => {
  it('실측 응답을 그대로 옮긴다', () => {
    const stats = parsePrizeStats(item)
    expect(stats).not.toBeNull()
    expect(stats!.rnk1WnNope).toBe(12)
    expect(stats!.rnk5WnNope).toBe(2853501)
    expect(stats!.salesAmount).toBe(64463211121)
    expect(stats!.winType1 + stats!.winType2 + stats!.winType3).toBe(stats!.rnk1WnNope)
  })

  // 추첨 직후에는 등위 집계가 아직 없다. 개별 값이 0 인 건 정상이라 판매액으로 판별한다.
  it('판매액이 없으면 집계 전으로 보고 null', () => {
    expect(parsePrizeStats({ ...item, rlvtEpsdSumNtslAmt: undefined })).toBeNull()
    expect(parsePrizeStats({ ...item, rlvtEpsdSumNtslAmt: 0 })).toBeNull()
  })

  it('판매액이 있으면 등위가 0 이어도 집계로 본다 (1등 없는 회차)', () => {
    const stats = parsePrizeStats({ ...item, rnk1WnNope: 0, rnk1SumWnAmt: 0 })
    expect(stats).not.toBeNull()
    expect(stats!.rnk1WnNope).toBe(0)
  })

  it('이상한 값은 0 으로 떨어뜨린다', () => {
    const stats = parsePrizeStats({ ...item, rnk3WnNope: -1 })
    expect(stats!.rnk3WnNope).toBe(0)
  })
})

describe('toLottoResultRecord', () => {
  it('번호와 집계를 함께 담는다', () => {
    const record = toLottoResultRecord(item)
    expect(record).not.toBeNull()
    expect(record!.drwNo).toBe(1243)
    expect(record!.drwNoDate).toBe('2026-09-26')
    expect(record!.prizeStats?.salesAmount).toBe(64463211121)
  })

  it('집계 전이면 prizeStats 만 null 이고 번호는 저장한다', () => {
    const record = toLottoResultRecord({ ...item, rlvtEpsdSumNtslAmt: 0 })
    expect(record!.drwNo).toBe(1243)
    expect(record!.prizeStats).toBeNull()
  })

  it('날짜 형식이 틀리면 건너뛴다', () => {
    expect(toLottoResultRecord({ ...item, ltRflYmd: '2026-09-26' })).toBeNull()
  })

  it('번호가 범위를 벗어나면 건너뛴다', () => {
    expect(toLottoResultRecord({ ...item, tm1WnNo: 46 })).toBeNull()
  })
})
