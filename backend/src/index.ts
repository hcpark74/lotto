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

    // cron 이 여러 개지만 어느 것이든 로또·연금을 모두 실행한다 (wrangler.toml).
    // 추첨이 없는 쪽은 최신 회차 확인 요청 하나로 끝나므로 cron 별로 나눌 이득이 없고,
    // 나누면 cron 표현식 문자열에 코드가 묶여 wrangler.toml 을 고칠 때 조용히 어긋난다.
    // 한쪽이 실패해도 다른 쪽은 실행되게 allSettled.
    const jobs: [string, (db: D1Database) => Promise<void>][] = [
      ['lotto', runLottoCron],
      ['pension', runPensionCron],
    ]

    const results = await Promise.allSettled(jobs.map(([, job]) => job(env.DB)))
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [[jobs[index][0], result.reason] as const] : [])

    for (const [name, reason] of failures) console.error(`Cron(${name}) failed:`, reason)
    // 실패를 Workers 대시보드에 남기기 위해 모든 작업이 끝난 뒤 throw 한다
    if (failures.length > 0) throw new Error(`Cron failed: ${failures.map(([name]) => name).join(', ')}`)
  },
}
