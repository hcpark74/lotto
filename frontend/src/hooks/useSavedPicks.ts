import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, createSavedPick, createSavedPicks, deleteSavedPick, fetchSavedPicks } from '../api';
import type { PageLottery, SavedPick } from '../types';

// 삭제를 되돌릴 수 있는 시간. 이 동안은 서버에 아무것도 보내지 않는다.
export const UNDO_WINDOW_MS = 5000;

function without(set: ReadonlySet<string>, ids: string[]) {
    const next = new Set(set);
    for (const id of ids) next.delete(id);
    return next;
}

export function useSavedPicks(lottery: PageLottery) {
    const [picks, setPicks] = useState<SavedPick[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [savingKey, setSavingKey] = useState<string | null>(null);
    // 삭제를 눌렀지만 아직 되돌릴 수 있는 저장분. 목록에는 남아 있고 줄이 "실행 취소" 로 바뀐다.
    const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(new Set());
    const removeTimers = useRef(new Map<string, number>());
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

    // 추천 세트 전체를 한 번에 저장한다. 요청 1번이라 일부만 저장되는 중간 상태가 없다.
    const saveAll = useCallback(async (key: string, entries: { numbers: number[] | string; label: string | null }[]) => {
        setSavingKey(key);
        setError('');

        try {
            const created = await createSavedPicks(lottery, entries);
            setPicks(prev => [...created, ...prev]);
            return true;
        } catch (err) {
            setError(err instanceof ApiError && err.message ? err.message : '저장에 실패했습니다.');
            return false;
        } finally {
            setSavingKey(null);
        }
    }, [lottery]);

    // 되돌릴 시간이 지났다. 여기서 처음으로 서버에 삭제를 보낸다.
    const commitRemove = useCallback(async (id: string) => {
        removeTimers.current.delete(id);

        try {
            await deleteSavedPick(id);
            setPicks(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            // 이미 없는 행이면 (다른 기기에서 지웠다) 지워진 것으로 본다
            if (err instanceof ApiError && err.status === 404) setPicks(prev => prev.filter(p => p.id !== id));
            else setError('삭제하지 못했습니다.');
        } finally {
            setRemovingIds(prev => without(prev, [id]));
        }
    }, []);

    // 삭제는 바로 보내지 않는다. 저장 회차는 서버가 정하므로 지난 회차의 기록은
    // 한 번 지우면 다시 만들 수 없다 — 잘못 누른 손가락에 되돌릴 시간을 준다.
    const remove = useCallback((id: string) => {
        if (removeTimers.current.has(id)) return;

        setError('');
        setRemovingIds(prev => new Set(prev).add(id));
        removeTimers.current.set(id, window.setTimeout(() => void commitRemove(id), UNDO_WINDOW_MS));
    }, [commitRemove]);

    const undoRemove = useCallback((id: string) => {
        const timer = removeTimers.current.get(id);
        // 타이머가 없으면 삭제 요청이 이미 나간 뒤다
        if (timer == null) return;

        window.clearTimeout(timer);
        removeTimers.current.delete(id);
        setRemovingIds(prev => without(prev, [id]));
    }, []);

    // 되돌릴 시간을 기다리는 사이에 탭을 옮기거나 페이지를 닫으면, 사용자가 누른 삭제가
    // 조용히 없던 일이 된다. 떠나는 순간에 남은 삭제를 모두 보낸다.
    useEffect(() => {
        const flush = () => {
            const ids = [...removeTimers.current.keys()];
            if (ids.length === 0) return;

            for (const [id, timer] of removeTimers.current) {
                window.clearTimeout(timer);
                void deleteSavedPick(id, { keepalive: true }).catch(() => { /* 떠나는 중이라 알릴 곳이 없다 */ });
            }
            removeTimers.current.clear();

            // 뒤로 가기 캐시에서 페이지가 되살아날 수 있다. 보낸 삭제는 화면에서도 지운다.
            setPicks(prev => prev.filter(p => !ids.includes(p.id)));
            setRemovingIds(prev => without(prev, ids));
        };

        window.addEventListener('pagehide', flush);
        return () => {
            window.removeEventListener('pagehide', flush);
            flush();
        };
    }, []);

    return { picks, loading, error, savingKey, removingIds, load, ensure, save, saveAll, remove, undoRemove };
}

export type SavedPicksState = ReturnType<typeof useSavedPicks>;
