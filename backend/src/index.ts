/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createLottoRoutes } from './routes/lotto'
import { createPensionRoutes } from './routes/pension'
import { syncLatestLottoResults } from './services/lotto'
import type { Bindings } from './types/app'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

app.get('/', (c) => c.text('Lotto Analysis API'))

app.route('/api', createLottoRoutes())
app.route('/api/pension', createPensionRoutes())

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    console.log('Cron execution started')

    const result = await syncLatestLottoResults(env.DB, Number.POSITIVE_INFINITY)

    console.log(`Cron: synced ${result.syncedCount} draw(s), latest drwNo=${result.latestDraw}`)
  },
}
