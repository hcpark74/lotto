import { Hono } from 'hono'
import {
  generateLottoSetsFromDb,
  getHotNumbersFromDb,
  getLottoResultByDrawNo,
  getRecentLottoResults,
  runLottoBacktestFromDb,
  syncLatestLottoResults,
} from '../services/lotto'
import type { LottoSyncResponse, SyncErrorResponse } from '../types/api'
import type { Bindings } from '../types/app'
import { badRequest, notFound, parseDrawNoQuery, parseIntQuery, withRouteErrorHandling } from '../utils/route-handler'

export function createLottoRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  app.post('/sync', withRouteErrorHandling(async (c) => {
      const result = await syncLatestLottoResults(c.env.DB)
      return c.json({ success: true, ...result } satisfies LottoSyncResponse)
    }, {
      errorBody: (message) => ({ success: false, error: message } satisfies SyncErrorResponse),
    }))

  app.get('/results', withRouteErrorHandling(async (c) => {
      const limit = parseIntQuery(c.req.query('limit'), 10, 1, 50)
      const drwNo = parseDrawNoQuery(c.req.query('drwNo'))

      if (drwNo === null) return badRequest(c, 'drwNo 는 양의 정수여야 합니다.')

      if (drwNo !== undefined) {
        const row = await getLottoResultByDrawNo(c.env.DB, drwNo)
        if (!row) return notFound(c, '해당 회차 데이터가 없습니다.')
        return c.json(row)
      }

      return c.json(await getRecentLottoResults(c.env.DB, limit))
    }))

  app.get('/stats/hot', withRouteErrorHandling(async (c) => {
      return c.json(await getHotNumbersFromDb(c.env.DB))
    }))

  app.get('/generate/backtest', withRouteErrorHandling(async (c) => {
      const lookback = parseIntQuery(c.req.query('draws'), 100, 20, 300)

      return c.json(await runLottoBacktestFromDb(c.env.DB, lookback))
    }, {
      errorStatus: (_error, message) => message === '백테스트에 필요한 데이터가 부족합니다.' ? 400 : 500,
    }))

  app.post('/generate', withRouteErrorHandling(async (c) => {
      return c.json(await generateLottoSetsFromDb(c.env.DB))
    }))

  return app
}
