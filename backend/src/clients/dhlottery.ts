// 동행복권 AJAX 엔드포인트는 브라우저 요청처럼 보이는 헤더와 결과 페이지 Referer 를 요구한다
export function dhlotteryHeaders(referer: string) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Referer: referer,
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
}

export const LOTTO_HEADERS = dhlotteryHeaders('https://www.dhlottery.co.kr/lt645/result')
export const PENSION_HEADERS = dhlotteryHeaders('https://www.dhlottery.co.kr/pt720/result')
