import { useState } from 'react';
import { fetchLottoBacktest, generateLotto } from '../api';
import { BACKTEST_DRAWS } from '../constants';
import type { LottoRuleWeight, LottoSet } from '../types';
import { useBacktest } from './useBacktest';

export function useLotto() {
    const [sets, setSets] = useState<LottoSet[]>([]);
    const [ruleWeights, setRuleWeights] = useState<LottoRuleWeight[]>([]);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');

    const { data: backtest, status: backtestStatus, load: loadBacktest, ensure: ensureBacktest } = useBacktest(() => fetchLottoBacktest(BACKTEST_DRAWS));

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
        sets, ruleWeights, generating, generateError, generate,
        backtest, backtestStatus, loadBacktest, ensureBacktest,
    };
}

export type LottoState = ReturnType<typeof useLotto>;
