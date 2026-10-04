import { Hono } from 'hono'
import { getSyncStatus, refreshLottery } from '../services/refresh'
import type { Lottery } from '../types/saved-picks'
import type { Bindings } from '../types/app'
import { badRequest, withRouteErrorHandling } from '../utils/route-handler'

function parseLottery(value: string | undefined): Lottery | null {
  return value === 'lotto' || value === 'pension' ? value : null
}

// 토큰 없이 열어 둔다. 남용 방지는 서비스 쪽에서 한다 (일정 계산 + 쿨다운).
// 관리자용 POST /api/sync 는 그대로 토큰을 요구한다 — 거긴 전체 재동기화라 비용이 다르다.
export function createRefreshRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  app.post('/', withRouteErrorHandling(async (c) => {
      const lottery = parseLottery(c.req.query('lottery'))
      if (!lottery) return badRequest(c, 'lottery 는 lotto 또는 pension 이어야 합니다.')

      return c.json(await refreshLottery(c.env.DB, lottery))
    }, { logLabel: 'Error in POST /api/refresh' }))

  // 자동 갱신이 제때 돌고 있는지. 화면이 "마지막 갱신" 을 보여주는 데 쓴다.
  app.get('/status', withRouteErrorHandling(async (c) => {
      const lottery = parseLottery(c.req.query('lottery'))
      if (!lottery) return badRequest(c, 'lottery 는 lotto 또는 pension 이어야 합니다.')

      return c.json(await getSyncStatus(c.env.DB, lottery))
    }, { logLabel: 'Error in GET /api/refresh/status' }))

  return app
}
