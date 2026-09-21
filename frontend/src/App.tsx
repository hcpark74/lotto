import React, { useEffect, useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Info,
    Search,
    Sparkles,
    Waves,
} from 'lucide-react';

type DrawResult = {
    drwNo: number;
    drwNoDate: string;
    drwtNo1: number; drwtNo2: number; drwtNo3: number;
    drwtNo4: number; drwtNo5: number; drwtNo6: number;
    bnusNo: number;
    firstWinamnt: number;
};

type PensionDrawResult = {
    draw_no: number;
    draw_date: string;
    winning_band: string;
    winning_number: string;
    bonus_number: string;
    synced_at: string;
    prize_counts?: {
        rank_no: number;
        internet_count: number;
        store_count: number;
        total_count: number;
        win_amount: number | null;
        total_amount: number | null;
    }[];
};

type PensionRecommendationSet = {
    label: string;
    number: string;
    meta: {
        ruleId?: string;
        ruleWeight?: number;
        sum: number;
        oddCount: number;
        uniqueDigitCount: number;
        maxDuplicateCount: number;
        hasThreeConsecutive: boolean;
    };
};
type PensionRuleWeight = {
    ruleId: string;
    label: string;
    weight: number;
    score: number;
    passRate: number;
    recentMatchRate: number;
};
type PensionRulePerformance = {
    ruleId: string;
    label: string;
    generatedCount: number;
    averageExactMatches: number;
    exactMatch3PlusRate: number;
    exactMatch4PlusRate: number;
};
type PensionBacktestDiagnostics = {
    algorithm: string;
    evaluatedDraws: number;
    setsPerDraw: number;
    totalGeneratedSets: number;
    averageExactMatchPerSet: number;
    averageBestExactMatchPerDraw: number;
    ruleDiagnostics: {
        currentWeights: PensionRuleWeight[];
        performance: PensionRulePerformance[];
    };
};

type LottoSet = {
    numbers: number[];
    label: string;
    meta?: {
        ruleId?: string;
        ruleWeight?: number;
    };
};
type LottoRuleWeight = {
    ruleId: string;
    label: string;
    weight: number;
    score: number;
    passRate: number;
    recentMatchRate: number;
};
type LottoRulePerformance = {
    ruleId: string;
    label: string;
    generatedCount: number;
    averageMatches: number;
    zScore: number;
    ci95: [number, number];
    commonRulePassRate: number;
    relaxedFallbackRate: number;
    randomFallbackRate: number;
};
type LottoBacktestBaseline = {
    theoretical: {
        expectedMatchPerSet: number;
        matchStdPerSet: number;
    };
    randomControl: {
        totalSets: number;
        averageMatchPerSet: number;
        zScore: number;
        ci95: [number, number];
    };
    overall: {
        zScore: number;
        ci95: [number, number];
        significant: boolean;
    };
};
type LottoBacktestDiagnostics = {
    algorithm: string;
    evaluatedDraws: number;
    averageMatchPerSet: number;
    averageBestMatchPerDraw: number;
    baseline: LottoBacktestBaseline;
    generationQuality: {
        commonRulePassRate: number;
        relaxedFallbackRate: number;
        randomFallbackRate: number;
    };
    ruleDiagnostics: {
        currentWeights: LottoRuleWeight[];
        performance: LottoRulePerformance[];
    };
};
type SyncResponse = {
    success: boolean;
    syncedCount: number;
    nextDrwNo: number;
    latestDraw: number;
};

type PageKey = 'lotto' | 'pension';
type TabKey = 'results' | 'picks' | 'backtest';
type Route = { page: PageKey; tab: TabKey };

const TABS: { key: TabKey; label: string }[] = [
    { key: 'results', label: '결과' },
    { key: 'picks', label: '추천' },
    { key: 'backtest', label: '진단' },
];

// /lotto, /lotto/results, /pension/picks … — 알 수 없는 경로는 /lotto/results 로 취급
function getRouteFromPath(pathname: string): Route {
    const [pageSeg, tabSeg] = pathname.split('/').filter(Boolean);
    const page: PageKey = pageSeg === 'pension' ? 'pension' : 'lotto';
    const tab = TABS.find(t => t.key === tabSeg)?.key ?? 'results';
    return { page, tab };
}

function getPathFromRoute({ page, tab }: Route) {
    return `/${page}/${tab}`;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const PAGE_SIZE = 5;
const FALLBACK_LABELS = ['홀짝 균형형', '연속 독립형', '합계 안정형', '구간 분포형', '끝수 균형형'];
// 연금복권 자릿수 채움색 (십만→일 자리), 조 번호는 흰색
const PENSION_DIGIT_COLORS = ['var(--color-coral)', 'var(--color-lemon)', 'var(--color-mint)', 'var(--color-sky)', 'var(--color-grape)', 'var(--color-ball-4)'];
const PENSION_DIGIT_COLORS_WITH_BAND = ['var(--color-card)', ...PENSION_DIGIT_COLORS];
const LAST_SYNC_STORAGE_KEY = 'lotto-last-synced-at';
const LAST_SYNC_DRAW_STORAGE_KEY = 'lotto-last-synced-draw';
const LOTTO_RULE_LABELS: Record<string, string> = {
    'odd-balance': '홀짝 균형형',
    'no-consecutive-pair': '연속 독립형',
    'stable-sum': '합계 안정형',
    'zone-distribution': '구간 분포형',
    'tail-balance': '끝수 균형형',
};
const PENSION_RULE_LABELS: Record<string, string> = {
    'balanced-core': '균형형 추천',
    'odd-focus': '홀수 집중형 추천',
    'unique-focus': '고유수 확장형 추천',
    'low-sum-stable': '저합계 안정형 추천',
};

// 동행복권 구간색 1–10 / 11–20 / 21–30 / 31–40 / 41–45.
// Tailwind v4 는 소스에서 참조된 @theme 변수만 CSS 로 내보내므로 템플릿 문자열 대신 리터럴로 나열한다.
const BALL_COLORS = ['var(--color-ball-1)', 'var(--color-ball-2)', 'var(--color-ball-3)', 'var(--color-ball-4)', 'var(--color-ball-5)'];
function getBallColor(num: number) {
    return BALL_COLORS[Math.min(Math.ceil(num / 10), 5) - 1];
}

function formatMoneyKRW(amount: number) {
    if (!amount) return '-';
    const eok = amount / 100000000;
    return `${eok.toFixed(eok >= 100 ? 0 : 1).replace(/\.0$/, '')}억 원`;
}

function formatDateTime(value: Date) {
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(value);
}

function Ball({ num, size = 'md', delay = 0 }: { num: number; size?: 'sm' | 'md' | 'responsive'; delay?: number }) {
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
                color: 'var(--color-ink)',
                flexShrink: 0,
                border: '2px solid var(--color-ink)',
                background: getBallColor(num),
                boxShadow: size === 'sm' ? 'var(--shadow-brutal-sm)' : '3px 3px 0 0 var(--color-ink)',
            }}
        >
            {num}
        </div>
    );
}

function BonusBadge({ compact = false }: { compact?: boolean }) {
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

function SectionCard({
    title,
    icon,
    eyebrow,
    action,
    children,
    accent = 'default',
    headerClassName = '',
    bodyClassName = '',
}: {
    title: string;
    icon?: React.ReactNode;
    eyebrow?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    accent?: 'default' | 'soft';
    headerClassName?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={`panel ${accent === 'soft' ? 'panel-soft' : ''}`}>
            <div className={`panel-head flex items-start justify-between gap-3 px-5 py-4 sm:px-6 ${headerClassName}`.trim()}>
                <div>
                    {eyebrow && <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">{eyebrow}</p>}
                    <h2 className="mt-1 text-lg font-extrabold text-ink">{title}</h2>
                </div>
                <div className="flex items-center gap-3">
                    {action}
                    {icon && <div className="panel-icon">{icon}</div>}
                </div>
            </div>
            <div className={`px-5 py-5 sm:px-6 ${bodyClassName}`.trim()}>{children}</div>
        </section>
    );
}

function DrawRow({ draw, highlight = false }: { draw: DrawResult; highlight?: boolean }) {
    const nums = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];

    return (
        <div className={`border-2 px-4 py-4 transition-colors sm:px-5 ${highlight ? 'border-ink bg-paper' : 'border-ink bg-card'}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-ink">제 {draw.drwNo}회</div>
                    <div className="mt-1 text-xs text-ink-soft">추첨일 {draw.drwNoDate}</div>
                </div>
                <div className="chip chip-coral">
                    1등 {formatMoneyKRW(draw.firstWinamnt)}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {nums.map((n, i) => <Ball key={i} num={n} size="sm" delay={i * 20} />)}
                <span className="mx-1 text-sm font-semibold text-ink-soft">+</span>
                <div className="relative">
                    <Ball num={draw.bnusNo} size="sm" />
                    <BonusBadge compact />
                </div>
            </div>
        </div>
    );
}

function DrawResultCard({
    draw,
    chipLabel,
    variant = 'default',
    onPrimaryAction,
    onSecondaryAction,
    primaryActionLabel,
    secondaryActionLabel,
    primaryDisabled = false,
    statusText,
}: {
    draw: DrawResult;
    chipLabel: string;
    variant?: 'default' | 'latest';
    onPrimaryAction?: () => void;
    onSecondaryAction?: () => void;
    primaryActionLabel?: string;
    secondaryActionLabel?: string;
    primaryDisabled?: boolean;
    statusText?: string;
}) {
    const numbers = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];
    const oddCount = numbers.filter(num => num % 2 === 1).length;
    const sum = numbers.reduce((total, num) => total + num, 0);

    if (variant === 'latest') {
        return (
            <div className="latest-feature-card px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
                {statusText && (
                    <div className="latest-feature-status mb-5 px-4 py-3 text-center sm:mb-7">
                        <p className="text-xs font-medium tracking-[-0.01em] text-ink-soft sm:text-sm">{statusText}</p>
                    </div>
                )}

                <div className="text-center">
                    <img
                        src="/images/img-mainLt645.svg"
                        alt="Lotto 6/45"
                        className="lotto-mark-image mx-auto"
                    />
                </div>

                <div className="latest-feature-heading mt-8 sm:mt-10">
                    <div className="result-arrow-shell result-arrow-left">
                        <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                        <div className="text-[42px] font-extrabold tracking-[-0.05em] text-ink sm:text-[56px]">{draw.drwNo}회</div>
                        <div className="mt-1 text-[18px] font-medium text-ink-soft sm:text-[20px]">{draw.drwNoDate}</div>
                    </div>
                    <div className="result-arrow-shell result-arrow-right text-ink-soft">
                        <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                    </div>
                </div>

                <div className="result-divider mt-8 sm:mt-10" />

                <div className="mt-9 flex flex-wrap items-center justify-center gap-2 sm:gap-4 lg:gap-5">
                    {numbers.map((num, i) => (
                        <Ball key={i} num={num} size="responsive" delay={i * 20} />
                    ))}
                    <div className="flex items-center gap-2 sm:gap-4 lg:gap-5">
                        <span className="font-mono text-3xl font-bold text-ink sm:text-4xl">+</span>
                        <div className="relative">
                            <Ball num={draw.bnusNo} size="responsive" />
                            <BonusBadge />
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-[16px] font-medium text-ink-soft sm:text-[18px]">1등 당첨금</p>
                    <p className="mt-3 text-[36px] font-extrabold tracking-[-0.05em] text-ink sm:text-[54px]">
                        {formatMoneyKRW(draw.firstWinamnt)}
                    </p>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4">
                    <button
                        type="button"
                        onClick={onSecondaryAction}
                        className="latest-feature-secondary inline-flex min-h-14 items-center justify-center px-3 text-[15px] font-semibold tracking-[-0.02em] transition sm:px-5 sm:text-lg"
                    >
                        {secondaryActionLabel ?? '회차 상세 보기'}
                    </button>
                    <button
                        type="button"
                        onClick={onPrimaryAction}
                        disabled={primaryDisabled}
                        className="latest-feature-primary inline-flex min-h-14 items-center justify-center px-3 text-[15px] font-semibold tracking-[-0.02em] transition sm:px-5 sm:text-lg"
                    >
                        {primaryActionLabel ?? '최신 결과 동기화'}
                    </button>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft sm:mt-8 sm:text-base">
                    <span>보너스 {draw.bnusNo}</span>
                    <span className="text-ink-soft">/</span>
                    <span>번호 합계 {sum}</span>
                    <span className="text-ink-soft">/</span>
                    <span>홀수 {oddCount}개</span>
                </div>
            </div>
        );
    }

    return (
        <div className="latest-draw-card px-5 py-6 sm:px-8 sm:py-9 lg:px-12 lg:py-10">
            <div className="relative text-center">
                <div className="pointer-events-none absolute left-0 top-1/2 hidden -translate-y-1/2 lg:flex">
                    <div className="result-arrow-shell">
                        <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 lg:flex">
                    <div className="result-arrow-shell">
                        <ChevronRight className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="chip chip-mint">
                    {chipLabel}
                </div>
                <h3 className="mt-4 text-[28px] font-extrabold tracking-[-0.04em] text-ink sm:text-[42px]">
                    제 <span className="bg-lemon px-2">{draw.drwNo}</span>회 추첨 결과
                </h3>
                <p className="mt-3 text-base font-medium text-ink-soft sm:text-[18px]">{draw.drwNoDate} 추첨</p>
                <div className="chip chip-coral mt-5 text-sm">
                    1등 당첨금 {formatMoneyKRW(draw.firstWinamnt)}
                </div>
            </div>

            <div className="result-divider mt-8" />

            <div className="mt-8 flex flex-col items-center gap-5 lg:flex-row lg:items-end lg:justify-center lg:gap-10">
                <div className="result-number-group">
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                        {numbers.map((num, i) => (
                            <Ball key={i} num={num} size="md" delay={i * 20} />
                        ))}
                    </div>
                    <div className="result-label-row mt-5">
                        <span className="result-label-line" />
                        <span className="result-label-text">당첨번호</span>
                        <span className="result-label-line" />
                    </div>
                </div>

                <div className="flex items-center justify-center gap-4 lg:gap-8">
                    <span className="font-mono text-3xl font-bold text-ink sm:text-4xl">+</span>
                    <div className="result-number-group">
                        <div className="flex justify-center">
                            <div className="relative">
                                <Ball num={draw.bnusNo} size="md" />
                                <BonusBadge />
                            </div>
                        </div>
                        <div className="result-label-row mt-5">
                            <span className="result-label-line short" />
                            <span className="result-label-text">보너스번호</span>
                            <span className="result-label-line short" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 grid gap-2 sm:grid-cols-3">
                <div className="latest-draw-stat px-3 py-3">
                    <div className="text-[11px] font-medium text-ink-soft">보너스 번호</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{draw.bnusNo}</div>
                </div>
                <div className="latest-draw-stat px-3 py-3">
                    <div className="text-[11px] font-medium text-ink-soft">번호 합계</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{sum}</div>
                </div>
                <div className="latest-draw-stat px-3 py-3">
                    <div className="text-[11px] font-medium text-ink-soft">홀수 개수</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{oddCount}</div>
                </div>
            </div>
        </div>
    );
}

function RecommendationCard({
    set,
    index,
}: {
    set: LottoSet;
    index: number;
}) {
    const sum = set.numbers.reduce((total, num) => total + num, 0);
    const oddCount = set.numbers.filter(num => num % 2 === 1).length;
    const spread = Math.max(...set.numbers) - Math.min(...set.numbers);
    const ruleName = set.meta?.ruleId ? (LOTTO_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className={`recommend-card px-4 py-5 sm:px-6 sm:py-7 ${index === 0 ? 'is-featured' : ''}`}>
            <div className="text-center">
                <div className={`chip ${index === 0 ? 'chip-lemon' : ''}`}>
                    {index === 0 ? '가장 추천 · Set 1' : `추천 Set ${index + 1}`}
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-[-0.03em] text-ink sm:text-[28px]">
                    {set.label}
                </h3>
                {(set.meta?.ruleWeight || ruleName) && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-soft sm:text-sm">
                        {set.meta?.ruleWeight ? (
                            <span className="chip">
                                weight {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="chip chip-mint">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            <div className="result-divider mt-7" />

            <div className="mt-7">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                    {set.numbers.map((num, i) => (
                        <Ball key={i} num={num} size="responsive" delay={index * 70 + i * 30} />
                    ))}
                </div>
                <div className="result-label-row mt-5">
                    <span className="result-label-line" />
                    <span className="result-label-text">추천번호</span>
                    <span className="result-label-line" />
                </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft sm:mt-8 sm:text-base">
                <span>번호 합계 {sum}</span>
                <span className="text-ink-soft">/</span>
                <span>홀수 {oddCount}개</span>
                <span className="text-ink-soft">/</span>
                <span>최대 간격 {spread}</span>
            </div>
        </div>
    );
}

function RuleWeightCard({ item, index }: { item: LottoRuleWeight; index: number }) {
    return (
        <div className="border-2 border-ink bg-card px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">우선순위 {index + 1}</div>
                    <div className="mt-2 text-base font-semibold text-ink">{item.label}</div>
                </div>
                <div className="chip chip-mint">
                    가중치 {item.weight.toFixed(3)}
                </div>
            </div>

            <div className="mt-4 space-y-2">
                <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
                        <span>규칙 점수</span>
                        <span>{(item.score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="meter">
                        <div className="meter-fill" style={{ width: `${Math.max(item.score * 100, 6)}%` }} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-ink-soft sm:text-sm">
                    <div className="stat-tile">
                        <div>공통+세트 통과</div>
                        <div className="mt-1 font-semibold text-ink">{(item.passRate * 100).toFixed(1)}%</div>
                    </div>
                    <div className="stat-tile">
                        <div>세트 규칙 일치</div>
                        <div className="mt-1 font-semibold text-ink">{(item.recentMatchRate * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// |z| >= 1.96 이면 5% 유의수준에서 랜덤(0.8)과 다르다. 그 외는 노이즈 범위.
function ZScoreBadge({ zScore }: { zScore: number }) {
    const significant = Math.abs(zScore) >= 1.96;
    const tone = !significant ? '' : zScore > 0 ? 'chip-mint' : 'chip-coral';
    const mark = !significant ? '＝' : zScore > 0 ? '▲' : '▼';
    return (
        <span className={`chip ${tone}`}>
            {mark} z {zScore > 0 ? '+' : ''}{zScore.toFixed(2)} · {significant ? '유의' : '랜덤 범위'}
        </span>
    );
}

function RulePerformanceCard({ item }: { item: LottoRulePerformance }) {
    return (
        <div className="border-2 border-ink bg-card px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-semibold text-ink">{item.label}</div>
                    <div className="mt-1 text-xs text-ink-soft">생성 {item.generatedCount}회</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="chip chip-sky">
                        평균 일치 {item.averageMatches.toFixed(3)}
                    </div>
                    <ZScoreBadge zScore={item.zScore} />
                    <div className="text-[11px] text-ink-soft">95% CI {item.ci95[0].toFixed(3)} ~ {item.ci95[1].toFixed(3)}</div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-ink-soft sm:text-sm">
                <div className="stat-tile">
                    <div>공통 규칙</div>
                    <div className="mt-1 font-semibold text-ink">{item.commonRulePassRate.toFixed(1)}%</div>
                </div>
                <div className="stat-tile">
                    <div>완화 폴백</div>
                    <div className="mt-1 font-semibold text-ink">{item.relaxedFallbackRate.toFixed(1)}%</div>
                </div>
                <div className="stat-tile">
                    <div>랜덤 폴백</div>
                    <div className="mt-1 font-semibold text-ink">{item.randomFallbackRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}

function PensionRulePerformanceCard({ item }: { item: PensionRulePerformance }) {
    return (
        <div className="border-2 border-ink bg-card px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-semibold text-ink">{PENSION_RULE_LABELS[item.ruleId] ?? item.label}</div>
                    <div className="mt-1 text-xs text-ink-soft">생성 {item.generatedCount}회</div>
                </div>
                <div className="chip chip-sky">
                    평균 정확 일치 {item.averageExactMatches.toFixed(3)}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-ink-soft sm:text-sm">
                <div className="stat-tile">
                    <div>3자리 이상 일치</div>
                    <div className="mt-1 font-semibold text-ink">{item.exactMatch3PlusRate.toFixed(1)}%</div>
                </div>
                <div className="stat-tile">
                    <div>4자리 이상 일치</div>
                    <div className="mt-1 font-semibold text-ink">{item.exactMatch4PlusRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}

function PensionDigitBall({ value, color }: { value: string; color: string }) {
    return (
        <div
            className="flex h-[clamp(50px,8.6vw,72px)] w-[clamp(44px,7.6vw,64px)] items-center justify-center rounded-[4px] border-2 border-ink font-mono text-[clamp(22px,3.6vw,34px)] font-bold text-ink shadow-brutal-sm"
            style={{ background: color }}
        >
            {value}
        </div>
    );
}

function PensionNumberRow({
    label,
    subtitle,
    number,
    band,
    showBand = true,
    prefixLabel,
}: {
    label: string;
    subtitle: string;
    number: string;
    band?: string;
    showBand?: boolean;
    prefixLabel?: string;
}) {
    const colors = PENSION_DIGIT_COLORS_WITH_BAND;
    const digits = number.padStart(6, '0').slice(-6).split('');

    return (
        <div className="grid gap-5 border-t-2 border-ink py-6 lg:grid-cols-[1.05fr_1.55fr] lg:items-center lg:gap-12">
            <div className="text-center lg:text-left">
                <div className="text-[24px] font-semibold tracking-[-0.04em] text-ink sm:text-[34px] lg:text-[38px]">
                    {label} <span className="mx-1.5 text-ink-soft">|</span> {subtitle}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                {showBand && band ? (
                    <div className="text-center">
                        <PensionDigitBall value={band} color={colors[0]} />
                        <div className="mt-2 text-sm font-medium text-ink-soft">조</div>
                    </div>
                ) : prefixLabel ? (
                    <div className="px-1 text-base font-medium text-ink-soft sm:text-lg">{prefixLabel}</div>
                ) : null}
                {digits.map((digit, index) => (
                    <PensionDigitBall
                        key={`${label}-${index}`}
                        value={digit}
                        color={colors[Math.min(index + (showBand ? 1 : 0), colors.length - 1)]}
                    />
                ))}
            </div>
        </div>
    );
}

function PensionResultCard({ draw }: { draw: PensionDrawResult }) {
    return (
        <div className="latest-feature-card px-5 py-7 sm:px-8 sm:py-9 lg:px-12 lg:py-12">
            <div className="latest-feature-heading">
                <div className="result-arrow-shell result-arrow-left">
                    <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                    <h2 className="text-[30px] font-extrabold tracking-[-0.05em] text-ink sm:text-[48px] lg:text-[56px]">
                    제 <span className="bg-lemon px-2">{draw.draw_no}</span>회 추첨 결과
                    </h2>
                    <p className="mt-3 text-base font-medium text-ink-soft sm:text-[18px]">{draw.draw_date} 추첨</p>
                </div>
                <div className="result-arrow-shell result-arrow-right text-ink-soft">
                    <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                </div>
            </div>

            <div className="result-divider mt-8 sm:mt-10" />

            <div className="mt-8">
                <PensionNumberRow label="1등" subtitle="월 700만원 x 20년" band={draw.winning_band} number={draw.winning_number} />
                <PensionNumberRow label="보너스" subtitle="월 100만원 x 10년" number={draw.bonus_number} showBand={false} prefixLabel="각조" />
            </div>

            <div className="mt-8 text-center text-xs text-ink-soft sm:text-sm">
                최근 동기화 {formatDateTime(new Date(draw.synced_at))}
            </div>
        </div>
    );
}

function PensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
    const ruleName = set.meta.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className="recommend-card px-4 py-5 sm:px-6 sm:py-7">
            <div className="text-center">
                <div className="chip chip-mint">
                    {set.label}
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-[-0.03em] text-ink sm:text-[28px]">
                    연금복권 추천번호
                </h3>
                {(set.meta.ruleWeight || ruleName) && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-soft sm:text-sm">
                        {set.meta.ruleWeight ? (
                            <span className="chip">
                                가중치 {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="chip chip-mint">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            <div className="result-divider mt-7" />

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                <div className="px-1 text-base font-medium text-ink-soft sm:text-lg">각조</div>
                {set.number.split('').map((digit, index) => {
                    const colors = PENSION_DIGIT_COLORS;
                    return <PensionDigitBall key={`${set.label}-${index}`} value={digit} color={colors[index]} />;
                })}
            </div>

            <div className="result-label-row mt-5">
                <span className="result-label-line" />
                <span className="result-label-text">추천번호</span>
                <span className="result-label-line" />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft sm:text-base">
                <span>합계 {set.meta.sum}</span>
                <span className="text-ink-soft">/</span>
                <span>홀수 {set.meta.oddCount}개</span>
                <span className="text-ink-soft">/</span>
                <span>고유숫자 {set.meta.uniqueDigitCount}개</span>
                <span className="text-ink-soft">/</span>
                <span>최대 중복 {set.meta.maxDuplicateCount}개</span>
            </div>
        </div>
    );
}

function FeaturedPensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
    const ruleName = set.meta.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className="recommend-card is-featured px-5 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="chip chip-mint">
                        대표 추천 1세트
                    </div>
                    <h3 className="mt-4 text-2xl font-extrabold tracking-[-0.04em] text-ink sm:text-[32px]">
                        {set.label}
                    </h3>
                    <p className="mt-2 text-sm text-ink-soft sm:text-base">
                        현재 추천 성향 우선순위에서 가장 먼저 선택된 대표 조합입니다.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft sm:text-sm">
                        {set.meta.ruleWeight ? (
                            <span className="chip">
                                가중치 {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="chip chip-mint">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="border-2 border-ink bg-card px-4 py-4 shadow-brutal-sm sm:px-5">
                    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                        <div className="px-1 text-base font-medium text-ink-soft sm:text-lg">각조</div>
                        {set.number.split('').map((digit, index) => {
                            const colors = PENSION_DIGIT_COLORS;
                            return <PensionDigitBall key={`featured-${set.label}-${index}`} value={digit} color={colors[index]} />;
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div className="stat-tile">
                    <div className="text-xs text-ink-soft">합계</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{set.meta.sum}</div>
                </div>
                <div className="stat-tile">
                    <div className="text-xs text-ink-soft">홀수 개수</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{set.meta.oddCount}개</div>
                </div>
                <div className="stat-tile">
                    <div className="text-xs text-ink-soft">고유 숫자</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{set.meta.uniqueDigitCount}개</div>
                </div>
                <div className="stat-tile">
                    <div className="text-xs text-ink-soft">최대 중복</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{set.meta.maxDuplicateCount}개</div>
                </div>
            </div>
        </div>
    );
}

function PensionPage({
    latestPensionDraw,
    pensionLoading,
    pensionError,
    pensionSyncLoading,
    pensionGenerateLoading,
    pensionSearchInput,
    pensionRecommendations,
    pensionRuleWeights,
    pensionBacktestDiagnostics,
    pensionBacktestLoading,
    pensionSearchResult,
    pensionSearchError,
    onPensionSync,
    onPensionGenerate,
    onPensionBacktestRefresh,
    onPensionSearchInputChange,
    onPensionSearch,
    tab,
}: {
    latestPensionDraw: PensionDrawResult | null;
    pensionLoading: boolean;
    pensionError: string;
    pensionSyncLoading: boolean;
    pensionGenerateLoading: boolean;
    pensionSearchInput: string;
    pensionRecommendations: PensionRecommendationSet[];
    pensionRuleWeights: PensionRuleWeight[];
    pensionBacktestDiagnostics: PensionBacktestDiagnostics | null;
    pensionBacktestLoading: boolean;
    pensionSearchResult: PensionDrawResult | null;
    pensionSearchError: string;
    onPensionSync: () => void;
    onPensionGenerate: () => void;
    onPensionBacktestRefresh: () => void;
    onPensionSearchInputChange: (value: string) => void;
    onPensionSearch: () => void;
    tab: TabKey;
}) {
    const featuredRecommendation = pensionRecommendations[0] ?? null;

    return (
        <div className="space-y-6 lg:space-y-8">
            {tab === 'results' && (
            <>
            <section>
                <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
                    <div>
                        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">연금복권720+</p>
                        <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-ink sm:text-3xl">회차별 당첨번호</h2>
                    </div>
                    <div className="chip chip-sky text-sm">
                        <span>{latestPensionDraw ? `${latestPensionDraw.draw_no}회` : '회차 선택'}</span>
                        <ChevronRight className="h-4 w-4 rotate-90 text-ink-soft" />
                    </div>
                </div>

                <div className="mb-3 flex justify-end">
                    <button
                        onClick={onPensionSync}
                        disabled={pensionSyncLoading}
                        className="btn-primary inline-flex h-10 items-center justify-center px-4 text-sm font-semibold transition"
                    >
                        {pensionSyncLoading ? '동기화 중...' : '최신 결과 동기화'}
                    </button>
                </div>
                {pensionLoading ? (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">연금복권 데이터를 불러오는 중입니다...</div>
                ) : pensionError ? (
                    <div className="panel bg-coral px-4 py-8 text-sm">{pensionError}</div>
                ) : latestPensionDraw ? (
                    <PensionResultCard draw={latestPensionDraw} />
                ) : (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">연금복권 데이터가 아직 없습니다. 먼저 `/api/pension/sync`를 실행해 주세요.</div>
                )}
            </section>

            <section className="mt-5 lg:mt-6">
                <SectionCard title="지난 회차 검색" eyebrow="연금복권 조회" icon={<Search className="h-5 w-5" />}> 
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            type="number"
                            min={1}
                            value={pensionSearchInput}
                            onChange={e => onPensionSearchInputChange(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && onPensionSearch()}
                            placeholder="예: 306"
                            className="input-brutal h-12 flex-1 px-4 text-sm"
                        />
                        <button
                            onClick={onPensionSearch}
                            className="btn-primary inline-flex h-12 items-center justify-center px-5 text-sm font-semibold transition sm:min-w-[120px]"
                        >
                            회차 조회
                        </button>
                    </div>

                    <div className="mt-4 border-2 border-ink bg-paper p-4">
                        {pensionSearchError ? (
                            <p className="text-sm font-medium text-ink">{pensionSearchError}</p>
                        ) : pensionSearchResult ? (
                            <PensionResultCard draw={pensionSearchResult} />
                        ) : (
                            <p className="text-sm text-ink-soft">조회할 연금복권 회차를 입력하면 지난 회차 추첨 결과를 확인할 수 있습니다.</p>
                        )}
                    </div>
                </SectionCard>
            </section>
            </>
            )}

            {tab === 'picks' && (
            <section>
                <SectionCard
                    title="추천번호 생성"
                    eyebrow="연금복권 추천"
                    icon={<Sparkles className="h-5 w-5" />}
                    action={
                        <button
                            onClick={onPensionGenerate}
                            disabled={pensionGenerateLoading}
                            className="btn-primary inline-flex h-10 items-center justify-center px-4 text-sm font-semibold transition"
                        >
                            {pensionGenerateLoading ? '생성 중...' : '추천번호 생성'}
                        </button>
                    }
                >
                    <p className="mb-4 text-sm text-ink-soft">
                        숫자 6개를 독립 추출한 뒤 공통 규칙을 통과시키고, 추천 성향별 규칙 세트로 여러 조합을 나눠 제안합니다.
                    </p>

                    {pensionRuleWeights.length > 0 && (
                        <div className="mb-4 border-2 border-ink bg-paper p-4 sm:p-5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">추천 성향 분석</p>
                                    <h3 className="mt-1 text-lg font-extrabold text-ink">최근 24회 기준 추천 성향 우선순위</h3>
                                </div>
                                <p className="text-xs text-ink-soft sm:text-sm">점수가 높은 추천 성향을 먼저 적용합니다.</p>
                            </div>

                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                {pensionRuleWeights.map((item, index) => (
                                    <RuleWeightCard key={`pension-${item.ruleId}`} item={{ ...item, label: PENSION_RULE_LABELS[item.ruleId] ?? item.label }} index={index} />
                                ))}
                            </div>
                        </div>
                    )}

                    {featuredRecommendation && (
                        <div className="mb-4">
                            <FeaturedPensionRecommendationCard set={featuredRecommendation} />
                        </div>
                    )}

                    {pensionRecommendations.length > 0 ? (
                        <div className="grid gap-3 lg:grid-cols-2">
                            {pensionRecommendations.map((set) => (
                                <PensionRecommendationCard key={`${set.label}-${set.number}`} set={set} />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state px-4 py-8 text-center text-sm text-ink-soft">
                            버튼을 눌러 연금복권 추천번호 세트를 생성해 보세요.
                        </div>
                    )}
                </SectionCard>
            </section>
            )}

            {tab === 'backtest' && (
            <section>
                <SectionCard
                    title="백테스트 성향 진단"
                    eyebrow="알고리즘 진단"
                    icon={<Info className="h-5 w-5" />}
                    action={
                        <button
                            onClick={onPensionBacktestRefresh}
                            disabled={pensionBacktestLoading}
                            className="btn-secondary inline-flex h-10 items-center justify-center px-4 text-sm"
                        >
                            {pensionBacktestLoading ? '분석 중...' : '진단 새로고침'}
                        </button>
                    }
                >
                    {pensionBacktestDiagnostics ? (
                        <>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="stat-tile">
                                    <div className="text-xs text-ink-soft">평가 회차</div>
                                    <div className="mt-1 text-xl font-semibold text-ink">{pensionBacktestDiagnostics.evaluatedDraws}</div>
                                </div>
                                <div className="stat-tile">
                                    <div className="text-xs text-ink-soft">세트 수</div>
                                    <div className="mt-1 text-xl font-semibold text-ink">{pensionBacktestDiagnostics.totalGeneratedSets}</div>
                                </div>
                                <div className="stat-tile">
                                    <div className="text-xs text-ink-soft">세트 평균 정확 일치</div>
                                    <div className="mt-1 text-xl font-semibold text-ink">{pensionBacktestDiagnostics.averageExactMatchPerSet.toFixed(3)}</div>
                                </div>
                                <div className="stat-tile">
                                    <div className="text-xs text-ink-soft">회차 최고 평균 정확 일치</div>
                                    <div className="mt-1 text-xl font-semibold text-ink">{pensionBacktestDiagnostics.averageBestExactMatchPerDraw.toFixed(3)}</div>
                                </div>
                            </div>

                            <div className="mt-5 border-2 border-ink bg-paper p-4 sm:p-5">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">백테스트 성향 가중치</p>
                                        <h3 className="mt-1 text-lg font-extrabold text-ink">현재 추천 성향 우선순위</h3>
                                    </div>
                                    <p className="text-xs text-ink-soft sm:text-sm">최근 데이터로 계산한 현재 우선순위입니다.</p>
                                </div>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {pensionBacktestDiagnostics.ruleDiagnostics.currentWeights.map((item, index) => (
                                        <RuleWeightCard key={`pension-backtest-${item.ruleId}`} item={{ ...item, label: PENSION_RULE_LABELS[item.ruleId] ?? item.label }} index={index} />
                                    ))}
                                </div>
                            </div>

                            <div className="mt-5 border-2 border-ink bg-card p-4 sm:p-5">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">성향 성과 분석</p>
                                        <h3 className="mt-1 text-lg font-extrabold text-ink">추천 성향별 백테스트 성과</h3>
                                    </div>
                                    <p className="text-xs text-ink-soft sm:text-sm">추천 성향별 정확 일치 성과를 비교합니다.</p>
                                </div>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {pensionBacktestDiagnostics.ruleDiagnostics.performance.map((item) => (
                                        <PensionRulePerformanceCard key={`pension-perf-${item.ruleId}`} item={item} />
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state px-4 py-10 text-center text-sm text-ink-soft">
                            {pensionBacktestLoading ? '연금복권 백테스트 진단을 계산하고 있습니다.' : '연금복권 백테스트 진단 데이터를 불러오지 못했습니다.'}
                        </div>
                    )}
                </SectionCard>
            </section>
            )}
        </div>
    );
}

function App() {
    const [route, setRoute] = useState<Route>(() => getRouteFromPath(window.location.pathname));
    const activePage = route.page;
    const activeTab = route.tab;
    const [sets, setSets] = useState<LottoSet[]>([]);
    const [ruleWeights, setRuleWeights] = useState<LottoRuleWeight[]>([]);
    const [backtestDiagnostics, setBacktestDiagnostics] = useState<LottoBacktestDiagnostics | null>(null);
    const [backtestLoading, setBacktestLoading] = useState(false);
    const [loading, setLoading] = useState(false);

    const [results, setResults] = useState<DrawResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [latestPensionDraw, setLatestPensionDraw] = useState<PensionDrawResult | null>(null);
    const [pensionLoading, setPensionLoading] = useState(false);
    const [pensionError, setPensionError] = useState('');
    const [pensionSyncLoading, setPensionSyncLoading] = useState(false);
    const [pensionGenerateLoading, setPensionGenerateLoading] = useState(false);
    const [pensionRecommendations, setPensionRecommendations] = useState<PensionRecommendationSet[]>([]);
    const [pensionRuleWeights, setPensionRuleWeights] = useState<PensionRuleWeight[]>([]);
    const [pensionBacktestDiagnostics, setPensionBacktestDiagnostics] = useState<PensionBacktestDiagnostics | null>(null);
    const [pensionBacktestLoading, setPensionBacktestLoading] = useState(false);
    const [pensionSearchInput, setPensionSearchInput] = useState('');
    const [pensionSearchResult, setPensionSearchResult] = useState<PensionDrawResult | null>(null);
    const [pensionSearchError, setPensionSearchError] = useState('');

    const [syncLoading, setSyncLoading] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [syncError, setSyncError] = useState('');
    const [lastSyncedDraw, setLastSyncedDraw] = useState<number | null>(() => {
        const saved = localStorage.getItem(LAST_SYNC_DRAW_STORAGE_KEY);
        if (!saved) return null;

        const parsed = Number(saved);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    });
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
        const saved = localStorage.getItem(LAST_SYNC_STORAGE_KEY);
        if (!saved) return null;

        const parsed = new Date(saved);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    });

    const [searchInput, setSearchInput] = useState('');
    const [searchResult, setSearchResult] = useState<DrawResult | null>(null);
    const [searchError, setSearchError] = useState('');
    const [page, setPage] = useState(0);

    const scrollToLookupSection = () => {
        document.getElementById('lookup-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const loadResults = async () => {
        setResultsLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/results?limit=50`);
            setResults(res.ok ? await res.json() : []);
        } catch {
            setResults([]);
        } finally {
            setResultsLoading(false);
        }
    };

    const loadLatestPensionResult = async () => {
        setPensionLoading(true);
        setPensionError('');

        try {
            const res = await fetch(`${API_URL}/api/pension/results?limit=12`);
            if (!res.ok) {
                setPensionError('연금복권 결과를 불러오지 못했습니다.');
                setLatestPensionDraw(null);
                return;
            }

            const data = await res.json();
            const list = Array.isArray(data) ? data : data ? [data] : [];
            const latest = list[0] ?? null;
            if (latest?.draw_no) {
                const detailRes = await fetch(`${API_URL}/api/pension/results?drawNo=${latest.draw_no}`);
                const detail = detailRes.ok ? await detailRes.json() : latest;
                setLatestPensionDraw(detail);
            } else {
                setLatestPensionDraw(latest);
            }
        } catch {
            setPensionError('연금복권 결과 조회 중 오류가 발생했습니다.');
            setLatestPensionDraw(null);
        } finally {
            setPensionLoading(false);
        }
    };

    const loadPensionBacktestDiagnostics = async () => {
        setPensionBacktestLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/pension/generate/backtest?draws=120`);
            if (!res.ok) throw new Error('연금복권 백테스트 진단을 불러오지 못했습니다.');
            setPensionBacktestDiagnostics(await res.json());
        } catch {
            setPensionBacktestDiagnostics(null);
        } finally {
            setPensionBacktestLoading(false);
        }
    };

    useEffect(() => {
        loadResults();
        loadLatestPensionResult();
        loadBacktestDiagnostics();
        loadPensionBacktestDiagnostics();
    }, []);

    useEffect(() => {
        if (!syncMessage && !syncError) return;

        const timeout = window.setTimeout(() => {
            setSyncMessage('');
            setSyncError('');
        }, 3500);

        return () => window.clearTimeout(timeout);
    }, [syncMessage, syncError]);

    useEffect(() => {
        const handleLocationChange = () => {
            setRoute(getRouteFromPath(window.location.pathname));
        };

        window.addEventListener('popstate', handleLocationChange);
        handleLocationChange();

        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const latestDraw = results[0] ?? null;
    const totalPages = Math.ceil(Math.max(results.length - 1, 0) / PAGE_SIZE);
    const pagedResults = results.slice(1).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const navigate = (next: Route) => {
        const nextPath = getPathFromRoute(next);
        if (window.location.pathname !== nextPath) {
            window.history.pushState({}, '', nextPath);
        }
        setRoute(next);
    };
    // 복권 전환 시 탭은 결과로 초기화
    const navigateToPage = (page: PageKey) => navigate({ page, tab: 'results' });
    const navigateToTab = (tab: TabKey) => navigate({ page: activePage, tab });

    const searchDraw = async () => {
        const no = Number(searchInput);
        if (!no || no < 1) return;

        setSearchError('');
        setSearchResult(null);

        try {
            const res = await fetch(`${API_URL}/api/results?drwNo=${no}`);
            if (!res.ok) {
                setSearchError(`${no}회차 데이터가 없습니다.`);
                return;
            }
            setSearchResult(await res.json());
        } catch {
            setSearchError('조회 중 오류가 발생했습니다.');
        }
    };

    const generateNumbers = async () => {
        setLoading(true);
        setSets([]);
        setRuleWeights([]);

        try {
            const res = await fetch(`${API_URL}/api/generate`, { method: 'POST' });
            if (!res.ok) throw new Error(`API ${res.status}`);
            const data = await res.json();
            setSets(data.sets);
            setRuleWeights(Array.isArray(data.ruleWeights) ? data.ruleWeights : []);
        } catch {
            const fallback = FALLBACK_LABELS.map(label => {
                const s = new Set<number>();
                while (s.size < 6) s.add(Math.floor(Math.random() * 45) + 1);
                return { label, numbers: Array.from(s).sort((a, b) => a - b) };
            });
            setSets(fallback);
            setRuleWeights([]);
        } finally {
            setLoading(false);
        }
    };

    const loadBacktestDiagnostics = async () => {
        setBacktestLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/generate/backtest?draws=120`);
            if (!res.ok) throw new Error('백테스트 진단을 불러오지 못했습니다.');
            setBacktestDiagnostics(await res.json());
        } catch {
            setBacktestDiagnostics(null);
        } finally {
            setBacktestLoading(false);
        }
    };

    const syncLatestResults = async () => {
        setSyncLoading(true);
        setSyncMessage('');
        setSyncError('');

        try {
            const res = await fetch(`${API_URL}/api/sync`, { method: 'POST' });
            const data = await res.json() as Partial<SyncResponse> & { error?: string };

            if (!res.ok || !data.success) {
                throw new Error(data.error || '동기화에 실패했습니다.');
            }

            await loadResults();
            const now = new Date();
            setLastSyncedAt(now);
            setLastSyncedDraw(data.latestDraw ?? null);
            localStorage.setItem(LAST_SYNC_STORAGE_KEY, now.toISOString());
            if (data.latestDraw) {
                localStorage.setItem(LAST_SYNC_DRAW_STORAGE_KEY, String(data.latestDraw));
            }

            setSyncMessage(
                data.syncedCount && data.syncedCount > 0
                    ? `${data.syncedCount}개 회차를 새로 가져왔습니다. 최신 ${data.latestDraw}회까지 반영됐어요.`
                    : `이미 최신 상태입니다. 현재 ${data.latestDraw}회까지 반영되어 있어요.`
            );
        } catch (error) {
            setSyncError(error instanceof Error ? error.message : '동기화 중 오류가 발생했습니다.');
        } finally {
            setSyncLoading(false);
        }
    };

    const syncLatestPensionResults = async () => {
        setPensionSyncLoading(true);
        setSyncMessage('');
        setSyncError('');

        try {
            const res = await fetch(`${API_URL}/api/pension/sync`, { method: 'POST' });
            const data = await res.json() as { success?: boolean; syncedCount?: number; latestDraw?: number; error?: string };

            if (!res.ok || !data.success) {
                throw new Error(data.error || '연금복권 동기화에 실패했습니다.');
            }

            await loadLatestPensionResult();
            setSyncMessage(
                data.syncedCount && data.syncedCount > 0
                    ? `${data.syncedCount}개 연금복권 회차를 새로 가져왔습니다. 최신 ${data.latestDraw}회까지 반영됐어요.`
                    : `연금복권은 이미 최신 상태입니다. 현재 ${data.latestDraw}회까지 반영되어 있어요.`
            );
        } catch (error) {
            setSyncError(error instanceof Error ? error.message : '연금복권 동기화 중 오류가 발생했습니다.');
        } finally {
            setPensionSyncLoading(false);
        }
    };

    const generatePensionNumbers = async () => {
        setPensionGenerateLoading(true);
        setPensionRecommendations([]);
        setPensionRuleWeights([]);

        try {
            const res = await fetch(`${API_URL}/api/pension/generate`, { method: 'POST' });
            if (!res.ok) throw new Error('연금복권 추천번호 생성에 실패했습니다.');
            const data = await res.json();
            setPensionRecommendations(Array.isArray(data.sets) ? data.sets : []);
            setPensionRuleWeights(Array.isArray(data.ruleWeights) ? data.ruleWeights : []);
        } catch {
            setPensionRecommendations([]);
            setPensionRuleWeights([]);
        } finally {
            setPensionGenerateLoading(false);
        }
    };

    const searchPensionDraw = async () => {
        const no = Number(pensionSearchInput);
        if (!no || no < 1) return;

        setPensionSearchError('');
        setPensionSearchResult(null);

        try {
            const res = await fetch(`${API_URL}/api/pension/results?drawNo=${no}`);
            if (!res.ok) {
                setPensionSearchError(`${no}회차 데이터가 없습니다.`);
                return;
            }

            setPensionSearchResult(await res.json());
        } catch {
            setPensionSearchError('조회 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="min-h-screen text-ink">
            <div className="app-shell relative overflow-hidden">
                {(syncMessage || syncError) && (
                    <div className="pointer-events-none fixed right-4 top-4 z-50 w-[min(92vw,420px)]">
                        <div className={`border-2 border-ink px-4 py-3 text-sm font-bold shadow-brutal ${syncError ? 'bg-coral' : 'bg-mint'}`}>
                            {syncError || syncMessage}
                        </div>
                    </div>
                )}

                <header className="relative border-b-2 border-ink bg-card">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2.5 sm:px-6 sm:py-3 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                            <img
                                src="/images/logo_dong.svg"
                                alt="동행복권"
                                className="header-brand-logo"
                            />
                            <nav className="header-nav" aria-label="복권 메뉴">
                                <button
                                    type="button"
                                    aria-current={activePage === 'lotto' ? 'page' : undefined}
                                    className={`header-nav-link ${activePage === 'lotto' ? 'is-active' : ''}`}
                                    onClick={() => navigateToPage('lotto')}
                                >
                                    로또6/45
                                </button>
                                <button
                                    type="button"
                                    aria-current={activePage === 'pension' ? 'page' : undefined}
                                    className={`header-nav-link ${activePage === 'pension' ? 'is-active' : ''}`}
                                    onClick={() => navigateToPage('pension')}
                                >
                                    연금복권720+
                                </button>
                            </nav>
                        </div>
                    </div>
                    <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
                        <nav className="tab-nav" aria-label={`${activePage === 'lotto' ? '로또6/45' : '연금복권720+'} 메뉴`}>
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    aria-current={activeTab === tab.key ? 'page' : undefined}
                                    className={`tab-nav-link ${activeTab === tab.key ? 'is-active' : ''}`}
                                    onClick={() => navigateToTab(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </header>

                <main className="relative mx-auto max-w-7xl px-5 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6">
                    {activePage === 'lotto' ? (
                    <>
                    {activeTab === 'results' && (
                    <>
                    <section>
                        {resultsLoading ? (
                            <div className="panel px-4 py-8 text-sm text-ink-soft">데이터를 불러오는 중입니다...</div>
                        ) : latestDraw ? (
                            <DrawResultCard
                                draw={latestDraw}
                                chipLabel={`최신 ${latestDraw.drwNo}회`}
                                variant="latest"
                                onPrimaryAction={syncLatestResults}
                                onSecondaryAction={scrollToLookupSection}
                                primaryActionLabel={syncLoading ? '동기화 중...' : '최신 결과 동기화'}
                                secondaryActionLabel="회차 상세 보기"
                                primaryDisabled={syncLoading}
                                statusText={`마지막 동기화 ${lastSyncedAt ? formatDateTime(lastSyncedAt) : '아직 실행 전'} · 최신 반영 ${lastSyncedDraw ? `${lastSyncedDraw}회` : '정보 없음'}`}
                            />
                        ) : (
                            <div className="panel px-4 py-8 text-sm text-ink-soft">데이터가 없습니다. 먼저 `/api/sync`를 실행해 주세요.</div>
                        )}
                    </section>

                    <section id="lookup-section" className="mt-5 grid gap-5 lg:mt-6 lg:grid-cols-[0.85fr_1.15fr]">
                        <SectionCard title="회차 탐색" eyebrow="회차 조회" icon={<Search className="h-5 w-5" />}>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                    type="number"
                                    min={1}
                                    value={searchInput}
                                    onChange={e => {
                                        setSearchInput(e.target.value);
                                        setSearchResult(null);
                                        setSearchError('');
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && searchDraw()}
                                    placeholder="예: 1158"
                                    className="input-brutal h-12 flex-1 px-4 text-sm"
                                />
                                <button
                                    onClick={searchDraw}
                                    className="btn-primary inline-flex h-12 items-center justify-center px-5 text-sm font-semibold transition sm:min-w-[120px]"
                                >
                                    회차 조회
                                </button>
                            </div>

                            <div className="mt-4 border-2 border-ink bg-paper p-4">
                                {searchError ? (
                                    <p className="text-sm font-medium text-ink">{searchError}</p>
                                ) : searchResult ? (
                                    <DrawResultCard draw={searchResult} chipLabel="조회 결과" />
                                ) : (
                                    <p className="text-sm text-ink-soft">회차 번호를 입력하면 당첨 번호와 1등 당첨금을 바로 확인할 수 있습니다.</p>
                                )}
                            </div>
                        </SectionCard>

                        <SectionCard title="최근 회차 히스토리" eyebrow="최근 회차" icon={<ChevronRight className="h-5 w-5" />}>
                            {results.length > 1 ? (
                                <>
                                    <div className="history-table p-3 sm:p-4">
                                        <div className="space-y-2">
                                        {pagedResults.map(draw => (
                                            <div key={draw.drwNo} className="history-row px-4 py-4">
                                                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[88px_1fr_96px] lg:items-center">
                                                    <div>
                                                        <div className="text-sm font-semibold text-ink">{draw.drwNo}회</div>
                                                        <div className="mt-1 text-xs text-ink-soft">{draw.drwNoDate}</div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {[draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6].map((num, i) => (
                                                            <Ball key={i} num={num} size="sm" delay={i * 15} />
                                                        ))}
                                                        <span className="mx-1 text-sm font-semibold text-ink-soft">+</span>
                                                        <div className="relative">
                                                            <Ball num={draw.bnusNo} size="sm" />
                                                            <BonusBadge compact />
                                                        </div>
                                                    </div>

                                                    <div className="text-left lg:text-right">
                                                        <div className="chip chip-mint">
                                                            {formatMoneyKRW(draw.firstWinamnt)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        </div>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="mt-4 flex items-center justify-between border-2 border-ink bg-paper px-4 py-3">
                                            <button
                                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                                disabled={page === 0}
                                                className="btn-icon"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>
                                            <span className="text-sm font-medium text-ink-soft">{page + 1} / {totalPages}</span>
                                            <button
                                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                                disabled={page >= totalPages - 1}
                                                className="btn-icon"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-ink-soft">표시할 과거 회차가 아직 없습니다.</p>
                            )}
                        </SectionCard>
                    </section>

                    <section className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[1.2fr_0.8fr]">
                        <SectionCard title="번호 색상 안내" eyebrow="번호 안내" icon={<Waves className="h-5 w-5" />} bodyClassName="py-4 sm:py-4">
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                                {[1, 11, 21, 31, 41].map((n, i) => {
                                    const label = ['1-10', '11-20', '21-30', '31-40', '41-45'][i];
                                    return (
                                        <div key={label} className="border-2 border-ink bg-paper px-2.5 py-3 text-center sm:px-3 sm:py-3.5">
                                            <div className="flex justify-center">
                                                <Ball num={n} size="sm" />
                                            </div>
                                            <div className="mt-2 text-[11px] font-medium text-ink-soft sm:text-xs">{label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </SectionCard>
                    </section>

                    </>
                    )}

                    {activeTab === 'picks' && (
                    <section>
                        <SectionCard
                            title="추천 번호 세트"
                            eyebrow="추천 번호"
                            icon={<Sparkles className="h-5 w-5" />}
                            action={
                                <button
                                    onClick={generateNumbers}
                                    disabled={loading}
                                    className="btn-primary inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold transition"
                                >
                                    {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" /> : <Sparkles className="h-4 w-4" />}
                                    {loading ? '번호 생성 중...' : '추천 번호 생성'}
                                </button>
                            }
                            accent="soft"
                        >
                            <div className="mb-3 flex items-center justify-end">
                                <div className="chip chip-mint">5개 조합</div>
                            </div>

                            <p className="mb-3 text-sm text-ink-soft">
                                전체 이력과 최근 출현 흐름을 함께 반영하고, 최근 당첨 패턴에 맞는 규칙을 더 먼저 시도합니다.
                            </p>

                            {ruleWeights.length > 0 && (
                                <div className="mb-4 border-2 border-ink bg-paper p-4 sm:p-5">
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">규칙 가중치 분석</p>
                                            <h3 className="mt-1 text-lg font-extrabold text-ink">최근 24회 기준 추천 규칙 우선순위</h3>
                                        </div>
                                        <p className="text-xs text-ink-soft sm:text-sm">점수가 높은 규칙을 먼저 적용해 추천 세트를 만듭니다.</p>
                                    </div>

                                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                        {ruleWeights.map((item, index) => (
                                            <RuleWeightCard key={item.ruleId} item={item} index={index} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {sets.length > 0 ? (
                                <div className="space-y-3">
                                    {sets.map((set, si) => (
                                        <RecommendationCard key={si} set={set} index={si} />
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state px-4 py-10 text-center">
                                    <p className="text-sm font-medium text-ink-soft">
                                        {loading ? '추천 로직을 실행하고 있습니다.' : '상단 버튼을 눌러 새로운 추천 번호를 받아보세요.'}
                                    </p>
                                </div>
                            )}
                        </SectionCard>
                    </section>
                    )}

                    {activeTab === 'backtest' && (
                    <section>
                        <SectionCard
                            title="백테스트 규칙 진단"
                            eyebrow="알고리즘 진단"
                            icon={<Info className="h-5 w-5" />}
                            action={
                                <button
                                    onClick={loadBacktestDiagnostics}
                                    disabled={backtestLoading}
                                    className="btn-secondary inline-flex h-10 items-center justify-center px-4 text-sm"
                                >
                                    {backtestLoading ? '분석 중...' : '진단 새로고침'}
                                </button>
                            }
                        >
                            {backtestDiagnostics ? (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <div className="stat-tile">
                                            <div className="text-xs text-ink-soft">평가 회차</div>
                                            <div className="mt-1 text-xl font-semibold text-ink">{backtestDiagnostics.evaluatedDraws}</div>
                                        </div>
                                        <div className="stat-tile">
                                            <div className="text-xs text-ink-soft">세트 평균 일치</div>
                                            <div className="mt-1 text-xl font-semibold text-ink">{backtestDiagnostics.averageMatchPerSet.toFixed(3)}</div>
                                            <div className="mt-1 text-[11px] text-ink-soft">랜덤 기대 {backtestDiagnostics.baseline.theoretical.expectedMatchPerSet.toFixed(3)}</div>
                                        </div>
                                        <div className="stat-tile">
                                            <div className="text-xs text-ink-soft">회차 최고 평균</div>
                                            <div className="mt-1 text-xl font-semibold text-ink">{backtestDiagnostics.averageBestMatchPerDraw.toFixed(3)}</div>
                                        </div>
                                        <div className="stat-tile">
                                            <div className="text-xs text-ink-soft">공통 규칙 통과율</div>
                                            <div className="mt-1 text-xl font-semibold text-ink">{backtestDiagnostics.generationQuality.commonRulePassRate.toFixed(1)}%</div>
                                        </div>
                                    </div>

                                    <div className="mt-5 border-2 border-ink bg-card p-4 sm:p-5">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                            <div>
                                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">랜덤 대비 유의성</p>
                                                <h3 className="mt-1 text-lg font-extrabold text-ink">기준선 0.800 비교</h3>
                                            </div>
                                            <p className="text-xs text-ink-soft sm:text-sm">6/45 초기하분포 기대값 0.8, 표준편차 {backtestDiagnostics.baseline.theoretical.matchStdPerSet.toFixed(3)}. |z| ≥ 1.96 이면 유의.</p>
                                        </div>
                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            <div className="stat-tile px-4 py-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-sm font-semibold text-ink">추천 알고리즘 전체</div>
                                                    <ZScoreBadge zScore={backtestDiagnostics.baseline.overall.zScore} />
                                                </div>
                                                <div className="mt-2 text-xs text-ink-soft">
                                                    평균 {backtestDiagnostics.averageMatchPerSet.toFixed(3)} · 95% CI {backtestDiagnostics.baseline.overall.ci95[0].toFixed(3)} ~ {backtestDiagnostics.baseline.overall.ci95[1].toFixed(3)}
                                                </div>
                                            </div>
                                            <div className="stat-tile px-4 py-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-sm font-semibold text-ink">순수 랜덤 대조군</div>
                                                    <ZScoreBadge zScore={backtestDiagnostics.baseline.randomControl.zScore} />
                                                </div>
                                                <div className="mt-2 text-xs text-ink-soft">
                                                    평균 {backtestDiagnostics.baseline.randomControl.averageMatchPerSet.toFixed(3)} · 95% CI {backtestDiagnostics.baseline.randomControl.ci95[0].toFixed(3)} ~ {backtestDiagnostics.baseline.randomControl.ci95[1].toFixed(3)} · {backtestDiagnostics.baseline.randomControl.totalSets}세트
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5 border-2 border-ink bg-paper p-4 sm:p-5">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                            <div>
                                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">백테스트 가중치</p>
                                                <h3 className="mt-1 text-lg font-extrabold text-ink">현재 규칙 가중치</h3>
                                            </div>
                                            <p className="text-xs text-ink-soft sm:text-sm">최근 데이터로 계산한 현재 우선순위입니다.</p>
                                        </div>
                                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                            {backtestDiagnostics.ruleDiagnostics.currentWeights.map((item, index) => (
                                                <RuleWeightCard key={`backtest-${item.ruleId}`} item={item} index={index} />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-5 border-2 border-ink bg-card p-4 sm:p-5">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                            <div>
                                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">규칙 성과 분석</p>
                                                <h3 className="mt-1 text-lg font-extrabold text-ink">규칙별 백테스트 성과</h3>
                                            </div>
                                            <p className="text-xs text-ink-soft sm:text-sm">규칙별 생성 결과와 폴백 비율입니다.</p>
                                        </div>
                                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                            {backtestDiagnostics.ruleDiagnostics.performance.map((item) => (
                                                <RulePerformanceCard key={item.ruleId} item={item} />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state px-4 py-10 text-center text-sm text-ink-soft">
                                    {backtestLoading ? '백테스트 진단을 계산하고 있습니다.' : '백테스트 진단 데이터를 불러오지 못했습니다.'}
                                </div>
                            )}
                        </SectionCard>
                    </section>
                    )}
                    </>
                    ) : (
                    <PensionPage
                        latestPensionDraw={latestPensionDraw}
                        pensionLoading={pensionLoading}
                        pensionError={pensionError}
                        pensionSyncLoading={pensionSyncLoading}
                        pensionGenerateLoading={pensionGenerateLoading}
                        pensionSearchInput={pensionSearchInput}
                        pensionRecommendations={pensionRecommendations}
                        pensionRuleWeights={pensionRuleWeights}
                        pensionBacktestDiagnostics={pensionBacktestDiagnostics}
                        pensionBacktestLoading={pensionBacktestLoading}
                        pensionSearchResult={pensionSearchResult}
                        pensionSearchError={pensionSearchError}
                        onPensionSync={syncLatestPensionResults}
                        onPensionGenerate={generatePensionNumbers}
                        onPensionBacktestRefresh={loadPensionBacktestDiagnostics}
                        onPensionSearchInputChange={(value) => {
                            setPensionSearchInput(value);
                            setPensionSearchResult(null);
                            setPensionSearchError('');
                        }}
                        onPensionSearch={searchPensionDraw}
                        tab={activeTab}
                    />
                    )}

                    <section className="mt-5 lg:mt-6">
                        <div className="panel flex flex-col gap-2 px-4 py-3 text-[13px] text-ink-soft sm:flex-row sm:items-start sm:px-5 sm:text-sm">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft sm:h-5 sm:w-5" />
                            <p className="leading-5 sm:leading-6">
                                본 서비스는 과거 당첨 데이터를 바탕으로 정보를 정리하고 추천 번호를 제공하는 참고용 도구입니다. 당첨을 보장하지 않으며,
                                건전한 이용을 위해 과도한 몰입은 피하시기 바랍니다. 생성형 알고리즘 사용 사실을 함께 안내합니다.
                            </p>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

export default App;
