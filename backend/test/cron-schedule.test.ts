import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// Cloudflare 는 요일을 1=일 ~ 7=토 로 센다. 표준 cron(0=일, 6=토)의 숫자를 그대로 쓰면
// 하루씩 밀린다 — 실제로 "6"(토 의도)이 금요일에, "4"(목 의도)가 수요일에 돌았다.
// 그래서 숫자 대신 약어를 쓴다. 이 테스트는 숫자로 되돌아가는 걸 막는다.
// 출처: developers.cloudflare.com/workers/configuration/cron-triggers/
//   "Days of the week go from 1 = Sunday to 7 = Saturday, which is different on
//    some other cron systems (where 0 = Sunday and 6 = Saturday)."
const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
const crons = JSON.parse(/crons = (\[[^\]]*\])/.exec(toml)![1].replace(/'/g, '"')) as string[]

const dayField = (cron: string) => cron.trim().split(/\s+/)[4]

describe('cron 설정', () => {
  it('요일을 지정한 cron 은 숫자가 아니라 약어를 쓴다', () => {
    for (const cron of crons) {
      const day = dayField(cron)
      if (day === '*') continue
      expect(day, `${cron} 의 요일이 숫자다. Cloudflare 는 1=일~7=토 라 하루 밀린다`).toMatch(/^[A-Z]{3}$/)
    }
  })

  // 로또 토 20:35 KST, 연금 목 19:05 KST 추첨 (dhlottery). cron 은 UTC 라 KST-9.
  it('추첨 요일과 시각이 맞다', () => {
    expect(crons).toContain('10 12,13 * * SAT')   // 토 21:10, 22:10 KST — 로또 추첨 35분·95분 뒤
    expect(crons).toContain('40 10,11 * * THU')   // 목 19:40, 20:40 KST — 연금 추첨 35분·95분 뒤
    expect(crons).toContain('30 21 * * *')        // 매일 06:30 KST — 둘 다 놓쳤을 때의 그물망
  })

  it('무료 플랜 한도(계정당 5개)를 넘지 않는다', () => {
    expect(crons.length).toBeLessThanOrEqual(5)
  })
})
