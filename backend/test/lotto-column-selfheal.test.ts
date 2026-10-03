import { beforeEach, describe, expect, it, vi } from 'vitest'
import { insertLottoResult, insertLottoResults } from '../src/queries/lotto/history'
import type { LottoResultRecord } from '../src/types/lotto'

// 2026-10-03 운영에서 실제로 난 상황을 그대로 재현한다.
// lotto_history 에 등위 열이 없는 상태에서 1244회를 INSERT 하면 D1 이 이 문구를 던진다.
// 자가 치유(ALTER TABLE 후 재시도)가 돌지 않아 cron 이 통째로 죽었다.
const INSERT_ERROR = 'D1_ERROR: table lotto_history has no column named rnk1WnNope: SQLITE_ERROR'

const record: LottoResultRecord = {
  drwNo: 1244, drwNoDate: '2026-10-03',
  drwtNo1: 1, drwtNo2: 13, drwtNo3: 18, drwtNo4: 26, drwtNo5: 34, drwtNo6: 38,
  bnusNo: 25, firstWinamnt: 1605000000,
  prizeStats: null,
}

// 등위 열이 없는 D1 을 흉내낸다. ALTER TABLE 이 오기 전까지 INSERT 는 실패한다.
function fakeDb() {
  const sql: string[] = []
  let hasColumns = false

  const run = vi.fn(async function (this: { text: string }) {
    sql.push(this.text)
    if (/^ALTER TABLE/.test(this.text)) { hasColumns = true; return {} }
    if (/^INSERT INTO lotto_history/.test(this.text) && !hasColumns) throw new Error(INSERT_ERROR)
    return {}
  })

  const prepare = vi.fn((text: string) => {
    const stmt = { text, bind: (..._a: unknown[]) => stmt, run: () => run.call(stmt) }
    return stmt
  })

  return {
    db: { prepare, batch: async (stmts: { run: () => Promise<unknown> }[]) => Promise.all(stmts.map((s) => s.run())) } as unknown as D1Database,
    sql,
    get hasColumns() { return hasColumns },
  }
}

describe('등위 열이 없는 운영 DB 에 저장할 때', () => {
  let fake: ReturnType<typeof fakeDb>
  beforeEach(() => { fake = fakeDb() })

  it('ALTER TABLE 로 열을 추가하고 다시 넣는다', async () => {
    await expect(insertLottoResult(fake.db, record)).resolves.toBeUndefined()

    const alters = fake.sql.filter((s) => s.startsWith('ALTER TABLE'))
    expect(alters.length).toBe(14)
    expect(alters.some((s) => s.includes('salesAmount'))).toBe(true)
    // 첫 INSERT 실패 → ALTER 14번 → 재시도 INSERT
    expect(fake.sql.filter((s) => s.startsWith('INSERT INTO lotto_history')).length).toBe(2)
  })

  it('batch 경로도 똑같이 치유한다 (백필이 쓰는 길)', async () => {
    await expect(insertLottoResults(fake.db, [record, { ...record, drwNo: 1245 }])).resolves.toBeUndefined()
    expect(fake.sql.filter((s) => s.startsWith('ALTER TABLE')).length).toBe(14)
    expect(fake.hasColumns).toBe(true)
  })

  it('열이 이미 있으면 ALTER 를 보내지 않는다', async () => {
    const ready = fakeDb()
    await ready.db.prepare('ALTER TABLE lotto_history ADD COLUMN salesAmount INTEGER').run()
    ready.sql.length = 0

    await insertLottoResult(ready.db, record)
    expect(ready.sql.filter((s) => s.startsWith('ALTER TABLE'))).toHaveLength(0)
    expect(ready.sql.filter((s) => s.startsWith('INSERT INTO lotto_history'))).toHaveLength(1)
  })

  // 다른 오류까지 삼키면 진짜 문제를 ALTER TABLE 로 덮어 버린다
  it('관계없는 오류는 그대로 올린다', async () => {
    const broken = {
      prepare: (text: string) => {
        const stmt = { text, bind: () => stmt, run: async () => { throw new Error('D1_ERROR: UNIQUE constraint failed') } }
        return stmt
      },
    } as unknown as D1Database

    await expect(insertLottoResult(broken, record)).rejects.toThrow(/UNIQUE constraint/)
  })
})
