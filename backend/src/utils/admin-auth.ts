import type { MiddlewareHandler } from 'hono'
import type { SyncErrorResponse } from '../types/api'
import type { Bindings } from '../types/app'

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

// 둘 다 SHA-256 으로 고정 길이(32바이트)로 만든 뒤 전 바이트를 비교해,
// 걸리는 시간이 일치하는 앞부분 길이나 입력 길이에 따라 달라지지 않게 한다.
export async function timingSafeEqualString(a: string, b: string) {
  const [left, right] = await Promise.all([sha256(a), sha256(b)])
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

function unauthorized(message: string) {
  return new Response(JSON.stringify({ success: false, error: message } satisfies SyncErrorResponse), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' },
  })
}

// 관리자 전용 엔드포인트 보호. `Authorization: Bearer <ADMIN_TOKEN>` 이 맞아야 통과한다.
// ADMIN_TOKEN 이 설정되지 않은 환경에서는 전부 거부한다 (fail closed).
export const requireAdminToken: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  const expected = c.env.ADMIN_TOKEN

  if (!expected) {
    console.error('ADMIN_TOKEN 이 설정되지 않아 관리자 요청을 거부합니다. wrangler secret put ADMIN_TOKEN 으로 설정하세요.')
    return unauthorized('인증이 필요합니다.')
  }

  const match = /^Bearer\s+(.+)$/i.exec(c.req.header('Authorization') ?? '')
  if (!match || !(await timingSafeEqualString(match[1].trim(), expected))) {
    return unauthorized('인증이 필요합니다.')
  }

  await next()
}
