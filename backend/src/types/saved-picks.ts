export type Lottery = 'lotto' | 'pension'

// D1 행 그대로
export type SavedPickRow = {
  id: string
  client_id: string
  lottery: Lottery
  draw_no: number
  numbers: string
  label: string | null
  saved_at: string
  matched_count: number | null
  bonus_matched: number | null
  rank_no: number | null
  checked_at: string | null
  winning_band: string | null
}

// API 응답. client_id 는 돌려주지 않는다 (요청자가 이미 알고 있고, 로그에 남을 이유도 없다).
export type SavedPick = {
  id: string
  lottery: Lottery
  drawNo: number
  // 추첨일 (KST, YYYY-MM-DD). 결과가 들어온 회차는 실제 날짜, 아직이면 최신 회차에서 7일씩 센 예정일.
  drawDate: string | null
  // 추첨 시각 (ISO). drawDate 의 그 복권 추첨 시각이다 — 로또 토 20:35, 연금 목 19:05 KST.
  drawAt: string | null
  numbers: string
  label: string | null
  savedAt: string
  result: {
    matchedCount: number
    bonusMatched: boolean
    rankNo: number | null
    checkedAt: string
    // 연금복권 당첨 조(1~5). 로또는 null.
    winningBand: string | null
    // 그 회차 당첨번호. 저장분의 numbers 와 같은 꼴이라 그대로 맞대어 볼 수 있다
    // (로또 "1,2,3,4,5,6" + 보너스 "7", 연금 6자리 + 보너스 6자리).
    winning: WinningNumbers | null
  } | null
}

export type WinningNumbers = { numbers: string; bonus: string | null }

// 저장분에 곁들일 회차 정보. 두 복권의 행을 한 꼴로 맞춘 것이다.
export type DrawInfo = { drawNo: number; drawDate: string | null; winning: WinningNumbers }

export type SavedPickCheckSummary = {
  checked: number
  won: number
}
