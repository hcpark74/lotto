import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, createSavedPick, deleteSavedPick, fetchSavedPicks } from '../api';
import type { PageLottery, SavedPick } from '../types';

export function useSavedPicks(lottery: PageLottery) {
    const [picks, setPicks] = useState<SavedPick[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const loaded = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            setPicks(await fetchSavedPicks(lottery));
            loaded.current = true;
        } catch {
            setError('저장한 번호를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [lottery]);

    // 복권을 바꾸면 목록을 다시 받는다
    useEffect(() => {
        loaded.current = false;
        setPicks([]);
    }, [lottery]);

    const ensure = useCallback(() => {
        if (!loaded.current && !loading) void load();
    }, [load, loading]);

    // key 는 같은 번호를 두 번 누르는 걸 막기 위한 화면상의 식별자다 (세트 인덱스 등)
    const save = useCallback(async (key: string, numbers: number[] | string, label: string | null) => {
        setSavingKey(key);
        setError('');

        try {
            const created = await createSavedPick(lottery, numbers, label);
            setPicks(prev => [created, ...prev]);
            return true;
        } catch (err) {
            setError(err instanceof ApiError && err.message ? err.message : '저장에 실패했습니다.');
            return false;
        } finally {
            setSavingKey(null);
        }
    }, [lottery]);

    const remove = useCallback(async (id: string) => {
        const before = picks;
        setPicks(prev => prev.filter(p => p.id !== id));

        try {
            await deleteSavedPick(id);
        } catch {
            setPicks(before);
            setError('삭제하지 못했습니다.');
        }
    }, [picks]);

    return { picks, loading, error, savingKey, load, ensure, save, remove };
}

export type SavedPicksState = ReturnType<typeof useSavedPicks>;
