import { useEffect, useRef, useState } from 'react';
import { describeDrawLookupError, fetchLottoResult, fetchLottoResults, fetchLottoResultsUpTo } from '../api';
import { parseDrawNo } from '../format';
import type { DrawResult } from '../types';

// 목록 한 창에 보여줄 회차 수. 보는 회차를 맨 위에 두고 그 아래로 과거를 잇는다.
export const WINDOW_SIZE = 10;

// 회차 브라우저: 뷰어 1개 + 그 회차를 따라 움직이는 목록.
// 화살표·검색·목록 클릭이 모두 selected 하나만 바꾸고, 목록 창은 selected 를 따라간다.
export function useDrawBrowser() {
    const [latestDrawNo, setLatestDrawNo] = useState<number | null>(null);
    const [selected, setSelected] = useState<number | null>(null);
    const [cache, setCache] = useState<Map<number, DrawResult>>(new Map());
    const [loading, setLoading] = useState(true);
    const [windowError, setWindowError] = useState('');

    const [searchInput, setSearchInput] = useState('');
    const [searchError, setSearchError] = useState('');
    const latestWindowRequest = useRef(0);

    const merge = (rows: DrawResult[]) => {
        setCache(prev => {
            const next = new Map(prev);
            for (const row of rows) next.set(row.drwNo, row);
            return next;
        });
    };

    // 첫 로드: 최신 회차를 알아내고 그 창을 채운다
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const rows = await fetchLottoResults(WINDOW_SIZE);
                if (cancelled) return;
                merge(rows);
                const latest = rows[0]?.drwNo ?? null;
                setLatestDrawNo(latest);
                setSelected(latest);
            } catch {
                if (!cancelled) setWindowError('당첨 결과를 불러오지 못했습니다.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    // selected 가 바뀌면 그 회차부터의 창을 확보한다. 이미 캐시에 다 있으면 요청하지 않는다.
    useEffect(() => {
        if (selected === null) return;

        const need = [];
        for (let no = selected; no > Math.max(selected - WINDOW_SIZE, 0); no--) {
            if (!cache.has(no)) need.push(no);
        }
        if (need.length === 0) return;

        const requestId = ++latestWindowRequest.current;
        (async () => {
            try {
                const rows = await fetchLottoResultsUpTo(selected, WINDOW_SIZE);
                if (requestId === latestWindowRequest.current) {
                    merge(rows);
                    setWindowError('');
                }
            } catch {
                if (requestId === latestWindowRequest.current) setWindowError('회차 목록을 불러오지 못했습니다.');
            }
        })();
    }, [selected, cache]);

    const clamp = (no: number) => Math.min(Math.max(no, 1), latestDrawNo ?? no);

    const select = (no: number) => {
        setSearchError('');
        setSelected(clamp(no));
    };

    const changeSearchInput = (value: string) => {
        setSearchInput(value);
        setSearchError('');
    };

    const search = async () => {
        const no = parseDrawNo(searchInput);
        if (no === null) return;
        if (latestDrawNo !== null && no > latestDrawNo) {
            setSearchError(`${no}회차는 아직 없습니다. 최신은 ${latestDrawNo}회입니다.`);
            return;
        }

        if (cache.has(no)) { select(no); return; }

        try {
            merge([await fetchLottoResult(no)]);
            select(no);
        } catch (error) {
            setSearchError(describeDrawLookupError(error, no));
        }
    };

    const windowRows: DrawResult[] = [];
    if (selected !== null) {
        for (let no = selected; no > Math.max(selected - WINDOW_SIZE, 0); no--) {
            const row = cache.get(no);
            if (row) windowRows.push(row);
        }
    }

    return {
        latestDrawNo,
        selected,
        selectedDraw: selected === null ? null : cache.get(selected) ?? null,
        windowRows,
        loading,
        windowError,
        canGoOlder: selected !== null && selected > 1,
        canGoNewer: selected !== null && latestDrawNo !== null && selected < latestDrawNo,
        select,
        shiftWindow: (delta: number) => select((selected ?? 0) + delta),
        searchInput, searchError, changeSearchInput, search,
    };
}

export type DrawBrowserState = ReturnType<typeof useDrawBrowser>;
