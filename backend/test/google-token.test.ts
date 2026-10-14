import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetGoogleKeyCache, verifyGoogleIdToken } from '../src/algorithms/google-token'

const AUD = '1234567890-abcdef.apps.googleusercontent.com'
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)))

let keyPair: CryptoKeyPair
let jwk: JsonWebKey

beforeAll(async () => {
  // Workers 타입에서 generateKey/exportKey 는 유니온을 돌려준다
  keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair
  jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey) as JsonWebKey
})

// 구글 JWKS 를 우리가 만든 키로 바꿔치기한다
function mockJwks(kid = 'test-kid') {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ keys: [{ kid, kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' }] }),
    { status: 200 },
  )))
}

async function makeToken(payload: Record<string, unknown>, opts: { kid?: string; alg?: string; tamper?: boolean } = {}) {
  const header = enc({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'test-kid', typ: 'JWT' })
  const body = enc({
    iss: 'https://accounts.google.com',
    aud: AUD,
    sub: '101234567890',
    exp: Math.floor(NOW / 1000) + 3600,
    iat: Math.floor(NOW / 1000) - 10,
    ...payload,
  })
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${header}.${body}`)))
  if (opts.tamper) sig[0] ^= 0xff
  return `${header}.${body}.${b64url(sig)}`
}

afterEach(() => { vi.unstubAllGlobals(); resetGoogleKeyCache() })

describe('verifyGoogleIdToken', () => {
  it('제대로 서명된 토큰에서 sub 를 꺼낸다', async () => {
    mockJwks()
    expect(await verifyGoogleIdToken(await makeToken({}), AUD, NOW)).toEqual({ sub: '101234567890' })
  })

  it('accounts.google.com 표기도 받는다', async () => {
    mockJwks()
    const r = await verifyGoogleIdToken(await makeToken({ iss: 'accounts.google.com' }), AUD, NOW)
    expect(r.sub).toBe('101234567890')
  })

  // 여기부터는 전부 뚫리면 남의 계정으로 들어갈 수 있는 경로다
  it('서명이 변조되면 거부한다', async () => {
    mockJwks()
    await expect(verifyGoogleIdToken(await makeToken({}, { tamper: true }), AUD, NOW)).rejects.toThrow(/서명/)
  })

  it('다른 앱에 발급된 토큰을 거부한다', async () => {
    mockJwks()
    await expect(verifyGoogleIdToken(await makeToken({ aud: 'other.apps.googleusercontent.com' }), AUD, NOW))
      .rejects.toThrow(/이 앱에 발급된 토큰이 아닙니다/)
  })

  it('발급자가 구글이 아니면 거부한다', async () => {
    mockJwks()
    await expect(verifyGoogleIdToken(await makeToken({ iss: 'https://evil.example.com' }), AUD, NOW))
      .rejects.toThrow(/발급자/)
  })

  it('만료된 토큰을 거부한다', async () => {
    mockJwks()
    const expired = await makeToken({ exp: Math.floor(NOW / 1000) - 120 })
    await expect(verifyGoogleIdToken(expired, AUD, NOW)).rejects.toThrow(/만료/)
  })

  it('시계 오차 안쪽의 만료는 통과시킨다', async () => {
    mockJwks()
    const justExpired = await makeToken({ exp: Math.floor(NOW / 1000) - 30 })
    await expect(verifyGoogleIdToken(justExpired, AUD, NOW)).resolves.toBeTruthy()
  })

  // alg: none 은 전형적인 JWT 우회다. 서명을 아예 확인하지 않게 만든다.
  it('alg 를 none 으로 바꾼 토큰을 거부한다', async () => {
    mockJwks()
    const header = enc({ alg: 'none', kid: 'test-kid', typ: 'JWT' })
    const body = enc({ iss: 'https://accounts.google.com', aud: AUD, sub: 'attacker', exp: Math.floor(NOW / 1000) + 3600 })
    await expect(verifyGoogleIdToken(`${header}.${body}.`, AUD, NOW)).rejects.toThrow(/서명 방식/)
  })

  it('HS256 으로 바꿔치기한 토큰을 거부한다', async () => {
    mockJwks()
    await expect(verifyGoogleIdToken(await makeToken({}, { alg: 'HS256' }), AUD, NOW)).rejects.toThrow(/서명 방식/)
  })

  it('모르는 kid 를 거부한다', async () => {
    mockJwks('other-kid')
    await expect(verifyGoogleIdToken(await makeToken({}), AUD, NOW)).rejects.toThrow(/키를 찾을 수 없습니다/)
  })

  it('sub 가 없으면 거부한다', async () => {
    mockJwks()
    await expect(verifyGoogleIdToken(await makeToken({ sub: '' }), AUD, NOW)).rejects.toThrow(/사용자 식별자/)
  })

  it('형식이 아닌 문자열을 거부한다', async () => {
    mockJwks()
    await expect(verifyGoogleIdToken('not-a-jwt', AUD, NOW)).rejects.toThrow(/토큰 형식/)
  })

  // 로그인마다 구글에 왕복하면 느리고 속도 제한에도 걸린다
  it('공개키를 캐시해 매번 받아오지 않는다', async () => {
    mockJwks()
    const token = await makeToken({})
    await verifyGoogleIdToken(token, AUD, NOW)
    await verifyGoogleIdToken(token, AUD, NOW + 1000)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })
})
