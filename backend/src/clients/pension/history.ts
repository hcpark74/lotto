import type { Pension720ListItem } from '../../types/pension'
import { PENSION_HEADERS } from '../dhlottery'

export async function fetchPensionDrawList(): Promise<Pension720ListItem[]> {
  const response = await fetch('https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do', {
    headers: PENSION_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`연금복권 회차 목록 조회 실패 (${response.status})`)
  }

  const data = await response.json() as { data?: { result?: Pension720ListItem[] } }
  const results = data?.data?.result

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('연금복권 회차 목록 데이터가 비어 있습니다.')
  }

  return results
}

export function findLatestPensionDrawNo(draws: Pension720ListItem[]) {
  let maxDrawNo = 0

  for (const draw of draws) {
    const drawNo = Number(draw.psltEpsd)
    if (Number.isFinite(drawNo) && drawNo > maxDrawNo) {
      maxDrawNo = drawNo
    }
  }

  if (maxDrawNo <= 0) {
    throw new Error('연금복권 최신 회차 번호를 찾을 수 없습니다.')
  }

  return maxDrawNo
}

export async function getLatestPensionDrawNo() {
  return findLatestPensionDrawNo(await fetchPensionDrawList())
}
