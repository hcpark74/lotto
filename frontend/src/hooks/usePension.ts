import { useState } from 'react';
import { fetchPensionBacktest, generatePension } from '../api';
import { BACKTEST_DRAWS } from '../constants';
import type { PensionRecommendationSet, PensionRuleWeight } from '../types';
import { useBacktest } from './useBacktest';

export function usePension() {
    const [recommendations, setRecommendations] = useState<PensionRecommendationSet[]>([]);
    const [ruleWeights, setRuleWeights] = useState<PensionRuleWeight[]>([]);
    const [generateLoading, setGenerateLoading] = useState(false);
    const [generateError, setGenerateError] = useState('');

    const { data: backtest, status: backtestStatus, load: loadBacktest, ensure: ensureBacktest } = useBacktest(() => fetchPensionBacktest(BACKTEST_DRAWS));

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

    return {
        recommendations, ruleWeights, generateLoading, generateError, generate,
        backtest, backtestStatus, loadBacktest, ensureBacktest,
    };
}

export type PensionState = ReturnType<typeof usePension>;
