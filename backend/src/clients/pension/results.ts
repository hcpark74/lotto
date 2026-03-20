import type { Pension720PrizeInfoItem } from '../../types/pension'

const PENSION_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://www.dhlottery.co.kr/pt720/result',
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
}

export async function fetchPensionPrizeCounts(drawNo: number): Promise<Pension720PrizeInfoItem[]> {
  const response = await fetch(`https://www.dhlottery.co.kr/pt720/selectPstPt720WnInfo.do?srchPsltEpsd=${drawNo}`, {
    headers: PENSION_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`연금복권 당첨 통계 조회 실패 (${response.status})`)
  }

  const data = await response.json() as { data?: { result?: Pension720PrizeInfoItem[] } }
  const results = data?.data?.result

  if (!Array.isArray(results)) {
    throw new Error('연금복권 당첨 통계 데이터가 비어 있습니다.')
  }

  return results
}
