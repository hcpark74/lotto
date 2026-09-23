// API 응답 타입은 백엔드가 정의한 것을 그대로 쓴다 (import 없는 순수 타입 파일이라 번들에 영향 없음).
// 여기서는 프론트에서 쓰던 이름으로 다시 내보내기만 한다.
import type {
    LottoBacktestResponse,
    LottoDrawResult,
    LottoGeneratedSet,
    PensionBacktestResponse,
    PensionDrawDetail,
    PensionDrawResult as PensionDrawSummary,
    RuleWeight,
} from '../../backend/src/types/api';

export type {
    LottoGenerateResponse,
    LottoRulePerformance,
    LottoSyncResponse,
    PensionGenerateResponse,
    PensionRecommendationSet,
    PensionRulePerformance,
    PensionSyncResponse,
    SyncErrorResponse,
} from '../../backend/src/types/api';

export type DrawResult = LottoDrawResult;
export type LottoSet = LottoGeneratedSet;
export type LottoRuleWeight = RuleWeight;
export type LottoBacktestDiagnostics = LottoBacktestResponse;

// 목록 응답에는 prize_counts 가 없고 단건(drawNo=) 응답에만 있다
export type PensionDrawResult = PensionDrawSummary & Partial<Pick<PensionDrawDetail, 'prize_counts'>>;
export type PensionRuleWeight = RuleWeight;
export type PensionBacktestDiagnostics = PensionBacktestResponse;
