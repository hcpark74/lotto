// 응답 타입의 정의는 types/api.ts 에 있다. 기존 이름을 유지하기 위한 별칭.
export type {
  LottoBacktestResponse as LottoBacktestSummary,
  LottoGenerateResponse as LottoGenerateSummary,
  LottoHotNumber,
  LottoSyncSummary,
} from '../api'
