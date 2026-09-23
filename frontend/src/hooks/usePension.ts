import { useEffect, useRef, useState } from 'react';
import { ApiError, fetchPensionBacktest, fetchPensionResult, fetchPensionResults, generatePension, syncPension } from '../api';
import { parseDrawNo } from '../format';
import type { PensionBacktestDiagnostics, PensionDrawResult, PensionRecommendationSet, PensionRuleWeight } from '../types';
import type { Toast } from './useToast';

export function usePension(toast: Toast) {
    const [latestDraw, setLatestDraw] = useState<PensionDrawResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [recommendations, setRecommendations] = useState<PensionRecommendationSet[]>([]);
    const [ruleWeights, setRuleWeights] = useState<PensionRuleWeight[]>([]);
    const [generateLoading, setGenerateLoading] = useState(false);
    const [generateError, setGenerateError] = useState('');

    const [backtest, setBacktest] = useState<PensionBacktestDiagnostics | null>(null);
    const [backtestLoading, setBacktestLoading] = useState(false);
    const [backtestFailed, setBacktestFailed] = useState(false);
    const backtestRequested = useRef(false);

    const [syncLoading, setSyncLoading] = useState(false);

    const [searchInput, setSearchInput] = useState('');
    const [searchResult, setSearchResult] = useState<PensionDrawResult | null>(null);
    const [searchError, setSearchError] = useState('');

    // prize_counts 는 단건 조회 응답에만 있어서 최신 회차는 drawNo 로 다시 받는다
    const loadLatest = async () => {
        setLoading(true);
        setError('');

        try {
            const [latest] = await fetchPensionResults(1);
            if (latest?.draw_no) {
                setLatestDraw(await fetchPensionResult(latest.draw_no).catch(() => latest));
            } else {
                setLatestDraw(latest ?? null);
            }
        } catch (err) {
            setError(err instanceof ApiError ? '연금복권 결과를 불러오지 못했습니다.' : '연금복권 결과 조회 중 오류가 발생했습니다.');
            setLatestDraw(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLatest();
    }, []);

    const loadBacktest = async () => {
        backtestRequested.current = true;
        setBacktestLoading(true);
        setBacktestFailed(false);

        try {
            setBacktest(await fetchPensionBacktest(120));
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
        setGenerateLoading(true);
        setGenerateError('');
        setRecommendations([]);
        setRuleWeights([]);

        try {
            const data = await generatePension();
            setRecommendations(data.sets);
            setRuleWeights(data.ruleWeights);
        } catch {
            setGenerateError('연금복권 추천번호 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setGenerateLoading(false);
        }
    };

    const sync = async () => {
        setSyncLoading(true);
        toast.clear();

        try {
            const data = await syncPension();
            if (!data?.success) throw new ApiError(200, data?.error ?? '');

            await loadLatest();
            toast.success(
                data.syncedCount && data.syncedCount > 0
                    ? `${data.syncedCount}개 연금복권 회차를 새로 가져왔습니다. 최신 ${data.latestDraw}회까지 반영됐어요.`
                    : `연금복권은 이미 최신 상태입니다. 현재 ${data.latestDraw}회까지 반영되어 있어요.`
            );
        } catch (err) {
            toast.error(err instanceof ApiError
                ? err.message || '연금복권 동기화에 실패했습니다.'
                : '연금복권 동기화 중 오류가 발생했습니다.');
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
            setSearchResult(await fetchPensionResult(no));
        } catch (err) {
            setSearchError(err instanceof ApiError ? `${no}회차 데이터가 없습니다.` : '조회 중 오류가 발생했습니다.');
        }
    };

    return {
        latestDraw, loading, error,
        recommendations, ruleWeights, generateLoading, generateError, generate,
        backtest, backtestLoading, backtestFailed, loadBacktest, ensureBacktest,
        syncLoading, sync,
        searchInput, searchResult, searchError, changeSearchInput, search,
    };
}

export type PensionState = ReturnType<typeof usePension>;
