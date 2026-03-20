import type { LottoHistoryItem, LottoResultRecord } from '../../types/lotto'

const LOTTO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://www.dhlottery.co.kr/lt645/result',
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
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

    return {
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
  } catch {
    return null
  }
}
