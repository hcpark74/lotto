import { Hono } from 'hono'
import {
  generatePensionSets,
  getPensionResultByDrawNo,
  getRecentPensionResults,
  syncPensionResults,
} from '../services/pension'
import type { Bindings } from '../types/app'
import { notFound, withRouteErrorHandling } from '../utils/route-handler'

export function createPensionRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  app.post('/sync', withRouteErrorHandling(async (c) => {
      const requestedLimit = Number(c.req.query('limit') ?? 0)
      const safeLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), 100)
        : 0

      const result = await syncPensionResults(c.env.DB, safeLimit)
      return c.json({ success: true, ...result })
    }, {
      logLabel: 'Error in /api/pension/sync',
      errorBody: (message) => ({ success: false, error: message }),
    }))

  app.get('/results', withRouteErrorHandling(async (c) => {
      const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)
      const drawNo = c.req.query('drawNo')

      if (drawNo) {
        const row = await getPensionResultByDrawNo(c.env.DB, Number(drawNo))

        if (!row) {
          return notFound(c, '해당 연금복권 회차 데이터가 없습니다.')
        }

        return c.json(row)
      }

      return c.json(await getRecentPensionResults(c.env.DB, limit))
    }))

  app.post('/generate', withRouteErrorHandling((c) => {
      return c.json(generatePensionSets())
    }))

  return app
}
