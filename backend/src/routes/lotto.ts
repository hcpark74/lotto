import { Hono } from 'hono'
import {
  generateLottoSetsFromDb,
  getHotNumbersFromDb,
  getLottoResultByDrawNo,
  getRecentLottoResults,
  runLottoBacktestFromDb,
  syncLatestLottoResults,
} from '../services/lotto'
import type { Bindings } from '../types/app'
import { notFound, withRouteErrorHandling } from '../utils/route-handler'

export function createLottoRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  app.post('/sync', withRouteErrorHandling(async (c) => {
      const result = await syncLatestLottoResults(c.env.DB)
      return c.json({ success: true, ...result })
    }, {
      errorBody: (message) => ({ success: false, error: message }),
    }))

  app.get('/results', withRouteErrorHandling(async (c) => {
      const limit = Math.min(Number(c.req.query('limit') ?? 10), 50)
      const drwNo = c.req.query('drwNo')

      if (drwNo) {
        const row = await getLottoResultByDrawNo(c.env.DB, Number(drwNo))
        if (!row) return notFound(c, '해당 회차 데이터가 없습니다.')
        return c.json(row)
      }

      return c.json(await getRecentLottoResults(c.env.DB, limit))
    }))

  app.get('/stats/hot', withRouteErrorHandling(async (c) => {
      return c.json(await getHotNumbersFromDb(c.env.DB))
    }))

  app.get('/generate/backtest', withRouteErrorHandling(async (c) => {
      const lookback = Math.min(Math.max(Number(c.req.query('draws') ?? 100), 20), 300)

      return c.json(await runLottoBacktestFromDb(c.env.DB, lookback))
    }, {
      errorStatus: (_error, message) => message === '백테스트에 필요한 데이터가 부족합니다.' ? 400 : 500,
    }))

  app.post('/generate', withRouteErrorHandling(async (c) => {
      return c.json(await generateLottoSetsFromDb(c.env.DB))
    }))

  return app
}
