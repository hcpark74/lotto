const LOTTO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://www.dhlottery.co.kr/lt645/result',
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
}

export async function getLatestDrawNo() {
  const response = await fetch('https://www.dhlottery.co.kr/lt645/result', {
    headers: LOTTO_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`최신 회차 조회 실패 (${response.status})`)
  }

  const html = await response.text()
  const match = html.match(/id="opt_val"\s+value="(\d+)"/)

  if (!match) {
    throw new Error('최신 회차 번호를 찾을 수 없습니다.')
  }

  return Number(match[1])
}
