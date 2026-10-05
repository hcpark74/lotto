import { Hono } from 'hono'
import {
  claimTransferCode,
  deleteSavedPick,
  getNextDrawNo,
  isValidClientId,
  MAX_PICKS_PER_REQUEST,
  issueTransferCode,
  listSavedPicks,
  normalizeNumbers,
  savePick,
  savePicks,
} from '../services/saved-picks'
import type { Lottery } from '../types/saved-picks'
import type { Bindings } from '../types/app'
import { badRequest, notFound, withRouteErrorHandling } from '../utils/route-handler'

// 브라우저가 만든 익명 ID. 로그인이 없어 이 값이 곧 권한이므로 항상 요구한다.
const CLIENT_ID_HEADER = 'X-Client-Id'

function parseLottery(value: string | undefined): Lottery | null {
  return value === 'lotto' || value === 'pension' ? value : null
}

export function createSavedPickRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  app.get('/', withRouteErrorHandling(async (c) => {
      const clientId = c.req.header(CLIENT_ID_HEADER)
      if (!isValidClientId(clientId)) return badRequest(c, `${CLIENT_ID_HEADER} 헤더가 필요합니다.`)

      const lottery = parseLottery(c.req.query('lottery'))
      if (!lottery) return badRequest(c, 'lottery 는 lotto 또는 pension 이어야 합니다.')

      return c.json(await listSavedPicks(c.env.DB, clientId, lottery))
    }, { logLabel: 'Error in GET /api/picks' }))

  // 저장 가능한 다음 회차. 클라이언트가 회차를 정하면 조작할 수 있어 서버가 정한다.
  app.get('/next-draw', withRouteErrorHandling(async (c) => {
      const lottery = parseLottery(c.req.query('lottery'))
      if (!lottery) return badRequest(c, 'lottery 는 lotto 또는 pension 이어야 합니다.')

      const drawNo = await getNextDrawNo(c.env.DB, lottery)
      if (drawNo == null) return notFound(c, '아직 회차 데이터가 없습니다.')

      return c.json({ lottery, drawNo })
    }, { logLabel: 'Error in GET /api/picks/next-draw' }))

  app.post('/', withRouteErrorHandling(async (c) => {
      const clientId = c.req.header(CLIENT_ID_HEADER)
      if (!isValidClientId(clientId)) return badRequest(c, `${CLIENT_ID_HEADER} 헤더가 필요합니다.`)

      const body = await c.req.json().catch(() => null) as { lottery?: string; numbers?: unknown; label?: unknown } | null
      if (!body) return badRequest(c, '요청 본문이 올바르지 않습니다.')

      const lottery = parseLottery(body.lottery)
      if (!lottery) return badRequest(c, 'lottery 는 lotto 또는 pension 이어야 합니다.')

      const numbers = normalizeNumbers(lottery, body.numbers)
      if (!numbers) return badRequest(c, '번호 형식이 올바르지 않습니다.')

      // 대상 회차는 서버가 정한다 — 지난 회차에 저장해 결과를 맞춘 것처럼 만들 수 없게.
      const drawNo = await getNextDrawNo(c.env.DB, lottery)
      if (drawNo == null) return notFound(c, '아직 회차 데이터가 없어 저장할 수 없습니다.')

      const label = typeof body.label === 'string' ? body.label.slice(0, 40) : null

      try {
        return c.json(await savePick(c.env.DB, { clientId, lottery, drawNo, numbers, label }), 201)
      } catch (error) {
        return badRequest(c, error instanceof Error ? error.message : '저장에 실패했습니다.')
      }
    }, { logLabel: 'Error in POST /api/picks' }))

  // 추천은 5세트가 한 번에 나오므로 저장도 한 번에 받는다.
  // 한도 검사가 한 번이라 낱개 저장처럼 일부만 들어가는 일이 없다.
  app.post('/bulk', withRouteErrorHandling(async (c) => {
      const clientId = c.req.header(CLIENT_ID_HEADER)
      if (!isValidClientId(clientId)) return badRequest(c, `${CLIENT_ID_HEADER} 헤더가 필요합니다.`)

      const body = await c.req.json().catch(() => null) as { lottery?: string; picks?: unknown } | null
      if (!body) return badRequest(c, '요청 본문이 올바르지 않습니다.')

      const lottery = parseLottery(body.lottery)
      if (!lottery) return badRequest(c, 'lottery 는 lotto 또는 pension 이어야 합니다.')

      if (!Array.isArray(body.picks) || body.picks.length === 0) {
        return badRequest(c, 'picks 는 비어 있지 않은 배열이어야 합니다.')
      }
      // 개수를 먼저 본다. 뒤에서 걸러도 되지만 그러면 거절할 입력에 normalizeNumbers 를
      // 수만 번 돌리게 된다 (토큰 없이 열려 있는 경로다).
      if (body.picks.length > MAX_PICKS_PER_REQUEST) {
        return badRequest(c, `한 번에 ${MAX_PICKS_PER_REQUEST}개까지 저장할 수 있습니다.`)
      }

      const entries: { numbers: string; label: string | null }[] = []
      for (const raw of body.picks) {
        const item = raw as { numbers?: unknown; label?: unknown } | null
        const numbers = normalizeNumbers(lottery, item?.numbers)
        if (!numbers) return badRequest(c, '번호 형식이 올바르지 않습니다.')
        entries.push({ numbers, label: typeof item?.label === 'string' ? item.label.slice(0, 40) : null })
      }

      // 대상 회차는 서버가 정한다 — 지난 회차에 저장해 결과를 맞춘 것처럼 만들 수 없게.
      const drawNo = await getNextDrawNo(c.env.DB, lottery)
      if (drawNo == null) return notFound(c, '아직 회차 데이터가 없어 저장할 수 없습니다.')

      try {
        return c.json(await savePicks(c.env.DB, clientId, lottery, drawNo, entries), 201)
      } catch (error) {
        return badRequest(c, error instanceof Error ? error.message : '저장에 실패했습니다.')
      }
    }, { logLabel: 'Error in POST /api/picks/bulk' }))

  // 다른 기기에서 이어 보기 위한 일회용 코드를 발급한다
  app.post('/transfer-code', withRouteErrorHandling(async (c) => {
      const clientId = c.req.header(CLIENT_ID_HEADER)
      if (!isValidClientId(clientId)) return badRequest(c, `${CLIENT_ID_HEADER} 헤더가 필요합니다.`)

      return c.json(await issueTransferCode(c.env.DB, clientId))
    }, { logLabel: 'Error in POST /api/picks/transfer-code' }))

  // 코드를 쓴 기기가 원래 기기의 보관함을 이어받는다
  app.post('/claim', withRouteErrorHandling(async (c) => {
      const clientId = c.req.header(CLIENT_ID_HEADER)
      if (!isValidClientId(clientId)) return badRequest(c, `${CLIENT_ID_HEADER} 헤더가 필요합니다.`)

      const body = await c.req.json().catch(() => null) as { code?: unknown } | null
      const rawCode = typeof body?.code === 'string' ? body.code : ''

      const result = await claimTransferCode(c.env.DB, clientId, rawCode)
      if (!result.ok) {
        return badRequest(c, result.reason === 'same-device'
          ? '같은 기기에서 만든 코드입니다. 다른 기기에서 입력해 주세요.'
          : '코드가 올바르지 않거나 만료됐습니다.')
      }

      return c.json({ clientId: result.clientId, movedCount: result.movedCount })
    }, { logLabel: 'Error in POST /api/picks/claim' }))

  app.delete('/:id', withRouteErrorHandling(async (c) => {
      const clientId = c.req.header(CLIENT_ID_HEADER)
      if (!isValidClientId(clientId)) return badRequest(c, `${CLIENT_ID_HEADER} 헤더가 필요합니다.`)

      const deleted = await deleteSavedPick(c.env.DB, clientId, c.req.param('id'))
      if (!deleted) return notFound(c, '저장한 번호를 찾을 수 없습니다.')

      return c.json({ success: true })
    }, { logLabel: 'Error in DELETE /api/picks/:id' }))

  return app
}
