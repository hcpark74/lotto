import type { LottoDrawResult, LottoGeneratedSet } from '../api'

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

export type GeneratedSet = LottoGeneratedSet

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
  // 집계 전(추첨 직후)에는 오지 않거나 0 이다
  rnk1WnNope?: number
  rnk2WnNope?: number
  rnk3WnNope?: number
  rnk4WnNope?: number
  rnk5WnNope?: number
  rnk1SumWnAmt?: number
  rnk2SumWnAmt?: number
  rnk3SumWnAmt?: number
  rnk4SumWnAmt?: number
  rnk5SumWnAmt?: number
  rlvtEpsdSumNtslAmt?: number
  winType1?: number
  winType2?: number
  winType3?: number
}

// 등위별 당첨자 수·지급액과 판매액. 집계 전이면 통째로 null 이다.
export type LottoPrizeStats = {
  rnk1WnNope: number
  rnk2WnNope: number
  rnk3WnNope: number
  rnk4WnNope: number
  rnk5WnNope: number
  rnk1SumWnAmt: number
  rnk2SumWnAmt: number
  rnk3SumWnAmt: number
  rnk4SumWnAmt: number
  rnk5SumWnAmt: number
  salesAmount: number
  winType1: number
  winType2: number
  winType3: number
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
  firstWinamnt: number | null
  prizeStats: LottoPrizeStats | null
}

// SELECT * FROM lotto_history 한 행 = API 응답 한 건
export type LottoHistoryQueryRow = LottoDrawResult
