import { Hono } from 'hono'
import { signInWithGoogle } from '../services/auth'
import type { Bindings } from '../types/app'
import { badRequest, withRouteErrorHandling } from '../utils/route-handler'

const CLIENT_ID_HEADER = 'X-Client-Id'

export function createAuthRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  // 구글 클라이언트 ID 는 공개 값이다. 프런트에 박아 두면 바꿀 때마다 다시 빌드해야 하므로
  // 서버가 알려 준다 — 설정이 wrangler.toml 한 곳에만 있게 된다.
  app.get('/config', (c) => c.json({ googleClientId: c.env.GOOGLE_CLIENT_ID || null }))

  app.post('/google', withRouteErrorHandling(async (c) => {
      const audience = c.env.GOOGLE_CLIENT_ID
      if (!audience) return c.json({ error: '구글 로그인이 설정되지 않았습니다.' }, 503)

      const clientId = c.req.header(CLIENT_ID_HEADER)
      if (!clientId) return badRequest(c, `${CLIENT_ID_HEADER} 헤더가 필요합니다.`)

      const body = await c.req.json().catch(() => null) as { idToken?: unknown } | null
      const idToken = typeof body?.idToken === 'string' ? body.idToken : ''
      if (!idToken) return badRequest(c, 'idToken 이 필요합니다.')

      try {
        return c.json(await signInWithGoogle(c.env.DB, idToken, audience, clientId))
      } catch (error) {
        // 검증 실패 사유는 밖으로 흘리지 않는다 — 토큰을 다듬어 가며 찔러 볼 여지를 준다.
        console.warn('구글 로그인 거부:', error instanceof Error ? error.message : error)
        return c.json({ error: '로그인하지 못했습니다.' }, 401)
      }
    }, { logLabel: 'Error in POST /api/auth/google' }))

  return app
}
