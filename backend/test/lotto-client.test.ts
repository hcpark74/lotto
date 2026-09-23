import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLottoResult, isValidLottoRecord, parseFirstPrizeAmount } from '../src/clients/lotto/results'
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

describe('fetchLottoResult', () => {
  const item = {
    ltEpsd: 1, ltRflYmd: '20021207',
    tm1WnNo: 10, tm2WnNo: 23, tm3WnNo: 29, tm4WnNo: 33, tm5WnNo: 37, tm6WnNo: 40,
    bnsWnNo: 16, rnk1WnAmt: 0,
  }

  function stubFetch(impl: () => Promise<Response>) {
    vi.stubGlobal('fetch', vi.fn(impl))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('정상 응답이면 레코드', async () => {
    stubFetch(async () => Response.json({ data: { list: [item] } }))
    await expect(fetchLottoResult(1)).resolves.toMatchObject({ drwNo: 1, drwNoDate: '2002-12-07', drwtNo1: 10, firstWinamnt: 0 })
  })

  it('아직 발표 전(목록에 없음)이면 null', async () => {
    stubFetch(async () => Response.json({ data: { list: [] } }))
    await expect(fetchLottoResult(1)).resolves.toBeNull()
  })

  it('검증 실패면 null', async () => {
    stubFetch(async () => Response.json({ data: { list: [{ ...item, tm6WnNo: 46 }] } }))
    await expect(fetchLottoResult(1)).resolves.toBeNull()
  })

  it('HTTP 오류는 throw', async () => {
    stubFetch(async () => new Response('busy', { status: 503 }))
    await expect(fetchLottoResult(1)).rejects.toThrow('로또 1회 조회 실패 (503)')
  })

  it('JSON 이 아닌 응답은 throw', async () => {
    stubFetch(async () => new Response('<html>점검 중</html>', { status: 200 }))
    await expect(fetchLottoResult(1)).rejects.toThrow('JSON 이 아닌 응답')
  })

  it('네트워크 오류는 throw', async () => {
    stubFetch(async () => { throw new TypeError('fetch failed') })
    await expect(fetchLottoResult(1)).rejects.toThrow('로또 1회 조회 실패 (네트워크: fetch failed)')
  })
})
