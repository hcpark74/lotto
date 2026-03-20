export type DrawNumbersRow = {
  drwNo?: number
  drwtNo1: number
  drwtNo2: number
  drwtNo3: number
  drwtNo4: number
  drwtNo5: number
  drwtNo6: number
  bnusNo?: number
}

export type GeneratedSet = {
  label: string
  numbers: number[]
  meta?: {
    ruleId?: string
    ruleWeight?: number
    sum: number
    oddCount: number
    maxConsecutiveRun: number
    passedRules: string[]
  }
}

export type LottoHistoryItem = {
  ltEpsd: number
  ltRflYmd: string
  tm1WnNo: number
  tm2WnNo: number
  tm3WnNo: number
  tm4WnNo: number
  tm5WnNo: number
  tm6WnNo: number
  bnsWnNo: number
  rnk1WnAmt: number
}

export type LottoResultRecord = {
  drwNo: number
  drwNoDate: string
  drwtNo1: number
  drwtNo2: number
  drwtNo3: number
  drwtNo4: number
  drwtNo5: number
  drwtNo6: number
  bnusNo: number
  firstWinamnt: number
}

export type LottoHistoryQueryRow = DrawNumbersRow & {
  drwNo: number
  drwNoDate: string
  firstWinamnt?: number
}
