import { useEffect, useState } from 'react';
import { fetchNextDraw, type NextDraw } from '../api';
import type { PageLottery } from '../types';

// 저장 버튼이 "몇 회차에 담기는지" 말할 수 있게 한다.
// 못 받아오면 null 이고, 화면은 회차를 말하지 않는 예전 문구로 물러난다 — 저장 자체는
// 서버가 회차를 정하므로 이 값 없이도 된다.
// enabled: 저장 버튼이 보이는 탭에서만 묻는다.
export function useNextDraw(lottery: PageLottery, enabled = true) {
    const [next, setNext] = useState<NextDraw | null>(null);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        const load = () => {
            fetchNextDraw(lottery)
                .then(data => { if (!cancelled) setNext(data); })
                .catch(() => { /* 보조 정보다. 실패해도 저장은 된다. */ });
        };

        // 탭을 열어 둔 채 추첨 시각을 넘기면 대상 회차가 바뀐다. 돌아올 때 다시 묻는다.
        const onVisible = () => { if (document.visibilityState === 'visible') load(); };

        load();
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [lottery, enabled]);

    return next;
}
