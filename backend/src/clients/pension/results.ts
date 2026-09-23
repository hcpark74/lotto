import type { Pension720PrizeInfoItem } from '../../types/pension'
import { PENSION_HEADERS } from '../dhlottery'

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
