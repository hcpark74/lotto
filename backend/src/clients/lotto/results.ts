import type { LottoHistoryItem, LottoResultRecord } from '../../types/lotto'

const LOTTO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://www.dhlottery.co.kr/lt645/result',
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
}

function isValidLottoNumber(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 45
}

// 저장 후에는 다시 받지 않으므로 여기서 걸러야 잘못된 행이 영구히 남지 않는다
export function isValidLottoRecord(record: LottoResultRecord) {
  const numbers = [record.drwtNo1, record.drwtNo2, record.drwtNo3, record.drwtNo4, record.drwtNo5, record.drwtNo6]

  return Number.isInteger(record.drwNo) && record.drwNo > 0
    && numbers.every(isValidLottoNumber)
    && new Set(numbers).size === 6
    && isValidLottoNumber(record.bnusNo)
    && !numbers.includes(record.bnusNo)
    && Number.isFinite(record.firstWinamnt) && record.firstWinamnt >= 0
}

export async function fetchLottoResult(drwNo: number): Promise<LottoResultRecord | null> {
  try {
    const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${drwNo}&srchCursorLtEpsd=${drwNo}`
    const response = await fetch(url, {
      headers: LOTTO_HEADERS,
    })

    if (!response.ok) return null

    const data = await response.json() as { data?: { list?: LottoHistoryItem[] } }
    const item = data?.data?.list?.find((row) => row.ltEpsd === drwNo)

    if (!item) return null

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
      firstWinamnt: item.rnk1WnAmt,
    }

    if (!isValidLottoRecord(record)) {
      console.warn(`Invalid lotto result for draw ${drwNo}:`, JSON.stringify(item))
      return null
    }

    return record
  } catch {
    return null
  }
}
