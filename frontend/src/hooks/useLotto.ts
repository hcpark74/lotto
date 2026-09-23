import { useEffect, useRef, useState } from 'react';
import { ApiError, fetchLottoBacktest, fetchLottoResult, fetchLottoResults, generateLotto, syncLotto } from '../api';
import { LAST_SYNC_DRAW_STORAGE_KEY, LAST_SYNC_STORAGE_KEY } from '../constants';
import { parseDrawNo } from '../format';
import type { DrawResult, LottoBacktestDiagnostics, LottoRuleWeight, LottoSet } from '../types';
import type { Toast } from './useToast';

export function useLotto(toast: Toast) {
    const [results, setResults] = useState<DrawResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);

    const [sets, setSets] = useState<LottoSet[]>([]);
    const [ruleWeights, setRuleWeights] = useState<LottoRuleWeight[]>([]);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');

    const [backtest, setBacktest] = useState<LottoBacktestDiagnostics | null>(null);
    const [backtestLoading, setBacktestLoading] = useState(false);
    const [backtestFailed, setBacktestFailed] = useState(false);
    const backtestRequested = useRef(false);

    const [syncLoading, setSyncLoading] = useState(false);
    const [lastSyncedDraw, setLastSyncedDraw] = useState<number | null>(() => {
        const saved = localStorage.getItem(LAST_SYNC_DRAW_STORAGE_KEY);
        if (!saved) return null;

        const parsed = Number(saved);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    });
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
        const saved = localStorage.getItem(LAST_SYNC_STORAGE_KEY);
        if (!saved) return null;

        const parsed = new Date(saved);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    });

    const [searchInput, setSearchInput] = useState('');
    const [searchResult, setSearchResult] = useState<DrawResult | null>(null);
    const [searchError, setSearchError] = useState('');

    const loadResults = async () => {
        setResultsLoading(true);

        try {
            setResults(await fetchLottoResults(50));
        } catch {
            setResults([]);
        } finally {
            setResultsLoading(false);
        }
    };

    useEffect(() => {
        loadResults();
    }, []);

    const loadBacktest = async () => {
        backtestRequested.current = true;
        setBacktestLoading(true);
        setBacktestFailed(false);

        try {
            setBacktest(await fetchLottoBacktest(120));
        } catch {
            setBacktest(null);
            setBacktestFailed(true);
        } finally {
            setBacktestLoading(false);
        }
    };

    // 백테스트는 서버 계산 비용이 커서 진단 탭에 처음 들어갈 때만 불러온다
    const ensureBacktest = () => {
        if (!backtestRequested.current) loadBacktest();
    };

    const generate = async () => {
        setGenerating(true);
        setGenerateError('');
        setSets([]);
        setRuleWeights([]);

        try {
            const data = await generateLotto();
            setSets(data.sets);
            setRuleWeights(data.ruleWeights);
        } catch {
            setGenerateError('추천 번호 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setGenerating(false);
        }
    };

    const sync = async () => {
        setSyncLoading(true);
        toast.clear();

        try {
            const data = await syncLotto();
            if (!data?.success) throw new ApiError(200, data?.error ?? '');

            await loadResults();
            const now = new Date();
            setLastSyncedAt(now);
            setLastSyncedDraw(data.latestDraw ?? null);
            localStorage.setItem(LAST_SYNC_STORAGE_KEY, now.toISOString());
            if (data.latestDraw) {
                localStorage.setItem(LAST_SYNC_DRAW_STORAGE_KEY, String(data.latestDraw));
            }

            toast.success(
                data.syncedCount && data.syncedCount > 0
                    ? `${data.syncedCount}개 회차를 새로 가져왔습니다. 최신 ${data.latestDraw}회까지 반영됐어요.`
                    : `이미 최신 상태입니다. 현재 ${data.latestDraw}회까지 반영되어 있어요.`
            );
        } catch (error) {
            toast.error(error instanceof ApiError
                ? error.message || '동기화에 실패했습니다.'
                : '동기화 중 오류가 발생했습니다.');
        } finally {
            setSyncLoading(false);
        }
    };

    const changeSearchInput = (value: string) => {
        setSearchInput(value);
        setSearchResult(null);
        setSearchError('');
    };

    const search = async () => {
        const no = parseDrawNo(searchInput);
        if (no === null) return;

        setSearchError('');
        setSearchResult(null);

        try {
            setSearchResult(await fetchLottoResult(no));
        } catch (error) {
            setSearchError(error instanceof ApiError ? `${no}회차 데이터가 없습니다.` : '조회 중 오류가 발생했습니다.');
        }
    };

    return {
        results, resultsLoading,
        sets, ruleWeights, generating, generateError, generate,
        backtest, backtestLoading, backtestFailed, loadBacktest, ensureBacktest,
        syncLoading, lastSyncedAt, lastSyncedDraw, sync,
        searchInput, searchResult, searchError, changeSearchInput, search,
    };
}

export type LottoState = ReturnType<typeof useLotto>;
