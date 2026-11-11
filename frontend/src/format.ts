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

// 오늘(KST) 부터 그 날까지 남은 날 수. 지났으면 음수.
export function daysUntil(day: string | null | undefined, now = new Date()) {
    const target = day ? dayToUtcMs(day) : null;
    // en-CA 로케일은 YYYY-MM-DD 를 낸다
    const today = dayToUtcMs(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now));
    if (target == null || today == null) return null;
    return Math.round((target - today) / 86_400_000);
}

// 추첨 전 회차 옆에 붙이는 말. 날짜가 지났는데 아직 대기 중이면 결과가 안 들어온 것이다.
export function describeDaysUntil(days: number | null) {
    if (days == null) return null;
    if (days < 0) return '결과 대기 중';
    if (days === 0) return '오늘 추첨';
    if (days === 1) return '내일 추첨';
    return `${days}일 뒤 추첨`;
}
