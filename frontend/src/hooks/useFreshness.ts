import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshLottery, type RefreshResult } from '../api';
import type { PageLottery } from '../types';

// 추첨이 끝났는데 아직 안 들어온 회차를 받아온다.
// 2026-10-03 에 cron 이 두 번 연속 실패해 결과가 8시간 넘게 낡은 채로 있었다.
// 사용자가 눈치채고 버튼을 눌러야만 고쳐지는 구조는 그때 아무 도움이 안 된다 —
// 그래서 화면에 들어올 때 한 번 자동으로 시도하고, 버튼은 수동 탈출구로 둔다.
//
// 연타해도 안전하다. 서버가 일정으로 먼저 걸러 평소에는 외부 요청을 아예 하지 않고,
// 진짜 뒤처졌을 때만 쿨다운 안에서 한 번 받아온다.
export function useFreshness(lottery: PageLottery, onSynced: () => void) {
    const [state, setState] = useState<RefreshResult['status'] | 'checking' | null>(null);
    const [message, setMessage] = useState('');
    const tried = useRef(false);

    const run = useCallback(async (manual: boolean) => {
        setState('checking');
        setMessage('');

        try {
            const result = await refreshLottery(lottery);
            setState(result.status);

            if (result.status === 'synced' && result.syncedCount > 0) {
                setMessage(result.checkedPicks > 0
                    ? `${result.latestDraw}회를 받아왔습니다. 저장한 번호 ${result.checkedPicks}건도 채점했습니다.`
                    : `${result.latestDraw}회를 받아왔습니다.`);
                onSynced();
            } else if (result.status === 'cooldown') {
                setMessage(`방금 확인했습니다. ${result.retryAfterSeconds}초 뒤에 다시 시도할 수 있습니다.`);
            } else if (manual) {
                // 자동 시도에서는 조용히 넘어간다. 눌렀을 때만 결과를 알린다.
                setMessage(result.status === 'synced' ? '새로 나온 회차가 아직 없습니다.' : '이미 최신입니다.');
            }
        } catch {
            setState(null);
            if (manual) setMessage('지금은 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
    }, [lottery, onSynced]);

    // 화면에 들어올 때 한 번만. 서버가 걸러 주므로 비용이 거의 없다.
    useEffect(() => {
        if (tried.current) return;
        tried.current = true;
        void run(false);
    }, [run]);

    return { state, message, refresh: () => run(true), busy: state === 'checking' };
}
