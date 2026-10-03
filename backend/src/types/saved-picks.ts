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
  } | null
}

export type SavedPickCheckSummary = {
  checked: number
  won: number
}
