// 응답 타입의 정의는 types/api.ts 에 있다. 기존 이름을 유지하기 위한 별칭.
export type {
  PensionBacktestResponse as PensionBacktestSummary,
  PensionGenerateResponse as PensionGenerateSummary,
  PensionSyncSummary as Pension720SyncSummary,
} from '../api'
