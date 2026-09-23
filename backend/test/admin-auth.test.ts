import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/lotto', () => ({
  syncLatestLottoResults: vi.fn(async () => ({ syncedCount: 0, nextDrwNo: 2, latestDraw: 1 })),
  generateLottoSetsFromDb: vi.fn(async () => ({ sets: [], algorithm: 'test' })),
  getHotNumbersFromDb: vi.fn(),
  getLottoResultByDrawNo: vi.fn(),
  getRecentLottoResults: vi.fn(),
  runLottoBacktestFromDb: vi.fn(),
}))
vi.mock('../src/services/pension', () => ({
  syncPensionResults: vi.fn(async () => ({ syncedCount: 0, latestDraw: 1, nextDrawNo: 2, pendingPrizeDrawNos: [] })),
  generatePensionSets: vi.fn(),
  getPensionResultByDrawNo: vi.fn(),
  getRecentPensionResults: vi.fn(),
  runPensionBacktestFromDb: vi.fn(),
}))

const { default: worker } = await import('../src/index')
const { timingSafeEqualString } = await import('../src/utils/admin-auth')
const { syncLatestLottoResults, generateLottoSetsFromDb } = await import('../src/services/lotto')
const { syncPensionResults } = await import('../src/services/pension')

const TOKEN = 'test-admin-token'
const ctx = {} as ExecutionContext

// adminToken 이 null 이면 서버에 ADMIN_TOKEN 이 설정되지 않은 환경
function call(path: string, init: RequestInit = {}, adminToken: string | null = TOKEN) {
  const env = { DB: {} as D1Database, ADMIN_TOKEN: adminToken ?? undefined }
  return worker.fetch(new Request(`http://localhost${path}`, { method: 'POST', ...init }), env, ctx)
}

describe('timingSafeEqualString', () => {
  it('같으면 true, 다르거나 길이가 달라도 false', async () => {
    expect(await timingSafeEqualString('abc', 'abc')).toBe(true)
    expect(await timingSafeEqualString('abc', 'abd')).toBe(false)
    expect(await timingSafeEqualString('abc', 'abcd')).toBe(false)
    expect(await timingSafeEqualString('', 'abc')).toBe(false)
  })
})

describe.each([
  ['/api/sync', () => vi.mocked(syncLatestLottoResults)],
  ['/api/pension/sync', () => vi.mocked(syncPensionResults)],
])('POST %s 토큰 보호', (path, service) => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    service().mockClear()
  })

  it('Authorization 이 없으면 401', async () => {
    const res = await call(path)
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect(await res.json()).toEqual({ success: false, error: '인증이 필요합니다.' })
    expect(service()).not.toHaveBeenCalled()
  })

  it('토큰이 틀리면 401', async () => {
    const res = await call(path, { headers: { Authorization: 'Bearer wrong' } })
    expect(res.status).toBe(401)
    expect(service()).not.toHaveBeenCalled()
  })

  it('Bearer 형식이 아니면 401', async () => {
    const res = await call(path, { headers: { Authorization: TOKEN } })
    expect(res.status).toBe(401)
  })

  it('서버에 ADMIN_TOKEN 이 없으면 어떤 토큰이든 401 (fail closed)', async () => {
    const res = await call(path, { headers: { Authorization: 'Bearer ' } }, null)
    expect(res.status).toBe(401)
    const res2 = await call(path, { headers: { Authorization: `Bearer ${TOKEN}` } }, null)
    expect(res2.status).toBe(401)
    expect(service()).not.toHaveBeenCalled()
  })

  it('토큰이 맞으면 sync 실행', async () => {
    const res = await call(path, { headers: { Authorization: `Bearer ${TOKEN}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(service()).toHaveBeenCalledOnce()
  })
})

describe('보호 대상이 아닌 엔드포인트', () => {
  it('POST /api/generate 는 토큰 없이 동작', async () => {
    const res = await call('/api/generate', {}, null)
    expect(res.status).toBe(200)
    expect(vi.mocked(generateLottoSetsFromDb)).toHaveBeenCalled()
  })
})
