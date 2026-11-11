import { useEffect, useState } from 'react';
import { formatRemaining } from '../format';

const HOUR_MS = 3_600_000;

// 추첨까지 남은 시간을 센다. 한 시간 안쪽이면 초 단위로, 그보다 멀면 표시가 분 단위라
// 30초에 한 번만 깨어난다. 시각이 지나면 멈추고 doneText 를 낸다 — 결과는 추첨 뒤
// 한 시간쯤 지나야 들어오므로 그 사이에는 "결과 대기 중" 이 맞는 말이다.
export function Countdown({ at, doneText = '추첨 완료 · 결과 대기 중' }: { at: string; doneText?: string }) {
    const target = new Date(at).getTime();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        let timer: number | undefined;

        const tick = () => {
            const current = Date.now();
            setNow(current);

            const left = target - current;
            if (left <= 0) return;
            // 초 표시는 초 경계에 맞춰 깨어나야 숫자가 고르게 넘어간다
            timer = window.setTimeout(tick, left <= HOUR_MS ? 1000 - (current % 1000) : 30_000);
        };

        tick();
        return () => window.clearTimeout(timer);
    }, [target]);

    if (Number.isNaN(target)) return null;

    const remaining = formatRemaining(target - now);

    // 숫자 폭이 달라도 줄이 흔들리지 않게 고정폭 숫자를 쓴다.
    // 매초 바뀌는 글자라 live region 으로 두지 않는다 (스크린리더가 초마다 읽는다).
    return (
        <time dateTime={at} className="tabular-nums">
            {remaining ? `추첨까지 ${remaining}` : doneText}
        </time>
    );
}
