import type { LottoHistoryItem, LottoPrizeStats, LottoResultRecord } from '../../types/lotto'
import { LOTTO_HEADERS } from '../dhlottery'

function isValidLottoNumber(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 45
}

// 당첨금은 보조 정보라 검증 대상이 아니다. 여기서 거부하면 sync 가 그 회차에서 멈추므로 null 로 저장한다.
export function parseFirstPrizeAmount(value: unknown) {
  if (value == null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function toCount(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// 추첨 직후에는 등위별 집계가 아직 없다. 판매액이 비어 있으면 집계 전으로 보고 통째로 null 을 돌려준다.
// (0 인 등위는 실제로 있을 수 있어 개별 값만으로는 집계 전인지 구분할 수 없다.)
export function parsePrizeStats(item: LottoHistoryItem): LottoPrizeStats | null {
  const salesAmount = Number(item.rlvtEpsdSumNtslAmt)
  if (!Number.isFinite(salesAmount) || salesAmount <= 0) return null

  return {
    rnk1WnNope: toCount(item.rnk1WnNope),
    rnk2WnNope: toCount(item.rnk2WnNope),
    rnk3WnNope: toCount(item.rnk3WnNope),
    rnk4WnNope: toCount(item.rnk4WnNope),
    rnk5WnNope: toCount(item.rnk5WnNope),
    rnk1SumWnAmt: toCount(item.rnk1SumWnAmt),
    rnk2SumWnAmt: toCount(item.rnk2SumWnAmt),
    rnk3SumWnAmt: toCount(item.rnk3SumWnAmt),
    rnk4SumWnAmt: toCount(item.rnk4SumWnAmt),
    rnk5SumWnAmt: toCount(item.rnk5SumWnAmt),
    salesAmount,
    winType1: toCount(item.winType1),
    winType2: toCount(item.winType2),
    winType3: toCount(item.winType3),
  }
}

// 저장 후에는 다시 받지 않으므로 여기서 걸러야 잘못된 행이 영구히 남지 않는다
export function isValidLottoRecord(record: LottoResultRecord) {
  const numbers = [record.drwtNo1, record.drwtNo2, record.drwtNo3, record.drwtNo4, record.drwtNo5, record.drwtNo6]

  return Number.isInteger(record.drwNo) && record.drwNo > 0
    && numbers.every(isValidLottoNumber)
    && new Set(numbers).size === 6
    && isValidLottoNumber(record.bnusNo)
    && !numbers.includes(record.bnusNo)
}

// null: 아직 발표 전이거나 응답 값이 검증에 실패한 회차 (sync 가 거기서 멈추고 다음에 재시도)
// throw: 요청 자체가 실패한 경우 (네트워크 오류, HTTP 오류, JSON 이 아닌 응답)
export async function fetchLottoResult(drwNo: number): Promise<LottoResultRecord | null> {
  const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${drwNo}&srchCursorLtEpsd=${drwNo}`
  let response: Response

  try {
    response = await fetch(url, { headers: LOTTO_HEADERS })
  } catch (error) {
    throw new Error(`로또 ${drwNo}회 조회 실패 (네트워크: ${error instanceof Error ? error.message : String(error)})`)
  }

  if (!response.ok) {
    throw new Error(`로또 ${drwNo}회 조회 실패 (${response.status})`)
  }

  let data: { data?: { list?: LottoHistoryItem[] } }
  try {
    data = await response.json()
  } catch {
    throw new Error(`로또 ${drwNo}회 조회 실패 (JSON 이 아닌 응답)`)
  }

  const item = data?.data?.list?.find((row) => row.ltEpsd === drwNo)

  if (!item) return null

  return toLottoResultRecord(item)
}

// 응답 한 건 → 저장 레코드. 날짜 형식이나 번호 검증에 실패하면 null (그 회차만 건너뛴다).
export function toLottoResultRecord(item: LottoHistoryItem): LottoResultRecord | null {
  const date = String(item.ltRflYmd)
  if (!/^\d{8}$/.test(date)) {
    console.warn(`Invalid date format for draw ${item.ltEpsd}: ${date}`)
    return null
  }

  const record: LottoResultRecord = {
    drwNo: item.ltEpsd,
    drwNoDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    drwtNo1: item.tm1WnNo,
    drwtNo2: item.tm2WnNo,
    drwtNo3: item.tm3WnNo,
    drwtNo4: item.tm4WnNo,
    drwtNo5: item.tm5WnNo,
    drwtNo6: item.tm6WnNo,
    bnusNo: item.bnsWnNo,
    firstWinamnt: parseFirstPrizeAmount(item.rnk1WnAmt),
    prizeStats: parsePrizeStats(item),
  }

  if (!isValidLottoRecord(record)) {
    console.warn(`Invalid lotto result for draw ${item.ltEpsd}:`, JSON.stringify(item))
    return null
  }

  return record
}

// 한 호출이 요청 회차를 가운데 두고 10회차를 돌려준다 (앞 4 + 요청 + 뒤 5).
// 백필은 이 창을 그대로 받아 호출 수를 1/10 로 줄인다.
export const LOTTO_WINDOW_SIZE = 10

export async function fetchLottoResultWindow(cursorDrwNo: number): Promise<LottoResultRecord[]> {
  const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${cursorDrwNo}&srchCursorLtEpsd=${cursorDrwNo}`
  const response = await fetch(url, { headers: LOTTO_HEADERS })
  if (!response.ok) throw new Error(`로또 ${cursorDrwNo}회 주변 조회 실패 (${response.status})`)

  const data = await response.json() as { data?: { list?: LottoHistoryItem[] } }
  const list = data?.data?.list ?? []

  return list.map(toLottoResultRecord).filter((row): row is LottoResultRecord => row !== null)
}
