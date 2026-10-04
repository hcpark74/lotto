import { getClientId } from './clientId';
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
    PageLottery,
    SavedPick,
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

// ── 저장한 번호 ──
// 익명 ID 는 헤더로만 보낸다. URL 에 넣으면 로그·리퍼러에 남는다.
function clientHeaders(extra?: HeadersInit): HeadersInit {
    return { 'X-Client-Id': getClientId(), ...extra };
}

export const fetchSavedPicks = (lottery: PageLottery) =>
    request<unknown>(`/api/picks?lottery=${lottery}`, { headers: clientHeaders() }).then(data => toArray<SavedPick>(data));

export const fetchNextDrawNo = (lottery: PageLottery) =>
    request<{ lottery: PageLottery; drawNo: number }>(`/api/picks/next-draw?lottery=${lottery}`);

export const createSavedPick = (lottery: PageLottery, numbers: number[] | string, label: string | null) =>
    request<SavedPick>('/api/picks', {
        method: 'POST',
        headers: clientHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ lottery, numbers, label }),
    });

// 낡았을 때만 새 회차를 받아온다. 토큰이 필요 없는 공개 엔드포인트이고,
// 평소에는 서버가 일정으로 걸러 외부 요청 없이 up-to-date 를 돌려준다.
export type RefreshResult = {
    lottery: PageLottery;
    status: 'up-to-date' | 'cooldown' | 'synced';
    latestDraw: number | null;
    syncedCount: number;
    checkedPicks: number;
    retryAfterSeconds?: number;
};

// 자동 갱신이 제때 돌고 있는지. cron 이 죽은 것과 발표가 늦은 것을 구분해 준다.
export type SyncStatus = {
    lottery: PageLottery;
    latestDraw: number | null;
    latestDrawDate: string | null;
    lastDrawAt: string;
    lastCronAt: string | null;
    lastCronOk: boolean | null;
    lastSuccessAt: string | null;
    cronOverdue: boolean;
    behindSchedule: boolean;
};

export const fetchSyncStatus = (lottery: PageLottery) =>
    request<SyncStatus>(`/api/refresh/status?lottery=${lottery}`);

export const refreshLottery = (lottery: PageLottery) =>
    request<RefreshResult>(`/api/refresh?lottery=${lottery}`, { method: 'POST' });

// 추천은 5세트가 한 번에 나오므로 저장도 한 번에 보낸다 (요청 1번, 한도 검사 1번)
export const createSavedPicks = (lottery: PageLottery, picks: { numbers: number[] | string; label: string | null }[]) =>
    request<SavedPick[]>('/api/picks/bulk', {
        method: 'POST',
        headers: clientHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ lottery, picks }),
    });

export const deleteSavedPick = (id: string) =>
    request<{ success: true }>(`/api/picks/${id}`, { method: 'DELETE', headers: clientHeaders() });

export const issueTransferCode = () =>
    request<{ code: string; expiresAt: string; ttlMinutes: number }>('/api/picks/transfer-code', {
        method: 'POST',
        headers: clientHeaders(),
    });

export const claimTransferCode = (code: string) =>
    request<{ clientId: string; movedCount: number }>('/api/picks/claim', {
        method: 'POST',
        headers: clientHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ code }),
    });
