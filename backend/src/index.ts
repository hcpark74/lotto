/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createLottoRoutes } from './routes/lotto'
import { createPensionRoutes } from './routes/pension'
import { syncLatestLottoResults } from './services/lotto'
import { syncPensionResults } from './services/pension'
import type { Bindings } from './types/app'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

app.get('/', (c) => c.text('Lotto Analysis API'))

app.route('/api', createLottoRoutes())
app.route('/api/pension', createPensionRoutes())

// wrangler.toml 의 crons 와 같은 문자열이어야 한다
const LOTTO_CRON = '30 21 * * 6'
const PENSION_CRON = '30 21 * * 4'

async function runLottoCron(db: D1Database) {
  const result = await syncLatestLottoResults(db, Number.POSITIVE_INFINITY)
  console.log(`Cron(lotto): synced ${result.syncedCount} draw(s), latest drwNo=${result.latestDraw}`)
}

async function runPensionCron(db: D1Database) {
  const result = await syncPensionResults(db)
  console.log(`Cron(pension): synced ${result.syncedCount} draw(s), latest drawNo=${result.latestDraw}, pending prize=${result.pendingPrizeDrawNos.join(',') || '-'}`)
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    console.log(`Cron execution started (${event.cron})`)

    // 알 수 없는 cron 이면 둘 다 실행한다. 한쪽이 실패해도 다른 쪽은 실행되게 allSettled.
    const jobs: [string, (db: D1Database) => Promise<void>][] = []
    if (event.cron !== PENSION_CRON) jobs.push(['lotto', runLottoCron])
    if (event.cron !== LOTTO_CRON) jobs.push(['pension', runPensionCron])

    const results = await Promise.allSettled(jobs.map(([, job]) => job(env.DB)))
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [[jobs[index][0], result.reason] as const] : [])

    for (const [name, reason] of failures) console.error(`Cron(${name}) failed:`, reason)
    // 실패를 Workers 대시보드에 남기기 위해 모든 작업이 끝난 뒤 throw 한다
    if (failures.length > 0) throw new Error(`Cron failed: ${failures.map(([name]) => name).join(', ')}`)
  },
}
