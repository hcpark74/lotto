// 백테스트 CPU 측정. BENCH_DATA 가 없으면 건너뛴다.
// BENCH_DATA=<{ lotto: DrawNumbersRow[], pension: PensionBacktestRow[] } JSON> npx vitest run bench
// 결과는 <BENCH_DATA>.result.txt
import { readFileSync, writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { runLottoBacktest } from '../src/services/lotto-backtest'
import { runPensionBacktest } from '../src/services/pension-backtest'

const benchData = process.env.BENCH_DATA
const lines: string[] = []

function measure(label: string, fn: () => unknown, runs = 7) {
  fn() // warm-up
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    fn()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  lines.push(`${label}: median ${times[Math.floor(runs / 2)].toFixed(1)}ms (min ${times[0].toFixed(1)}, max ${times[runs - 1].toFixed(1)})`)
}

it.skipIf(!benchData)('bench', () => {
  const data = JSON.parse(readFileSync(benchData!, 'utf8'))
  for (const lookback of [100, 120, 300]) measure(`lotto(${lookback})`, () => runLottoBacktest(data.lotto, lookback))
  for (const lookback of [100, 240]) measure(`pension(${lookback})`, () => runPensionBacktest(data.pension, lookback))
  // vitest 가 통과한 테스트의 콘솔 출력을 숨기므로 파일로 남긴다
  writeFileSync(`${benchData}.result.txt`, `${lines.join('\n')}\n`)
}, 120000)
