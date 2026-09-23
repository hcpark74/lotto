import { describe, expect, it } from 'vitest'
import { isValidLottoRecord } from '../src/clients/lotto/results'
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
    ['음수 당첨금', { firstWinamnt: -1 }],
    ['당첨금 누락', { firstWinamnt: undefined }],
  ])('%s → 거부', (_label, patch) => {
    expect(isValidLottoRecord({ ...valid, ...patch } as unknown as LottoResultRecord)).toBe(false)
  })
})
