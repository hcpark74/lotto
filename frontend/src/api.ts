import type {
    DrawResult,
    LottoBacktestDiagnostics,
    LottoGenerateResponse,
    LottoRuleWeight,
    LottoSet,
    PensionBacktestDiagnostics,
    PensionDrawResult,
    PensionGenerateResponse,
    PensionRecommendationSet,
    PensionRuleWeight,
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

// 서버가 응답은 했지만 2xx 가 아닌 경우. message 는 서버의 { error } 이고 없으면 빈 문자열.
export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

// 회차 조회 실패 문구. "데이터 없음"은 404 일 때만 맞다.
export function describeDrawLookupError(error: unknown, drawNo: number) {
    if (error instanceof ApiError && error.status === 404) return `${drawNo}회차 데이터가 없습니다.`;
    if (error instanceof ApiError && error.status === 400) return '회차 번호를 확인해 주세요. 1 이상의 정수만 조회할 수 있습니다.';
    return '조회 중 오류가 발생했습니다.';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, init);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, typeof data?.error === 'string' ? data.error : '');
    return data as T;
}

function toArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? value : [];
}

// ── 로또 ──

export const fetchLottoResults = (limit: number) =>
    request<unknown>(`/api/results?limit=${limit}`).then(data => toArray<DrawResult>(data));

export const fetchLottoResult = (drwNo: number) =>
    request<DrawResult>(`/api/results?drwNo=${drwNo}`);

// drwNo 이하에서 최신순 limit 개
export const fetchLottoResultsUpTo = (drwNo: number, limit: number) =>
    request<unknown>(`/api/results?to=${drwNo}&limit=${limit}`).then(data => toArray<DrawResult>(data));

export const generateLotto = () =>
    request<LottoGenerateResponse>('/api/generate', { method: 'POST' })
        .then(data => ({ sets: toArray<LottoSet>(data?.sets), ruleWeights: toArray<LottoRuleWeight>(data?.ruleWeights) }));

export const fetchLottoBacktest = (draws: number) =>
    request<LottoBacktestDiagnostics>(`/api/generate/backtest?draws=${draws}`);

// ── 연금복권 ──

// 목록 응답이 단건 객체로 올 때도 배열로 맞춘다
export const fetchPensionResults = (limit: number) =>
    request<unknown>(`/api/pension/results?limit=${limit}`)
        .then(data => (Array.isArray(data) ? data : data ? [data] : []) as PensionDrawResult[]);

// draw_no 이하에서 최신순 limit 개
export const fetchPensionResultsUpTo = (drawNo: number, limit: number) =>
    request<unknown>(`/api/pension/results?to=${drawNo}&limit=${limit}`).then(data => toArray<PensionDrawResult>(data));

export const fetchPensionResult = (drawNo: number) =>
    request<PensionDrawResult>(`/api/pension/results?drawNo=${drawNo}`);

export const generatePension = () =>
    request<PensionGenerateResponse>('/api/pension/generate', { method: 'POST' })
        .then(data => ({ sets: toArray<PensionRecommendationSet>(data?.sets), ruleWeights: toArray<PensionRuleWeight>(data?.ruleWeights) }));

export const fetchPensionBacktest = (draws: number) =>
    request<PensionBacktestDiagnostics>(`/api/pension/generate/backtest?draws=${draws}`);
