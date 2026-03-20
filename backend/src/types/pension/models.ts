export type Pension720DrawRecord = {
  draw_no: number
  draw_date: string
  winning_band: string
  winning_number: string
  bonus_number: string
  synced_at: string
  raw_payload?: string
}

export type Pension720PrizeCountRecord = {
  draw_no: number
  rank_no: number
  internet_count: number
  store_count: number
  total_count: number
  win_amount: number | null
  total_amount: number | null
  raw_payload?: string
}

export type Pension720ListItem = {
  psltEpsd?: number | string
  psltRflYmd?: string
  wnBndNo?: number | string
  wnRnkVl?: number | string
  bnsRnkVl?: number | string
  [key: string]: unknown
}

export type Pension720PrizeInfoItem = {
  ltEpsd?: number | string
  wnRnk?: number | string
  wnInternetCnt?: number | string
  wnStoreCnt?: number | string
  wnTotalCnt?: number | string
  wnAmt?: number | string
  totAmt?: number | string
  [key: string]: unknown
}

export type PensionRecommendationSet = {
  label: string
  number: string
  meta: {
    ruleId?: string
    ruleWeight?: number
    sum: number
    oddCount: number
    uniqueDigitCount: number
    maxDuplicateCount: number
    hasThreeConsecutive: boolean
  }
}

export type Pension720PrizeCountQueryRow = {
  rank_no: number
  internet_count: number
  store_count: number
  total_count: number
  win_amount: number | null
  total_amount: number | null
}

export type Pension720ResultQueryRow = {
  draw_no: number
  draw_date: string
  winning_band: string
  winning_number: string
  bonus_number: string
  synced_at: string
}

export type PensionWinningNumberRow = {
  winning_number: string
}

export type PensionBacktestRow = {
  draw_no: number
  winning_number: string
}

export type Pension720ResultDetail = Pension720ResultQueryRow & {
  prize_counts: Pension720PrizeCountQueryRow[]
}
