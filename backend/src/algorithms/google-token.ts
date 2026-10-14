// 구글 ID 토큰(JWT) 검증. 로그인의 신뢰가 전부 여기에 걸려 있다.
//
// tokeninfo 엔드포인트로 떠넘기지 않고 직접 검증한다 — 로그인마다 구글에 왕복이 생기고
// 속도 제한에도 걸린다. Workers 의 WebCrypto 로 RS256 서명을 확인할 수 있다.
//
// 이메일은 받더라도 저장하지 않는다. 계정을 가르는 데 필요한 건 sub 하나뿐이고,
// 저장하지 않으면 지켜야 할 개인정보도 생기지 않는다.

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
// 구글이 인정하는 발급자 표기는 둘 다 쓰인다
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])
// 시계 오차 허용치. 이보다 넉넉하면 만료된 토큰이 통과한다.
const CLOCK_SKEW_SECONDS = 60

type Jwk = { kid: string; n: string; e: string; alg?: string; kty: string; use?: string }

let cachedKeys: { keys: Jwk[]; fetchedAt: number } | null = null
// 구글 키는 자주 바뀌지 않는다. 매 로그인마다 받아오면 왕복만 늘어난다.
const JWKS_TTL_MS = 60 * 60 * 1000

export function resetGoogleKeyCache() {
  cachedKeys = null
}

async function getKeys(now: number): Promise<Jwk[]> {
  if (cachedKeys && now - cachedKeys.fetchedAt < JWKS_TTL_MS) return cachedKeys.keys

  const response = await fetch(JWKS_URL)
  if (!response.ok) throw new Error(`구글 공개키 조회 실패 (${response.status})`)

  const data = await response.json() as { keys?: Jwk[] }
  if (!Array.isArray(data.keys) || data.keys.length === 0) throw new Error('구글 공개키 응답이 비어 있습니다.')

  cachedKeys = { keys: data.keys, fetchedAt: now }
  return data.keys
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function decodeJson(part: string) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part))) as Record<string, unknown>
}

export type GoogleIdentity = { sub: string }

// 검증에 실패하면 던진다. 호출부는 전부 401 로 바꾼다 — 실패 사유를 바깥에 흘리지 않는다.
export async function verifyGoogleIdToken(
  idToken: string,
  audience: string,
  now = Date.now(),
): Promise<GoogleIdentity> {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('토큰 형식이 올바르지 않습니다.')

  const header = decodeJson(parts[0])
  if (header.alg !== 'RS256') throw new Error(`지원하지 않는 서명 방식입니다 (${String(header.alg)}).`)

  const keys = await getKeys(now)
  const jwk = keys.find((key) => key.kid === header.kid)
  if (!jwk) throw new Error('토큰의 키를 찾을 수 없습니다.')

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(parts[2]), signed)
  if (!valid) throw new Error('서명이 올바르지 않습니다.')

  const payload = decodeJson(parts[1])
  const seconds = Math.floor(now / 1000)

  if (typeof payload.iss !== 'string' || !ISSUERS.has(payload.iss)) throw new Error('발급자가 올바르지 않습니다.')
  // audience 를 확인하지 않으면 다른 서비스용으로 발급된 토큰이 그대로 통과한다
  if (payload.aud !== audience) throw new Error('이 앱에 발급된 토큰이 아닙니다.')
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < seconds) throw new Error('토큰이 만료됐습니다.')
  if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW_SECONDS > seconds) throw new Error('토큰 발급 시각이 미래입니다.')
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) throw new Error('사용자 식별자가 없습니다.')

  return { sub: payload.sub }
}
