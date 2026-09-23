import type {
    DrawResult,
    LottoBacktestDiagnostics,
    LottoRuleWeight,
    LottoSet,
    PensionBacktestDiagnostics,
    PensionDrawResult,
    PensionRecommendationSet,
    PensionRuleWeight,
    SyncResponse,
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

// 서버가 응답은 했지만 2xx 가 아닌 경우. message 는 서버의 { error } 이고 없으면 빈 문자열.
export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
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

export const generateLotto = () =>
    request<{ sets?: LottoSet[]; ruleWeights?: LottoRuleWeight[] }>('/api/generate', { method: 'POST' })
        .then(data => ({ sets: toArray<LottoSet>(data?.sets), ruleWeights: toArray<LottoRuleWeight>(data?.ruleWeights) }));

export const fetchLottoBacktest = (draws: number) =>
    request<LottoBacktestDiagnostics>(`/api/generate/backtest?draws=${draws}`);

export const syncLotto = () =>
    request<Partial<SyncResponse> & { error?: string }>('/api/sync', { method: 'POST' });

// ── 연금복권 ──

// 목록 응답이 단건 객체로 올 때도 배열로 맞춘다
export const fetchPensionResults = (limit: number) =>
    request<unknown>(`/api/pension/results?limit=${limit}`)
        .then(data => (Array.isArray(data) ? data : data ? [data] : []) as PensionDrawResult[]);

export const fetchPensionResult = (drawNo: number) =>
    request<PensionDrawResult>(`/api/pension/results?drawNo=${drawNo}`);

export const generatePension = () =>
    request<{ sets?: PensionRecommendationSet[]; ruleWeights?: PensionRuleWeight[] }>('/api/pension/generate', { method: 'POST' })
        .then(data => ({ sets: toArray<PensionRecommendationSet>(data?.sets), ruleWeights: toArray<PensionRuleWeight>(data?.ruleWeights) }));

export const fetchPensionBacktest = (draws: number) =>
    request<PensionBacktestDiagnostics>(`/api/pension/generate/backtest?draws=${draws}`);

export const syncPension = () =>
    request<Partial<SyncResponse> & { error?: string }>('/api/pension/sync', { method: 'POST' });
