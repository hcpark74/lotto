import { useRef, useState } from 'react';

export type BacktestStatus = 'idle' | 'loading' | 'failed' | 'done';

// 백테스트는 서버 계산 비용이 커서 진단 탭에 처음 들어갈 때(ensure)만 요청하고, 받은 결과는 재사용한다.
// 새로고침(load)은 항상 다시 요청한다.
export function useBacktest<T>(fetcher: () => Promise<T>) {
    const [data, setData] = useState<T | null>(null);
    const [status, setStatus] = useState<BacktestStatus>('idle');
    // StrictMode 의 effect 이중 실행에서도 요청이 한 번만 나가도록 state 와 별도로 둔다
    const statusRef = useRef<BacktestStatus>('idle');

    const update = (next: BacktestStatus) => {
        statusRef.current = next;
        setStatus(next);
    };

    const load = async () => {
        update('loading');

        try {
            setData(await fetcher());
            update('done');
        } catch {
            setData(null);
            update('failed');
        }
    };

    // 실패한 뒤 탭에 다시 들어오면 재시도한다
    const ensure = () => {
        if (statusRef.current === 'idle' || statusRef.current === 'failed') load();
    };

    return { data, status, load, ensure };
}
