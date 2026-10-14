import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/algorithms/google-token', () => ({ verifyGoogleIdToken: vi.fn() }))
vi.mock('../src/queries/accounts', () => ({
  getAccountQuery: vi.fn(),
  createAccountQuery: vi.fn(),
  touchAccountQuery: vi.fn(),
}))
vi.mock('../src/queries/transfer-codes', () => ({ reassignSavedPicksQuery: vi.fn() }))

const { signInWithGoogle } = await import('../src/services/auth')
const { verifyGoogleIdToken } = await import('../src/algorithms/google-token')
const { getAccountQuery, createAccountQuery, touchAccountQuery } = await import('../src/queries/accounts')
const { reassignSavedPicksQuery } = await import('../src/queries/transfer-codes')

const verify = vi.mocked(verifyGoogleIdToken)
const getAccount = vi.mocked(getAccountQuery)
const createAccount = vi.mocked(createAccountQuery)
const touch = vi.mocked(touchAccountQuery)
const reassign = vi.mocked(reassignSavedPicksQuery)

const db = {} as D1Database
const AUD = 'aud.apps.googleusercontent.com'
const DEVICE = 'devicecccccccccccc'
const ACCOUNT = 'accountaaaaaaaaaaa'
const NOW = new Date('2026-10-14T12:00:00.000Z')

describe('signInWithGoogle', () => {
  beforeEach(() => {
    verify.mockReset().mockResolvedValue({ sub: 'google-sub-1' })
    getAccount.mockReset().mockResolvedValue(null)
    createAccount.mockReset().mockResolvedValue(undefined)
    touch.mockReset().mockResolvedValue(undefined)
    reassign.mockReset().mockResolvedValue(0)
  })

  // 로그인 전에 저장해 둔 번호가 사라지면 안 된다. 그래서 첫 로그인은
  // 지금 기기의 식별자를 계정 것으로 삼는다 — 옮길 필요 자체가 없어진다.
  it('첫 로그인은 지금 기기 식별자를 계정 것으로 삼는다', async () => {
    const r = await signInWithGoogle(db, 'tok', AUD, DEVICE, NOW)

    expect(r).toEqual({ clientId: DEVICE, movedCount: 0, created: true })
    expect(createAccount).toHaveBeenCalledWith(db, expect.objectContaining({ google_sub: 'google-sub-1', client_id: DEVICE }))
    expect(reassign).not.toHaveBeenCalled()
  })

  it('다른 기기에서 로그인하면 계정 식별자를 돌려주고 이 기기 저장분을 합친다', async () => {
    getAccount.mockResolvedValue({ google_sub: 'google-sub-1', client_id: ACCOUNT, created_at: '', last_seen_at: '' })
    reassign.mockResolvedValue(3)

    const r = await signInWithGoogle(db, 'tok', AUD, DEVICE, NOW)

    expect(r).toEqual({ clientId: ACCOUNT, movedCount: 3, created: false })
    expect(reassign).toHaveBeenCalledWith(db, DEVICE, ACCOUNT)
  })

  it('이미 계정 식별자를 쓰고 있으면 옮기지 않는다', async () => {
    getAccount.mockResolvedValue({ google_sub: 'google-sub-1', client_id: DEVICE, created_at: '', last_seen_at: '' })

    const r = await signInWithGoogle(db, 'tok', AUD, DEVICE, NOW)

    expect(r).toEqual({ clientId: DEVICE, movedCount: 0, created: false })
    expect(reassign).not.toHaveBeenCalled()
  })

  it('토큰 검증에 audience 를 그대로 넘긴다', async () => {
    await signInWithGoogle(db, 'tok', AUD, DEVICE, NOW)
    expect(verify).toHaveBeenCalledWith('tok', AUD, NOW.getTime())
  })

  // 검증이 실패했는데 계정이 만들어지면 남의 보관함을 만들어 줄 수 있다
  it('토큰이 거부되면 아무것도 건드리지 않는다', async () => {
    verify.mockRejectedValue(new Error('서명이 올바르지 않습니다.'))

    await expect(signInWithGoogle(db, 'bad', AUD, DEVICE, NOW)).rejects.toThrow()
    expect(getAccount).not.toHaveBeenCalled()
    expect(createAccount).not.toHaveBeenCalled()
    expect(reassign).not.toHaveBeenCalled()
  })

  it('기기 식별자가 형식에 안 맞으면 검증 전에 막는다', async () => {
    await expect(signInWithGoogle(db, 'tok', AUD, 'short', NOW)).rejects.toThrow(/기기 식별자/)
    expect(verify).not.toHaveBeenCalled()
  })

  it('로그인할 때마다 마지막 접속 시각을 남긴다', async () => {
    getAccount.mockResolvedValue({ google_sub: 'google-sub-1', client_id: ACCOUNT, created_at: '', last_seen_at: '' })
    await signInWithGoogle(db, 'tok', AUD, DEVICE, NOW)
    expect(touch).toHaveBeenCalledWith(db, 'google-sub-1', NOW.toISOString())
  })
})
