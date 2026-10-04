/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createLottoRoutes } from './routes/lotto'
import { createPensionRoutes } from './routes/pension'
import { createRefreshRoutes } from './routes/refresh'
import { createSavedPickRoutes } from './routes/saved-picks'
import { backfillLottoPrizeStats, syncLatestLottoResults } from './services/lotto'
import { syncPensionResults } from './services/pension'
import { checkSavedPicks } from './services/saved-picks'
import type { Bindings } from './types/app'
import { pruneCronRunsQuery, recordCronRunQuery } from './queries/cron-runs'
import type { Lottery } from './types/saved-picks'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

app.get('/', (c) => c.text('Lotto Analysis API'))

app.route('/api', createLottoRoutes())
app.route('/api/pension', createPensionRoutes())
app.route('/api/picks', createSavedPickRoutes())
app.route('/api/refresh', createRefreshRoutes())

async function runLottoCron(db: D1Database) {
  const result = await syncLatestLottoResults(db, Number.POSITIVE_INFINITY)
  console.log(`Cron(lotto): synced ${result.syncedCount} draw(s), latest drwNo=${result.latestDraw}`)
  // 새 회차가 들어왔으면 저장된 번호를 채점한다. 결과가 없는 회차는 건너뛰므로 매번 돌려도 된다.
  const checked = await checkSavedPicks(db, 'lotto')
  console.log(`Cron(lotto): checked ${checked.checked} saved pick(s), ${checked.won} won`)

  // 등위별 당첨자 수는 추첨 직후에 비어 있어 나중에 다시 받아야 한다.
  // 한 번에 조금씩만 메워 과거분도 자연히 따라잡게 한다 (다 차면 요청 0건).
  const prizes = await backfillLottoPrizeStats(db, LOTTO_PRIZE_BACKFILL_REQUESTS)
  console.log(`Cron(lotto): prize backfill filled ${prizes.filled} draw(s) in ${prizes.requests} request(s), ${prizes.remaining} left`)

  return {
    syncedCount: result.syncedCount,
    detail: `latest=${result.latestDraw} checked=${checked.checked} backfill=${prizes.filled}/${prizes.remaining}`,
  }
}

async function runPensionCron(db: D1Database) {
  const result = await syncPensionResults(db)
  console.log(`Cron(pension): synced ${result.syncedCount} draw(s), latest drawNo=${result.latestDraw}, pending prize=${result.pendingPrizeDrawNos.join(',') || '-'}`)
  const checked = await checkSavedPicks(db, 'pension')
  console.log(`Cron(pension): checked ${checked.checked} saved pick(s), ${checked.won} won`)

  return {
    syncedCount: result.syncedCount,
    detail: `latest=${result.latestDraw} checked=${checked.checked}`,
  }
}

// cron 한 번에 보낼 백필 요청 수. 한 요청이 10회차를 받으므로 200회차씩 메운다.
// cron 은 주 11회 돈다 (매일 1 + 토 2 + 목 2). 1,243회차를 처음부터 채우면 7회 실행,
// 나흘쯤 걸린다. 다 차면 요청 0건이라 그냥 지나간다.
const LOTTO_PRIZE_BACKFILL_REQUESTS = 20

type CronJobSummary = { syncedCount: number; detail: string }

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    console.log(`Cron execution started (${event.cron})`)

    // cron 이 여러 개지만 어느 것이든 로또·연금을 모두 실행한다 (wrangler.toml).
    // 추첨이 없는 쪽은 최신 회차 확인 요청 하나로 끝나므로 cron 별로 나눌 이득이 없고,
    // 나누면 cron 표현식 문자열에 코드가 묶여 wrangler.toml 을 고칠 때 조용히 어긋난다.
    // 한쪽이 실패해도 다른 쪽은 실행되게 allSettled.
    const jobs: [Lottery, (db: D1Database) => Promise<CronJobSummary>][] = [
      ['lotto', runLottoCron],
      ['pension', runPensionCron],
    ]

    const results = await Promise.allSettled(jobs.map(([, job]) => job(env.DB)))

    // 성공·실패를 모두 D1 에 남긴다. Workers 로그는 밖에서 볼 수 없어서,
    // 결과가 낡았을 때 "발표가 늦은 것" 인지 "cron 이 죽은 것" 인지 구분할 길이 이것뿐이다.
    // 기록 실패가 cron 전체를 무너뜨리면 안 되므로 여기서 삼킨다.
    await Promise.allSettled(results.map(async (result, index) => {
      const [lottery] = jobs[index]
      const ok = result.status === 'fulfilled'
      try {
        await recordCronRunQuery(env.DB, {
          id: crypto.randomUUID(),
          lottery,
          cron: event.cron,
          ran_at: new Date().toISOString(),
          ok: ok ? 1 : 0,
          synced_count: ok ? result.value.syncedCount : null,
          detail: (ok ? result.value.detail : String(result.reason)).slice(0, 300),
        })
        await pruneCronRunsQuery(env.DB, lottery)
      } catch (error) {
        console.error(`Cron(${lottery}): 실행 기록 실패`, error)
      }
    }))

    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [[jobs[index][0], result.reason] as const] : [])

    for (const [name, reason] of failures) console.error(`Cron(${name}) failed:`, reason)
    // 실패를 Workers 대시보드에 남기기 위해 모든 작업이 끝난 뒤 throw 한다
    if (failures.length > 0) throw new Error(`Cron failed: ${failures.map(([name]) => name).join(', ')}`)
  },
}
