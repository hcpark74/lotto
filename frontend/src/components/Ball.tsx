// 동행복권 공식 구간색 1–10 / 11–20 / 21–30 / 31–40 / 41–45.
// Tailwind v4 는 소스에서 참조된 @theme 변수만 CSS 로 내보내므로 템플릿 문자열 대신 리터럴로 나열한다.
// 글자색은 구간마다 대비가 높은 쪽을 쓴다 — 공식 사이트의 흰 글자는 주황(2.6:1)·초록(3.5:1)에서 AA 미달.
const BALL_BANDS = [
    { bg: 'var(--color-ball-1)', fg: 'var(--color-ink)' },
    { bg: 'var(--color-ball-2)', fg: 'var(--color-card)' },
    { bg: 'var(--color-ball-3)', fg: 'var(--color-card)' },
    { bg: 'var(--color-ball-4)', fg: 'var(--color-card)' },
    { bg: 'var(--color-ball-5)', fg: 'var(--color-ink)' },
];
function getBallBand(num: number) {
    return BALL_BANDS[Math.min(Math.ceil(num / 10), 5) - 1];
}

export function Ball({ num, size = 'md', delay = 0 }: { num: number; size?: 'sm' | 'md' | 'responsive'; delay?: number }) {
    const band = getBallBand(num);
    const dimensions = size === 'sm'
        ? { width: 36, height: 36, fontSize: 13 }
        : size === 'responsive'
            ? { width: 'clamp(34px, 8.4vw, 52px)', height: 'clamp(34px, 8.4vw, 52px)', fontSize: 'clamp(12px, 3.7vw, 17px)' }
            : { width: 52, height: 52, fontSize: 17 };

    return (
        <div
            className="ball-pop"
            style={{
                animationDelay: `${delay}ms`,
                width: dimensions.width,
                height: dimensions.height,
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: dimensions.fontSize,
                color: band.fg,
                flexShrink: 0,
                border: '2px solid var(--color-ink)',
                background: band.bg,
                boxShadow: size === 'sm' ? 'var(--shadow-brutal-sm)' : '3px 3px 0 0 var(--color-ink)',
            }}
        >
            {num}
        </div>
    );
}

export function BonusBadge({ compact = false }: { compact?: boolean }) {
    return (
        <span
            className="absolute -right-2 -top-2 flex items-center justify-center rounded-[4px] border-2 border-card bg-ink font-mono font-bold text-card"
            style={{
                width: compact ? 16 : 18,
                height: compact ? 16 : 18,
                fontSize: compact ? 9 : 10,
                letterSpacing: '-0.02em',
            }}
        >
            B
        </span>
    );
}
