import type { PageLottery } from './types';

// 내 번호에서 결과를 본 가장 최근 회차. 새로 채점된 회차를 처음 열 때만 공개 연출을
// 돌리려고 기억한다. 기기마다 따로 기억하는 편의 값이라 서버에 두지 않는다 —
// 못 읽거나 못 써도 (사생활 보호 창, 저장소 차단) 연출이 한 번 더 돌거나 안 돌 뿐이다.
const KEY = 'lotto-seen-results';

type Seen = Partial<Record<PageLottery, number>>;

function readAll(): Seen {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
        return parsed && typeof parsed === 'object' ? parsed as Seen : {};
    } catch {
        return {};
    }
}

// 본 적이 없으면 null
export function getSeenDrawNo(lottery: PageLottery) {
    const value = readAll()[lottery];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function markSeenDrawNo(lottery: PageLottery, drawNo: number) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [lottery]: drawNo }));
    } catch {
        // 저장소를 못 쓰는 환경. 연출이 다음에 한 번 더 돌 뿐이다.
    }
}
