import { describe, expect, it } from 'vitest'
import { isValidLottoRecord, parseFirstPrizeAmount } from '../src/clients/lotto/results'
import type { LottoResultRecord } from '../src/types/lotto'

const valid: LottoResultRecord = {
  drwNo: 1,
  drwNoDate: '2002-12-07',
  drwtNo1: 10,
  drwtNo2: 23,
  drwtNo3: 29,
  drwtNo4: 33,
  drwtNo5: 37,
  drwtNo6: 40,
  bnusNo: 16,
  firstWinamnt: 0,
}

describe('isValidLottoRecord', () => {
  it('정상 회차는 통과 (1등 없음 = 0원 포함)', () => {
    expect(isValidLottoRecord(valid)).toBe(true)
  })

  it.each([
    ['범위 밖 번호', { drwtNo6: 46 }],
    ['0 번호', { drwtNo1: 0 }],
    ['중복 번호', { drwtNo2: 10 }],
    ['보너스가 당첨번호와 중복', { bnusNo: 40 }],
    ['번호 누락', { drwtNo3: undefined }],
  ])('%s → 거부', (_label, patch) => {
    expect(isValidLottoRecord({ ...valid, ...patch } as unknown as LottoResultRecord)).toBe(false)
  })

  it('당첨금이 없어도 회차는 통과 (sync 가 멈추지 않도록)', () => {
    expect(isValidLottoRecord({ ...valid, firstWinamnt: null })).toBe(true)
  })
})

describe('parseFirstPrizeAmount', () => {
  it.each([
    [2002006800, 2002006800],
    ['2002006800', 2002006800],
    [0, 0],
    [null, null],
    [undefined, null],
    ['', null],
    ['abc', null],
    [-1, null],
  ])('%s → %s', (input, expected) => {
    expect(parseFirstPrizeAmount(input)).toBe(expected)
  })
})
