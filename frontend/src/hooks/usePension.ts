import { useEffect, useState } from 'react';
import { ApiError, describeDrawLookupError, fetchPensionBacktest, fetchPensionResult, fetchPensionResults, generatePension } from '../api';
import { BACKTEST_DRAWS } from '../constants';
import { parseDrawNo } from '../format';
import type { PensionDrawResult, PensionRecommendationSet, PensionRuleWeight } from '../types';
import { useBacktest } from './useBacktest';

export function usePension() {
    const [latestDraw, setLatestDraw] = useState<PensionDrawResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [recommendations, setRecommendations] = useState<PensionRecommendationSet[]>([]);
    const [ruleWeights, setRuleWeights] = useState<PensionRuleWeight[]>([]);
    const [generateLoading, setGenerateLoading] = useState(false);
    const [generateError, setGenerateError] = useState('');

    const { data: backtest, status: backtestStatus, load: loadBacktest, ensure: ensureBacktest } = useBacktest(() => fetchPensionBacktest(BACKTEST_DRAWS));

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
            setSearchError(describeDrawLookupError(err, no));
        }
    };

    return {
        latestDraw, loading, error,
        recommendations, ruleWeights, generateLoading, generateError, generate,
        backtest, backtestStatus, loadBacktest, ensureBacktest,
        searchInput, searchResult, searchError, changeSearchInput, search,
    };
}

export type PensionState = ReturnType<typeof usePension>;
