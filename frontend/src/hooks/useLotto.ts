import { useEffect, useState } from 'react';
import { ApiError, fetchLottoBacktest, fetchLottoResult, fetchLottoResults, generateLotto } from '../api';
import { BACKTEST_DRAWS } from '../constants';
import { parseDrawNo } from '../format';
import type { DrawResult, LottoRuleWeight, LottoSet } from '../types';
import { useBacktest } from './useBacktest';

export function useLotto() {
    const [results, setResults] = useState<DrawResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);

    const [sets, setSets] = useState<LottoSet[]>([]);
    const [ruleWeights, setRuleWeights] = useState<LottoRuleWeight[]>([]);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');

    const { data: backtest, status: backtestStatus, load: loadBacktest, ensure: ensureBacktest } = useBacktest(() => fetchLottoBacktest(BACKTEST_DRAWS));

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
        backtest, backtestStatus, loadBacktest, ensureBacktest,
        searchInput, searchResult, searchError, changeSearchInput, search,
    };
}

export type LottoState = ReturnType<typeof useLotto>;
