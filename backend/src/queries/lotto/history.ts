import type { LottoResultRecord } from '../../types/lotto'

export async function getLatestStoredLottoDrawNo(db: D1Database) {
  const row = await db.prepare('SELECT drwNo FROM lotto_history ORDER BY drwNo DESC LIMIT 1').first<{ drwNo: number }>()
  return row?.drwNo ?? 0
}

const PRIZE_COLUMNS = [
  'rnk1WnNope', 'rnk2WnNope', 'rnk3WnNope', 'rnk4WnNope', 'rnk5WnNope',
  'rnk1SumWnAmt', 'rnk2SumWnAmt', 'rnk3SumWnAmt', 'rnk4SumWnAmt', 'rnk5SumWnAmt',
  'salesAmount', 'winType1', 'winType2', 'winType3',
] as const

// 운영 DB 에 아직 열이 없으면 추가한다. D1 은 한 문에 한 열만 받는다.
export async function ensureLottoPrizeColumns(db: D1Database) {
  for (const column of PRIZE_COLUMNS) {
    try {
      await db.prepare(`ALTER TABLE lotto_history ADD COLUMN ${column} INTEGER`).run()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // 이미 있으면 "duplicate column name" 이 난다. 그 외 오류는 덮지 않는다.
      if (!/duplicate column name/i.test(message)) throw error
    }
  }
}

function isMissingColumnError(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
  return /no such column/i.test(message)
}

// 당첨 번호는 한 번 확정되면 바뀌지 않으므로 그대로 두고, 등위 집계만 나중에 채운다.
// COALESCE(excluded, 기존) 이라 추첨 직후의 빈 집계가 이미 받아둔 값을 지우지 않는다.
const UPSERT = `INSERT INTO lotto_history
  (drwNo, drwNoDate, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo, firstWinamnt,
   ${PRIZE_COLUMNS.join(', ')})
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${PRIZE_COLUMNS.map(() => '?').join(', ')})
  ON CONFLICT(drwNo) DO UPDATE SET
   firstWinamnt = COALESCE(excluded.firstWinamnt, lotto_history.firstWinamnt),
   ${PRIZE_COLUMNS.map((c) => `${c} = COALESCE(excluded.${c}, lotto_history.${c})`).join(', ')}`

function bindOf(result: LottoResultRecord) {
  const stats = result.prizeStats
  return [
    result.drwNo,
    result.drwNoDate,
    result.drwtNo1,
    result.drwtNo2,
    result.drwtNo3,
    result.drwtNo4,
    result.drwtNo5,
    result.drwtNo6,
    result.bnusNo,
    result.firstWinamnt,
    ...PRIZE_COLUMNS.map((c) => (stats ? stats[c] : null)),
  ]
}

export async function insertLottoResult(db: D1Database, result: LottoResultRecord) {
  const bind = bindOf(result)

  try {
    await db.prepare(UPSERT).bind(...bind).run()
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    await ensureLottoPrizeColumns(db)
    await db.prepare(UPSERT).bind(...bind).run()
  }
}

export async function countLottoDrawsMissingPrizeStatsQuery(db: D1Database) {
  try {
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM lotto_history WHERE salesAmount IS NULL')
      .first<{ n: number }>()
    return row?.n ?? 0
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    await ensureLottoPrizeColumns(db)
    return 0
  }
}

// 여러 회차를 한 번의 batch 로 넣는다. 낱개 호출은 회차마다 Workers 구독요청을 하나씩
// 쓰므로 백필처럼 수백 건을 다룰 때 호출당 한도(무료 플랜 50건)를 넘긴다.
export async function insertLottoResults(db: D1Database, results: LottoResultRecord[]) {
  if (results.length === 0) return

  const send = () => db.batch(results.map((result) => db.prepare(UPSERT).bind(...bindOf(result))))

  try {
    await send()
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    await ensureLottoPrizeColumns(db)
    await send()
  }
}

// 등위 집계가 아직 비어 있는 회차. 백필이 이 목록만 다시 받는다.
export async function getLottoDrawsMissingPrizeStatsQuery(db: D1Database, limit: number) {
  try {
    const { results } = await db
      .prepare('SELECT drwNo FROM lotto_history WHERE salesAmount IS NULL ORDER BY drwNo DESC LIMIT ?')
      .bind(limit)
      .all<{ drwNo: number }>()
    return results.map((row) => row.drwNo)
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    await ensureLottoPrizeColumns(db)
    return []
  }
}

export async function getLottoResultCountQuery(db: D1Database) {
  const row = await db.prepare('SELECT COUNT(*) as n FROM lotto_history').first<{ n: number }>()
  return row?.n ?? 0
}
