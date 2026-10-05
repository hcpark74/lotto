import { Hono } from 'hono'
import {
  backfillLottoPrizeStats,
  generateLottoSetsFromDb,
  getHotNumbersFromDb,
  getLottoResultByDrawNo,
  getLottoResultsUpTo,
  getRecentLottoResults,
  runLottoBacktestFromDb,
  syncLatestLottoResults,
} from '../services/lotto'
import type { LottoSyncResponse, SyncErrorResponse } from '../types/api'
import type { Bindings } from '../types/app'
import { requireAdminToken } from '../utils/admin-auth'
import { checkSavedPicks } from '../services/saved-picks'
import { badRequest, notFound, parseDrawNoQuery, parseIntQuery, withRouteErrorHandling } from '../utils/route-handler'

export function createLottoRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  app.post('/sync', requireAdminToken, withRouteErrorHandling(async (c) => {
      const result = await syncLatestLottoResults(c.env.DB)
      // cron 과 같은 채점을 수동 동기화에서도 돌린다
      const checked = await checkSavedPicks(c.env.DB, 'lotto')
      return c.json({ success: true, ...result, savedPickCheck: checked } satisfies LottoSyncResponse)
    }, {
      errorBody: (message) => ({ success: false, error: message } satisfies SyncErrorResponse),
    }))

  // 등위별 당첨자 수·판매액 백필. 한 호출이 10회차를 받으므로 limit 은 "요청 수"다.
  app.post('/sync/prizes', requireAdminToken, withRouteErrorHandling(async (c) => {
      // 요청 1건마다 fetch 1 + D1 batch 1 이라 상한을 올리면 Workers 구독요청
      // 한도(무료 플랜 호출당 50건)를 중간에 넘겨 일부만 쓰인 채 500 이 난다.
      const maxRequests = parseIntQuery(c.req.query('limit'), 10, 1, 20)
      const result = await backfillLottoPrizeStats(c.env.DB, maxRequests)
      return c.json({ success: true, ...result })
    }, {
      logLabel: 'Error in /api/sync/prizes',
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

      // to=N 이면 N 회 이하에서 최신순 limit 개. 회차 브라우저가 창을 옮길 때 쓴다.
      const to = parseDrawNoQuery(c.req.query('to'))
      if (to === null) return badRequest(c, 'to 는 양의 정수여야 합니다.')
      if (to !== undefined) return c.json(await getLottoResultsUpTo(c.env.DB, to, limit))

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
