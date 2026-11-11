export function formatMoneyKRW(amount: number | null) {
    if (!amount) return '-';
    const eok = amount / 100000000;
    return `${eok.toFixed(eok >= 100 ? 0 : 1).replace(/\.0$/, '')}억 원`;
}

export function formatDateTime(value: Date) {
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(value);
}

// 회차 입력값. 양의 정수가 아니면 null
export function parseDrawNo(value: string) {
    const no = Number(value);
    return Number.isInteger(no) && no > 0 ? no : null;
}

// ── 추첨일 ──
// 서버는 추첨일을 KST 달력의 'YYYY-MM-DD' 로 준다. 요일과 남은 날 수는 시각이 아니라
// 달력 날짜끼리의 계산이라, 보는 사람의 시간대에 휘둘리지 않게 UTC 자정으로 옮겨 센다.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function dayToUtcMs(day: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

// '2026-11-14' → '11/14(토)'
export function formatDrawDate(day: string | null | undefined) {
    const ms = day ? dayToUtcMs(day) : null;
    if (ms == null) return null;
    const date = new Date(ms);
    return `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${WEEKDAYS[date.getUTCDay()]})`;
}

// 저장 대상을 말하는 한 구절: '1250회 · 11/14(토) 추첨'. 날짜를 모르면 회차만.
export function describeDrawTarget(draw: { drawNo: number; drawDate?: string | null }) {
    const date = formatDrawDate(draw.drawDate);
    return date ? `${draw.drawNo}회 · ${date} 추첨` : `${draw.drawNo}회`;
}

// 추첨까지 남은 시간. 멀면 굵게, 가까우면 잘게 말한다: '2일 3시간' → '3시간 12분' → '12분 34초'.
// 지났으면 null.
export function formatRemaining(ms: number) {
    if (ms <= 0) return null;

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분 ${String(seconds).padStart(2, '0')}초`;
}

// ── 금액 ──
// 원 단위까지 말한다. formatMoneyKRW 는 1등 당첨금처럼 억 단위로 뭉뚱그릴 때 쓰고,
// 이쪽은 5,000원과 20억이 한 표에 같이 놓일 때 쓴다: '5,000원' · '124만 9,000원' · '20억 2,504만 원'.
export function formatWon(amount: number) {
    const value = Math.max(0, Math.floor(amount));
    const group = (n: number) => n.toLocaleString('ko-KR');

    if (value >= 100_000_000) {
        const eok = Math.floor(value / 100_000_000);
        const man = Math.floor((value % 100_000_000) / 10_000);
        return man > 0 ? `${group(eok)}억 ${group(man)}만 원` : `${group(eok)}억 원`;
    }
    if (value >= 10_000) {
        const man = Math.floor(value / 10_000);
        const rest = value % 10_000;
        return rest > 0 ? `${group(man)}만 ${group(rest)}원` : `${group(man)}만 원`;
    }
    return `${group(value)}원`;
}
