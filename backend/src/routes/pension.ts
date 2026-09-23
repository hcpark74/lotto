import { Hono } from 'hono'
import {
  generatePensionSets,
  getPensionResultByDrawNo,
  getRecentPensionResults,
  runPensionBacktestFromDb,
  syncPensionResults,
} from '../services/pension'
import type { PensionSyncResponse, SyncErrorResponse } from '../types/api'
import type { Bindings } from '../types/app'
import { requireAdminToken } from '../utils/admin-auth'
import { badRequest, notFound, parseDrawNoQuery, parseIntQuery, withRouteErrorHandling } from '../utils/route-handler'

export function createPensionRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  app.post('/sync', requireAdminToken, withRouteErrorHandling(async (c) => {
      // 0 = 제한 없음
      const limit = parseIntQuery(c.req.query('limit'), 0, 0, 100)
      const result = await syncPensionResults(c.env.DB, limit)
      return c.json({ success: true, ...result } satisfies PensionSyncResponse)
    }, {
      logLabel: 'Error in /api/pension/sync',
      errorBody: (message) => ({ success: false, error: message } satisfies SyncErrorResponse),
    }))

  app.get('/results', withRouteErrorHandling(async (c) => {
      const limit = parseIntQuery(c.req.query('limit'), 20, 1, 100)
      const drawNo = parseDrawNoQuery(c.req.query('drawNo'))

      if (drawNo === null) return badRequest(c, 'drawNo 는 양의 정수여야 합니다.')

      if (drawNo !== undefined) {
        const row = await getPensionResultByDrawNo(c.env.DB, drawNo)

        if (!row) {
          return notFound(c, '해당 연금복권 회차 데이터가 없습니다.')
        }

        return c.json(row)
      }

      return c.json(await getRecentPensionResults(c.env.DB, limit))
    }))

  app.post('/generate', withRouteErrorHandling(async (c) => {
      return c.json(await generatePensionSets(c.env.DB))
    }))

  app.get('/generate/backtest', withRouteErrorHandling(async (c) => {
      const lookback = parseIntQuery(c.req.query('draws'), 100, 20, 240)
      return c.json(await runPensionBacktestFromDb(c.env.DB, lookback))
    }, {
      errorStatus: (_error, message) => message === '연금복권 백테스트에 필요한 데이터가 부족합니다.' ? 400 : 500,
    }))

  return app
}
