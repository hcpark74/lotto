export function formatMoneyKRW(amount: number) {
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
