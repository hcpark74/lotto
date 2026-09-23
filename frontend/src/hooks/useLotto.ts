import { useEffect, useState } from 'react';
import { fetchLottoBacktest, fetchLottoResult, fetchLottoResults, generateLotto } from '../api';
import { BACKTEST_DRAWS } from '../constants';
import type { DrawResult, LottoRuleWeight, LottoSet } from '../types';
import { useBacktest } from './useBacktest';
import { useDrawSearch } from './useDrawSearch';

export function useLotto() {
    const [results, setResults] = useState<DrawResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);

    const [sets, setSets] = useState<LottoSet[]>([]);
    const [ruleWeights, setRuleWeights] = useState<LottoRuleWeight[]>([]);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');

    const { data: backtest, status: backtestStatus, load: loadBacktest, ensure: ensureBacktest } = useBacktest(() => fetchLottoBacktest(BACKTEST_DRAWS));

    const { searchInput, searchResult, searchError, changeSearchInput, search } = useDrawSearch(fetchLottoResult);

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

    return {
        results, resultsLoading,
        sets, ruleWeights, generating, generateError, generate,
        backtest, backtestStatus, loadBacktest, ensureBacktest,
        searchInput, searchResult, searchError, changeSearchInput, search,
    };
}

export type LottoState = ReturnType<typeof useLotto>;
