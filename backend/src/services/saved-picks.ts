import { gradeLottoPick, gradePensionPick } from '../algorithms/saved-picks'
import {
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  createTransferCode,
  formatTransferCode,
  hashTransferCode,
  normalizeTransferCode,
} from '../algorithms/transfer-code'
import {
  deleteExpiredTransferCodesQuery,
  deleteTransferCodeQuery,
  findTransferCodeQuery,
  reassignSavedPicksQuery,
  replaceTransferCodeQuery,
} from '../queries/transfer-codes'
import { PENSION_DIGIT_COUNT } from '../algorithms/pension-baseline'
import {
  countSavedPicksByClientQuery,
  deleteSavedPickQuery,
  getSavedPicksByClientQuery,
  getUncheckedSavedPicksQuery,
  insertSavedPickQuery,
  insertSavedPicksQuery,
  markSavedPickCheckedQuery,
} from '../queries/saved-picks'
import { getLottoResultByDrawNoQuery, getRecentLottoResultsQuery } from '../queries/lotto'
import { getPensionResultByDrawNoQuery, getRecentPensionResultsQuery } from '../queries/pension'
import type { Lottery, SavedPick, SavedPickCheckSummary, SavedPickRow } from '../types/saved-picks'

// 한 브라우저가 쌓을 수 있는 최대 저장 수. 서버 저장이라 상한이 없으면 한 명이 테이블을 채울 수 있다.
export const MAX_PICKS_PER_CLIENT = 200

// 한 번에 저장할 수 있는 세트 수. 로또 5세트·연금 4세트가 한 번에 생성되므로 그보다 넉넉하게 둔다.
export const MAX_PICKS_PER_REQUEST = 10
export const PICK_LIST_LIMIT = 60
// 한 번의 동기화에서 채점할 최대 행 수. Workers CPU 한도를 넘기지 않도록 끊는다.
const CHECK_BATCH_LIMIT = 500

// 익명 ID 는 사실상 베어러 토큰이다. 길이가 짧으면 추측당하므로 UUID 수준만 받는다.
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

export function isValidClientId(value: string | undefined): value is string {
  return typeof value === 'string' && CLIENT_ID_PATTERN.test(value)
}

export function toSavedPick(row: SavedPickRow): SavedPick {
  return {
    id: row.id,
    lottery: row.lottery,
    drawNo: row.draw_no,
    numbers: row.numbers,
    label: row.label,
    savedAt: row.saved_at,
    result: row.checked_at == null ? null : {
      matchedCount: row.matched_count ?? 0,
      bonusMatched: row.bonus_matched === 1,
      rankNo: row.rank_no,
      checkedAt: row.checked_at,
      winningBand: row.winning_band ?? null,
    },
  }
}

// 로또는 1~45 중 서로 다른 6개, 연금은 숫자 6자리 문자열.
export function normalizeNumbers(lottery: Lottery, raw: unknown): string | null {
  if (lottery === 'lotto') {
    if (!Array.isArray(raw) || raw.length !== 6) return null
    const numbers = raw.map(Number)
    if (!numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 45)) return null
    if (new Set(numbers).size !== 6) return null
    return numbers.slice().sort((a, b) => a - b).join(',')
  }

  const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join('') : ''
  return new RegExp(`^\\d{${PENSION_DIGIT_COUNT}}$`).test(text) ? text : null
}

export async function listSavedPicks(db: D1Database, clientId: string, lottery: Lottery) {
  const rows = await getSavedPicksByClientQuery(db, clientId, lottery, PICK_LIST_LIMIT)
  return rows.map(toSavedPick)
}

export type SavePickInput = {
  clientId: string
  lottery: Lottery
  drawNo: number
  numbers: string
  label: string | null
}

function buildPickRow(input: SavePickInput): SavedPickRow {
  return {
    id: crypto.randomUUID(),
    client_id: input.clientId,
    lottery: input.lottery,
    draw_no: input.drawNo,
    numbers: input.numbers,
    label: input.label,
    saved_at: new Date().toISOString(),
    matched_count: null,
    bonus_matched: null,
    rank_no: null,
    checked_at: null,
    winning_band: null,
  }
}

// 한 번에 생성된 세트를 한 번에 저장한다. 한도는 합쳐서 한 번만 검사한다 —
// 낱개로 저장할 때처럼 중간에 한도에 걸려 일부만 들어가는 일이 없다.
export async function savePicks(
  db: D1Database,
  clientId: string,
  lottery: Lottery,
  drawNo: number,
  entries: { numbers: string; label: string | null }[],
): Promise<SavedPick[]> {
  if (entries.length === 0) throw new Error('저장할 번호가 없습니다.')
  if (entries.length > MAX_PICKS_PER_REQUEST) {
    throw new Error(`한 번에 ${MAX_PICKS_PER_REQUEST}개까지 저장할 수 있습니다.`)
  }

  const count = await countSavedPicksByClientQuery(db, clientId)
  if (count + entries.length > MAX_PICKS_PER_CLIENT) {
    throw new Error(`저장은 최대 ${MAX_PICKS_PER_CLIENT}개까지 가능합니다. 오래된 번호를 지우고 다시 시도해 주세요.`)
  }

  const rows = entries.map((entry) => buildPickRow({
    clientId, lottery, drawNo, numbers: entry.numbers, label: entry.label,
  }))

  await insertSavedPicksQuery(db, rows)
  return rows.map(toSavedPick)
}

export async function savePick(db: D1Database, input: SavePickInput): Promise<SavedPick> {
  const count = await countSavedPicksByClientQuery(db, input.clientId)
  if (count >= MAX_PICKS_PER_CLIENT) {
    throw new Error(`저장은 최대 ${MAX_PICKS_PER_CLIENT}개까지 가능합니다. 오래된 번호를 지우고 다시 시도해 주세요.`)
  }

  const row = buildPickRow(input)

  await insertSavedPickQuery(db, row)
  return toSavedPick(row)
}

export async function deleteSavedPick(db: D1Database, clientId: string, id: string) {
  return deleteSavedPickQuery(db, clientId, id)
}

// 저장할 수 있는 다음 회차. 결과가 들어온 최신 회차 + 1.
export async function getNextDrawNo(db: D1Database, lottery: Lottery) {
  if (lottery === 'lotto') {
    const [latest] = await getRecentLottoResultsQuery(db, 1)
    return latest?.drwNo == null ? null : latest.drwNo + 1
  }

  const [latest] = await getRecentPensionResultsQuery(db, 1)
  return latest?.draw_no == null ? null : latest.draw_no + 1
}

// 동기화 직후 호출한다. 결과가 들어온 회차의 미채점 저장분을 매긴다.
// 회차별로 결과를 한 번만 읽도록 묶어서 처리한다.
export async function checkSavedPicks(db: D1Database, lottery: Lottery): Promise<SavedPickCheckSummary> {
  const latestDrawNo = lottery === 'lotto'
    ? (await getRecentLottoResultsQuery(db, 1))[0]?.drwNo
    : (await getRecentPensionResultsQuery(db, 1))[0]?.draw_no

  if (latestDrawNo == null) return { checked: 0, won: 0 }

  const pending = await getUncheckedSavedPicksQuery(db, lottery, latestDrawNo, CHECK_BATCH_LIMIT)
  if (pending.length === 0) return { checked: 0, won: 0 }

  const checkedAt = new Date().toISOString()
  let checked = 0
  let won = 0

  const byDraw = new Map<number, SavedPickRow[]>()
  for (const row of pending) {
    const list = byDraw.get(row.draw_no) ?? []
    list.push(row)
    byDraw.set(row.draw_no, list)
  }

  for (const [drawNo, rows] of byDraw) {
    if (lottery === 'lotto') {
      const draw = await getLottoResultByDrawNoQuery(db, drawNo)
      if (!draw) continue
      const winning = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6]
      for (const row of rows) {
        const numbers = row.numbers.split(',').map(Number)
        const grade = gradeLottoPick(numbers, winning, draw.bnusNo)
        await markSavedPickCheckedQuery(db, row.id, grade, checkedAt)
        checked += 1
        if (grade.rankNo != null) won += 1
      }
      continue
    }

    const draw = await getPensionResultByDrawNoQuery(db, drawNo)
    if (!draw) continue
    for (const row of rows) {
      // 저장분은 번호만 담는다. 같은 6자리가 1~5조에 모두 있으므로 조별 등위를 보여주려면
      // 추첨된 조를 함께 기억해야 한다 (전 조를 사면 1등 1매 + 2등 4매).
      const grade = { ...gradePensionPick(row.numbers, draw.winning_number, draw.bonus_number), winningBand: draw.winning_band }
      await markSavedPickCheckedQuery(db, row.id, grade, checkedAt)
      checked += 1
      if (grade.rankNo != null) won += 1
    }
  }

  return { checked, won }
}

// ── 기기 간 연동 ──
// 로그인이 없어 저장분은 브라우저가 만든 식별자에 묶인다. 다른 기기에서 이어 보려면
// 그 식별자를 옮겨야 하는데, 식별자 자체를 보여주면 받아 적다 틀리기 쉽고 수명도 없다.
// 대신 짧은 일회용 코드를 발급해 교환한다.

export async function issueTransferCode(db: D1Database, clientId: string) {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  const code = createTransferCode(bytes)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000)

  await deleteExpiredTransferCodesQuery(db, now.toISOString())
  await replaceTransferCodeQuery(db, {
    code_hash: await hashTransferCode(code),
    client_id: clientId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  })

  return { code: formatTransferCode(code), expiresAt: expiresAt.toISOString(), ttlMinutes: CODE_TTL_MINUTES }
}

export type ClaimResult =
  | { ok: true; clientId: string; movedCount: number }
  | { ok: false; reason: 'invalid' | 'same-device' }

// 코드를 쓴 기기가 원래 기기의 식별자를 이어받는다. 그래야 두 기기가 같은 보관함을 본다.
// 쓴 기기에 이미 저장분이 있으면 잃지 않도록 먼저 옮겨 붙인다.
export async function claimTransferCode(db: D1Database, clientId: string, rawCode: string): Promise<ClaimResult> {
  const code = normalizeTransferCode(rawCode)
  if (!code) return { ok: false, reason: 'invalid' }

  const row = await findTransferCodeQuery(db, await hashTransferCode(code), new Date().toISOString())
  if (!row) return { ok: false, reason: 'invalid' }

  if (row.client_id === clientId) {
    await deleteTransferCodeQuery(db, row.code_hash)
    return { ok: false, reason: 'same-device' }
  }

  const movedCount = await reassignSavedPicksQuery(db, clientId, row.client_id)
  // 한 번 쓰면 끝. 실패하더라도 코드가 남지 않도록 합친 뒤 바로 지운다.
  await deleteTransferCodeQuery(db, row.code_hash)

  return { ok: true, clientId: row.client_id, movedCount }
}
