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
        sum: number;
        oddCount: number;
        uniqueDigitCount: number;
        maxDuplicateCount: number;
        hasThreeConsecutive: boolean;
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
    commonRulePassRate: number;
    relaxedFallbackRate: number;
    randomFallbackRate: number;
};
type LottoBacktestDiagnostics = {
    algorithm: string;
    evaluatedDraws: number;
    averageMatchPerSet: number;
    averageBestMatchPerDraw: number;
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
type BallTheme = { base: string; mid: string; dark: string; text: string };
type SyncResponse = {
    success: boolean;
    syncedCount: number;
    nextDrwNo: number;
    latestDraw: number;
};

type PageKey = 'lotto' | 'pension';

function getPageFromPath(pathname: string): PageKey {
    return pathname === '/pension' ? 'pension' : 'lotto';
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const PAGE_SIZE = 5;
const FALLBACK_LABELS = ['홀짝 균형형', '연속 독립형', '합계 안정형', '구간 분포형', '끝수 균형형'];
const LAST_SYNC_STORAGE_KEY = 'lotto-last-synced-at';
const LAST_SYNC_DRAW_STORAGE_KEY = 'lotto-last-synced-draw';
const LOTTO_RULE_LABELS: Record<string, string> = {
    'odd-balance': '홀짝 균형형',
    'no-consecutive-pair': '연속 독립형',
    'stable-sum': '합계 안정형',
    'zone-distribution': '구간 분포형',
    'tail-balance': '끝수 균형형',
};

function getBallTheme(num: number): BallTheme {
    if (num <= 10) return { base: '#fdd835', mid: '#f6c21a', dark: '#d59b00', text: '#5b4300' };
    if (num <= 20) return { base: '#6ec6ff', mid: '#3aa0eb', dark: '#1976d2', text: '#ffffff' };
    if (num <= 30) return { base: '#ff7b6e', mid: '#f25545', dark: '#d83929', text: '#ffffff' };
    if (num <= 40) return { base: '#cfd8dc', mid: '#a7b2b9', dark: '#7b8790', text: '#ffffff' };
    return { base: '#8bd76d', mid: '#58b947', dark: '#2e8b2e', text: '#ffffff' };
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
    const t = getBallTheme(num);
    const dimensions = size === 'sm'
        ? { width: 38, height: 38, fontSize: 12 }
        : size === 'responsive'
            ? { width: 'clamp(38px, 8.4vw, 52px)', height: 'clamp(38px, 8.4vw, 52px)', fontSize: 'clamp(12px, 3.7vw, 16px)' }
            : { width: 52, height: 52, fontSize: 16 };

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
                fontWeight: 800,
                fontSize: dimensions.fontSize,
                color: t.text,
                flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.92)',
                background: [
                    'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.7) 18%, rgba(255,255,255,0.18) 34%, transparent 42%)',
                    'radial-gradient(circle at 70% 74%, rgba(0,0,0,0.16) 0%, transparent 46%)',
                    `linear-gradient(180deg, ${t.base} 0%, ${t.mid} 62%, ${t.dark} 100%)`,
                ].join(', '),
                boxShadow: [
                    '0 10px 18px rgba(15, 23, 42, 0.12)',
                    'inset 0 -4px 6px rgba(0,0,0,0.14)',
                    'inset 0 2px 3px rgba(255,255,255,0.42)',
                    '0 0 0 1px rgba(15,23,42,0.04)',
                ].join(', '),
                textShadow: num <= 10 ? '0 1px 1px rgba(0,0,0,0.16)' : '0 1px 2px rgba(0,0,0,0.32)',
            }}
        >
            {num}
        </div>
    );
}

function BonusBadge({ compact = false }: { compact?: boolean }) {
    return (
        <span
            className="absolute -right-1 -top-1 flex items-center justify-center rounded-full border border-white/90 bg-emerald-600 font-bold text-white shadow-[0_4px_10px_rgba(22,101,52,0.28)]"
            style={{
                width: compact ? 15 : 16,
                height: compact ? 15 : 16,
                fontSize: compact ? 8 : 9,
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
            <div className={`flex items-start justify-between gap-3 border-b border-white/60 px-5 py-4 sm:px-6 ${headerClassName}`.trim()}>
                <div>
                    {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>}
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
                </div>
                <div className="flex items-center gap-3">
                    {action}
                    {icon && <div className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500">{icon}</div>}
                </div>
            </div>
            <div className={`px-5 py-5 sm:px-6 ${bodyClassName}`.trim()}>{children}</div>
        </section>
    );
}

function DrawRow({ draw, highlight = false }: { draw: DrawResult; highlight?: boolean }) {
    const nums = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];

    return (
        <div className={`rounded-3xl border px-4 py-4 transition-colors sm:px-5 ${highlight ? 'border-sky-200 bg-sky-50/80' : 'border-slate-200/80 bg-white/70'}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-900">제 {draw.drwNo}회</div>
                    <div className="mt-1 text-xs text-slate-500">추첨일 {draw.drwNoDate}</div>
                </div>
                <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                    1등 {formatMoneyKRW(draw.firstWinamnt)}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {nums.map((n, i) => <Ball key={i} num={n} size="sm" delay={i * 20} />)}
                <span className="mx-1 text-sm font-semibold text-slate-300">+</span>
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
            <div className="latest-feature-card rounded-[30px] px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
                {statusText && (
                    <div className="latest-feature-status mb-5 rounded-2xl px-4 py-3 text-center sm:mb-7">
                        <p className="text-xs font-medium tracking-[-0.01em] text-slate-600 sm:text-sm">{statusText}</p>
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
                        <div className="text-[42px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[56px]">{draw.drwNo}회</div>
                        <div className="mt-1 text-[18px] font-medium text-slate-500 sm:text-[20px]">{draw.drwNoDate}</div>
                    </div>
                    <div className="result-arrow-shell result-arrow-right text-slate-300">
                        <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                    </div>
                </div>

                <div className="result-divider mt-8 sm:mt-10" />

                <div className="mt-9 flex items-center justify-center gap-3 sm:gap-4 lg:gap-5">
                    {numbers.map((num, i) => (
                        <Ball key={i} num={num} size="responsive" delay={i * 20} />
                    ))}
                    <span className="text-4xl font-light text-slate-300 sm:text-5xl">+</span>
                    <div className="relative">
                        <Ball num={draw.bnusNo} size="responsive" />
                        <BonusBadge />
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-[16px] font-medium text-slate-500 sm:text-[18px]">1등 당첨금</p>
                    <p className="mt-3 text-[36px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[54px]">
                        {formatMoneyKRW(draw.firstWinamnt)}
                    </p>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4">
                    <button
                        type="button"
                        onClick={onSecondaryAction}
                        className="latest-feature-secondary inline-flex min-h-14 items-center justify-center rounded-[24px] px-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-800 transition sm:px-5 sm:text-lg"
                    >
                        {secondaryActionLabel ?? '회차 상세 보기'}
                    </button>
                    <button
                        type="button"
                        onClick={onPrimaryAction}
                        disabled={primaryDisabled}
                        className="latest-feature-primary inline-flex min-h-14 items-center justify-center rounded-[24px] px-3 text-[15px] font-semibold tracking-[-0.02em] text-white transition disabled:opacity-60 sm:px-5 sm:text-lg"
                    >
                        {primaryActionLabel ?? '최신 결과 동기화'}
                    </button>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 sm:mt-8 sm:text-base">
                    <span>보너스 {draw.bnusNo}</span>
                    <span className="text-slate-300">/</span>
                    <span>번호 합계 {sum}</span>
                    <span className="text-slate-300">/</span>
                    <span>홀수 {oddCount}개</span>
                </div>
            </div>
        );
    }

    return (
        <div className="latest-draw-card rounded-[24px] px-5 py-6 sm:rounded-[28px] sm:px-8 sm:py-9 lg:px-12 lg:py-10">
            <div className="relative text-center">
                <div className="pointer-events-none absolute left-0 top-1/2 hidden -translate-y-1/2 lg:flex">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                        <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 lg:flex">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                        <ChevronRight className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    {chipLabel}
                </div>
                <h3 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[42px]">
                    제 <span className="text-emerald-600">{draw.drwNo}</span>회 추첨 결과
                </h3>
                <p className="mt-3 text-base font-medium text-slate-500 sm:text-[18px]">{draw.drwNoDate} 추첨</p>
                <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
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
                    <span className="text-4xl font-light text-slate-300 sm:text-5xl">+</span>
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
                <div className="latest-draw-stat rounded-2xl px-3 py-3">
                    <div className="text-[11px] font-medium text-slate-500">보너스 번호</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{draw.bnusNo}</div>
                </div>
                <div className="latest-draw-stat rounded-2xl px-3 py-3">
                    <div className="text-[11px] font-medium text-slate-500">번호 합계</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{sum}</div>
                </div>
                <div className="latest-draw-stat rounded-2xl px-3 py-3">
                    <div className="text-[11px] font-medium text-slate-500">홀수 개수</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{oddCount}</div>
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
        <div className="recommend-card rounded-[28px] px-4 py-5 sm:px-6 sm:py-7">
            <div className="text-center">
                <div className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    추천 Set {index + 1}
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[28px]">
                    {set.label}
                </h3>
                {(set.meta?.ruleWeight || ruleName) && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 sm:text-sm">
                        {set.meta?.ruleWeight ? (
                            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-semibold text-slate-700">
                                weight {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
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

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 sm:mt-8 sm:text-base">
                <span>번호 합계 {sum}</span>
                <span className="text-slate-300">/</span>
                <span>홀수 {oddCount}개</span>
                <span className="text-slate-300">/</span>
                <span>최대 간격 {spread}</span>
            </div>
        </div>
    );
}

function RuleWeightCard({ item, index }: { item: LottoRuleWeight; index: number }) {
    return (
        <div className="rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">우선순위 {index + 1}</div>
                    <div className="mt-2 text-base font-semibold text-slate-950">{item.label}</div>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    가중치 {item.weight.toFixed(3)}
                </div>
            </div>

            <div className="mt-4 space-y-2">
                <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                        <span>규칙 점수</span>
                        <span>{(item.score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(item.score * 100, 6)}%` }} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 sm:text-sm">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div>공통+세트 통과</div>
                        <div className="mt-1 font-semibold text-slate-900">{(item.passRate * 100).toFixed(1)}%</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div>세트 규칙 일치</div>
                        <div className="mt-1 font-semibold text-slate-900">{(item.recentMatchRate * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function RulePerformanceCard({ item }: { item: LottoRulePerformance }) {
    return (
        <div className="rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-semibold text-slate-950">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">생성 {item.generatedCount}회</div>
                </div>
                <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    평균 일치 {item.averageMatches.toFixed(3)}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500 sm:text-sm">
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div>공통 규칙</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.commonRulePassRate.toFixed(1)}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div>완화 폴백</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.relaxedFallbackRate.toFixed(1)}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div>랜덤 폴백</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.randomFallbackRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}

function PensionDigitBall({ value, color }: { value: string; color: string }) {
    return (
        <div
            className="flex h-[clamp(50px,8.6vw,78px)] w-[clamp(50px,8.6vw,78px)] items-center justify-center rounded-full border-[4px] bg-white text-[clamp(24px,4vw,40px)] font-semibold text-slate-950"
            style={{ borderColor: color }}
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
    const colors = ['#d1d5db', '#ea580c', '#fb8c00', '#fbbc04', '#2d9cdb', '#a06cd5', '#b0b7c3'];
    const digits = number.padStart(6, '0').slice(-6).split('');

    return (
        <div className="grid gap-5 border-t border-slate-100 py-6 lg:grid-cols-[1.05fr_1.55fr] lg:items-center lg:gap-12">
            <div className="text-center lg:text-left">
                <div className="text-[24px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[34px] lg:text-[38px]">
                    {label} <span className="mx-1.5 text-slate-300">|</span> {subtitle}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                {showBand && band ? (
                    <div className="text-center">
                        <PensionDigitBall value={band} color={colors[0]} />
                        <div className="mt-2 text-sm font-medium text-slate-500">조</div>
                    </div>
                ) : prefixLabel ? (
                    <div className="px-1 text-base font-medium text-slate-500 sm:text-lg">{prefixLabel}</div>
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
        <div className="latest-feature-card rounded-[30px] px-5 py-7 sm:px-8 sm:py-9 lg:px-12 lg:py-12">
            <div className="latest-feature-heading">
                <div className="result-arrow-shell result-arrow-left">
                    <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                    <h2 className="text-[30px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[48px] lg:text-[56px]">
                    제 <span className="text-emerald-600">{draw.draw_no}</span>회 추첨 결과
                    </h2>
                    <p className="mt-3 text-base font-medium text-slate-500 sm:text-[18px]">{draw.draw_date} 추첨</p>
                </div>
                <div className="result-arrow-shell result-arrow-right text-slate-300">
                    <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                </div>
            </div>

            <div className="result-divider mt-8 sm:mt-10" />

            <div className="mt-8">
                <PensionNumberRow label="1등" subtitle="월 700만원 x 20년" band={draw.winning_band} number={draw.winning_number} />
                <PensionNumberRow label="보너스" subtitle="월 100만원 x 10년" number={draw.bonus_number} showBand={false} prefixLabel="각조" />
            </div>

            <div className="mt-8 text-center text-xs text-slate-500 sm:text-sm">
                최근 동기화 {formatDateTime(new Date(draw.synced_at))}
            </div>
        </div>
    );
}

function PensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
    return (
        <div className="recommend-card rounded-[28px] px-4 py-5 sm:px-6 sm:py-7">
            <div className="text-center">
                <div className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    {set.label}
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[28px]">
                    연금복권 추천번호
                </h3>
            </div>

            <div className="result-divider mt-7" />

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                <div className="px-1 text-base font-medium text-slate-500 sm:text-lg">각조</div>
                {set.number.split('').map((digit, index) => {
                    const colors = ['#ea580c', '#fb8c00', '#fbbc04', '#2d9cdb', '#a06cd5', '#b0b7c3'];
                    return <PensionDigitBall key={`${set.label}-${index}`} value={digit} color={colors[index]} />;
                })}
            </div>

            <div className="result-label-row mt-5">
                <span className="result-label-line" />
                <span className="result-label-text">추천번호</span>
                <span className="result-label-line" />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 sm:text-base">
                <span>합계 {set.meta.sum}</span>
                <span className="text-slate-300">/</span>
                <span>홀수 {set.meta.oddCount}개</span>
                <span className="text-slate-300">/</span>
                <span>고유숫자 {set.meta.uniqueDigitCount}개</span>
                <span className="text-slate-300">/</span>
                <span>최대 중복 {set.meta.maxDuplicateCount}개</span>
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
    pensionRecommendation,
    pensionSearchResult,
    pensionSearchError,
    onPensionSync,
    onPensionGenerate,
    onPensionSearchInputChange,
    onPensionSearch,
}: {
    latestPensionDraw: PensionDrawResult | null;
    pensionLoading: boolean;
    pensionError: string;
    pensionSyncLoading: boolean;
    pensionGenerateLoading: boolean;
    pensionSearchInput: string;
    pensionRecommendation: PensionRecommendationSet | null;
    pensionSearchResult: PensionDrawResult | null;
    pensionSearchError: string;
    onPensionSync: () => void;
    onPensionGenerate: () => void;
    onPensionSearchInputChange: (value: string) => void;
    onPensionSearch: () => void;
}) {
    return (
        <div className="space-y-6 lg:space-y-8">
            <section>
                <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">연금복권720+</p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">회차별 당첨번호</h2>
                    </div>
                    <div className="inline-flex min-w-[120px] items-center justify-between gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.03)] sm:min-w-[180px] sm:px-5">
                        <span>{latestPensionDraw ? `${latestPensionDraw.draw_no}회` : '회차 선택'}</span>
                        <ChevronRight className="h-4 w-4 rotate-90 text-slate-400" />
                    </div>
                </div>

                <div className="mb-3 flex justify-end">
                    <button
                        onClick={onPensionSync}
                        disabled={pensionSyncLoading}
                        className="btn-primary inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white transition disabled:opacity-60"
                    >
                        {pensionSyncLoading ? '동기화 중...' : '최신 결과 동기화'}
                    </button>
                </div>
                {pensionLoading ? (
                    <div className="rounded-[30px] border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">연금복권 데이터를 불러오는 중입니다...</div>
                ) : pensionError ? (
                    <div className="rounded-[30px] border border-rose-200 bg-rose-50 px-4 py-8 text-sm text-rose-700">{pensionError}</div>
                ) : latestPensionDraw ? (
                    <PensionResultCard draw={latestPensionDraw} />
                ) : (
                    <div className="rounded-[30px] border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">연금복권 데이터가 아직 없습니다. 먼저 `/api/pension/sync`를 실행해 주세요.</div>
                )}
            </section>

            <section className="mt-5 lg:mt-6">
                <SectionCard
                    title="추천번호 생성"
                    eyebrow="연금복권 추천"
                    icon={<Sparkles className="h-5 w-5" />}
                    action={
                        <button
                            onClick={onPensionGenerate}
                            disabled={pensionGenerateLoading}
                            className="btn-primary inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white transition disabled:opacity-60"
                        >
                            {pensionGenerateLoading ? '생성 중...' : '추천번호 생성'}
                        </button>
                    }
                >
                    <p className="mb-4 text-sm text-slate-500">
                        숫자 6개를 독립 추출한 뒤 합계, 홀짝 균형, 고유 숫자 수, 연속수, 중복 제한을 통과한 조합만 추천합니다.
                    </p>

                    {pensionRecommendation ? (
                        <PensionRecommendationCard set={pensionRecommendation} />
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                            버튼을 눌러 연금복권 추천번호 1세트를 생성해 보세요.
                        </div>
                    )}
                </SectionCard>
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
                            className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                        />
                        <button
                            onClick={onPensionSearch}
                            className="btn-primary inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition sm:min-w-[120px]"
                        >
                            회차 조회
                        </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                        {pensionSearchError ? (
                            <p className="text-sm font-medium text-rose-600">{pensionSearchError}</p>
                        ) : pensionSearchResult ? (
                            <PensionResultCard draw={pensionSearchResult} />
                        ) : (
                            <p className="text-sm text-slate-500">조회할 연금복권 회차를 입력하면 지난 회차 추첨 결과를 확인할 수 있습니다.</p>
                        )}
                    </div>
                </SectionCard>
            </section>
        </div>
    );
}

function App() {
    const [activePage, setActivePage] = useState<PageKey>(() => getPageFromPath(window.location.pathname));
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
    const [pensionRecommendation, setPensionRecommendation] = useState<PensionRecommendationSet | null>(null);
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

    useEffect(() => {
        loadResults();
        loadLatestPensionResult();
        loadBacktestDiagnostics();
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
            setActivePage(getPageFromPath(window.location.pathname));
        };

        window.addEventListener('popstate', handleLocationChange);
        handleLocationChange();

        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const latestDraw = results[0] ?? null;
    const totalPages = Math.ceil(Math.max(results.length - 1, 0) / PAGE_SIZE);
    const pagedResults = results.slice(1).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const navigateToPage = (page: PageKey) => {
        const nextPath = page === 'pension' ? '/pension' : '/lotto';
        if (window.location.pathname === nextPath) {
            setActivePage(page);
            return;
        }

        window.history.pushState({}, '', nextPath);
        setActivePage(page);
    };

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
        setPensionRecommendation(null);

        try {
            const res = await fetch(`${API_URL}/api/pension/generate`, { method: 'POST' });
            if (!res.ok) throw new Error('연금복권 추천번호 생성에 실패했습니다.');
            const data = await res.json();
            setPensionRecommendation(Array.isArray(data.sets) ? data.sets[0] ?? null : null);
        } catch {
            setPensionRecommendation(null);
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
        <div className="min-h-screen text-slate-900">
            <div className="app-shell relative overflow-hidden">
                {(syncMessage || syncError) && (
                    <div className="pointer-events-none fixed right-4 top-4 z-50 w-[min(92vw,420px)]">
                        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl ${syncError ? 'border-rose-200 bg-rose-50/95 text-rose-700' : 'border-emerald-200 bg-emerald-50/95 text-emerald-700'}`}>
                            {syncError || syncMessage}
                        </div>
                    </div>
                )}

                <header className="relative border-b border-slate-200/70 bg-white/95">
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
                </header>

                <main className="relative mx-auto max-w-7xl px-5 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6">
                    {activePage === 'lotto' ? (
                    <>
                    <section>
                        {resultsLoading ? (
                            <div className="rounded-[30px] border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">데이터를 불러오는 중입니다...</div>
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
                            <div className="rounded-[30px] border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">데이터가 없습니다. 먼저 `/api/sync`를 실행해 주세요.</div>
                        )}
                    </section>

                    <section className="mt-5 lg:mt-6">
                        <SectionCard
                            title="추천 번호 세트"
                            eyebrow="추천 번호"
                            icon={<Sparkles className="h-5 w-5" />}
                            action={
                                <button
                                    onClick={generateNumbers}
                                    disabled={loading}
                                    className="btn-primary inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition disabled:opacity-60"
                                >
                                    {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Sparkles className="h-4 w-4" />}
                                    {loading ? '번호 생성 중...' : '추천 번호 생성'}
                                </button>
                            }
                            accent="soft"
                        >
                            <div className="mb-3 flex items-center justify-end">
                                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">5개 조합</div>
                            </div>

                            <p className="mb-3 text-sm text-slate-500">
                                전체 이력과 최근 출현 흐름을 함께 반영하고, 최근 당첨 패턴에 맞는 규칙을 더 먼저 시도합니다.
                            </p>

                            {ruleWeights.length > 0 && (
                                <div className="mb-4 rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">규칙 가중치 분석</p>
                                            <h3 className="mt-1 text-lg font-semibold text-slate-950">최근 24회 기준 추천 규칙 우선순위</h3>
                                        </div>
                                        <p className="text-xs text-slate-500 sm:text-sm">점수가 높은 규칙을 먼저 적용해 추천 세트를 만듭니다.</p>
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
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
                                    <p className="text-sm font-medium text-slate-500">
                                        {loading ? '추천 로직을 실행하고 있습니다.' : '상단 버튼을 눌러 새로운 추천 번호를 받아보세요.'}
                                    </p>
                                </div>
                            )}
                        </SectionCard>
                    </section>

                    <section className="mt-5 lg:mt-6">
                        <SectionCard
                            title="백테스트 규칙 진단"
                            eyebrow="알고리즘 진단"
                            icon={<Info className="h-5 w-5" />}
                            action={
                                <button
                                    onClick={loadBacktestDiagnostics}
                                    disabled={backtestLoading}
                                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition disabled:opacity-60"
                                >
                                    {backtestLoading ? '분석 중...' : '진단 새로고침'}
                                </button>
                            }
                        >
                            {backtestDiagnostics ? (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                            <div className="text-xs text-slate-500">평가 회차</div>
                                            <div className="mt-1 text-xl font-semibold text-slate-950">{backtestDiagnostics.evaluatedDraws}</div>
                                        </div>
                                        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                            <div className="text-xs text-slate-500">세트 평균 일치</div>
                                            <div className="mt-1 text-xl font-semibold text-slate-950">{backtestDiagnostics.averageMatchPerSet.toFixed(3)}</div>
                                        </div>
                                        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                            <div className="text-xs text-slate-500">회차 최고 평균</div>
                                            <div className="mt-1 text-xl font-semibold text-slate-950">{backtestDiagnostics.averageBestMatchPerDraw.toFixed(3)}</div>
                                        </div>
                                        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                            <div className="text-xs text-slate-500">공통 규칙 통과율</div>
                                            <div className="mt-1 text-xl font-semibold text-slate-950">{backtestDiagnostics.generationQuality.commonRulePassRate.toFixed(1)}%</div>
                                        </div>
                                    </div>

                                    <div className="mt-5 rounded-[24px] border border-sky-100 bg-sky-50/50 p-4 sm:p-5">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">백테스트 가중치</p>
                                                <h3 className="mt-1 text-lg font-semibold text-slate-950">현재 규칙 가중치</h3>
                                            </div>
                                            <p className="text-xs text-slate-500 sm:text-sm">최근 데이터로 계산한 현재 우선순위입니다.</p>
                                        </div>
                                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                            {backtestDiagnostics.ruleDiagnostics.currentWeights.map((item, index) => (
                                                <RuleWeightCard key={`backtest-${item.ruleId}`} item={item} index={index} />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-white/70 p-4 sm:p-5">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">규칙 성과 분석</p>
                                                <h3 className="mt-1 text-lg font-semibold text-slate-950">규칙별 백테스트 성과</h3>
                                            </div>
                                            <p className="text-xs text-slate-500 sm:text-sm">규칙별 생성 결과와 폴백 비율입니다.</p>
                                        </div>
                                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                            {backtestDiagnostics.ruleDiagnostics.performance.map((item) => (
                                                <RulePerformanceCard key={item.ruleId} item={item} />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center text-sm text-slate-500">
                                    {backtestLoading ? '백테스트 진단을 계산하고 있습니다.' : '백테스트 진단 데이터를 불러오지 못했습니다.'}
                                </div>
                            )}
                        </SectionCard>
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
                                    className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                                />
                                <button
                                    onClick={searchDraw}
                                    className="btn-primary inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition sm:min-w-[120px]"
                                >
                                    회차 조회
                                </button>
                            </div>

                            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                {searchError ? (
                                    <p className="text-sm font-medium text-rose-600">{searchError}</p>
                                ) : searchResult ? (
                                    <DrawResultCard draw={searchResult} chipLabel="조회 결과" />
                                ) : (
                                    <p className="text-sm text-slate-500">회차 번호를 입력하면 당첨 번호와 1등 당첨금을 바로 확인할 수 있습니다.</p>
                                )}
                            </div>
                        </SectionCard>

                        <SectionCard title="최근 회차 히스토리" eyebrow="최근 회차" icon={<ChevronRight className="h-5 w-5" />}>
                            {results.length > 1 ? (
                                <>
                                    <div className="history-table rounded-[24px] p-3 sm:p-4">
                                        <div className="space-y-2">
                                        {pagedResults.map(draw => (
                                            <div key={draw.drwNo} className="history-row rounded-[22px] px-4 py-4">
                                                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[88px_1fr_96px] lg:items-center">
                                                    <div>
                                                        <div className="text-sm font-semibold text-slate-950">{draw.drwNo}회</div>
                                                        <div className="mt-1 text-xs text-slate-500">{draw.drwNoDate}</div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {[draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6].map((num, i) => (
                                                            <Ball key={i} num={num} size="sm" delay={i * 15} />
                                                        ))}
                                                        <span className="mx-1 text-sm font-semibold text-slate-300">+</span>
                                                        <div className="relative">
                                                            <Ball num={draw.bnusNo} size="sm" />
                                                            <BonusBadge compact />
                                                        </div>
                                                    </div>

                                                    <div className="text-left lg:text-right">
                                                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 inline-flex lg:inline-flex">
                                                            {formatMoneyKRW(draw.firstWinamnt)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        </div>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                                            <button
                                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                                disabled={page === 0}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-35"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>
                                            <span className="text-sm font-medium text-slate-500">{page + 1} / {totalPages}</span>
                                            <button
                                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                                disabled={page >= totalPages - 1}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-35"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-slate-500">표시할 과거 회차가 아직 없습니다.</p>
                            )}
                        </SectionCard>
                    </section>

                    <section className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[1.2fr_0.8fr]">
                        <SectionCard title="번호 색상 안내" eyebrow="번호 안내" icon={<Waves className="h-5 w-5" />} bodyClassName="py-4 sm:py-4">
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                                {[1, 11, 21, 31, 41].map((n, i) => {
                                    const label = ['1-10', '11-20', '21-30', '31-40', '41-45'][i];
                                    return (
                                        <div key={label} className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-2.5 py-3 text-center sm:px-3 sm:py-3.5">
                                            <div className="flex justify-center">
                                                <Ball num={n} size="sm" />
                                            </div>
                                            <div className="mt-2 text-[11px] font-medium text-slate-500 sm:text-xs">{label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </SectionCard>
                    </section>

                    <section className="mt-4 lg:mt-5">
                        <div className="panel flex flex-col gap-2 rounded-[24px] px-4 py-3 text-[13px] text-slate-600 sm:flex-row sm:items-start sm:px-5 sm:text-sm">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 sm:h-5 sm:w-5" />
                            <p className="leading-5 sm:leading-6">
                                본 서비스는 과거 당첨 데이터를 바탕으로 정보를 정리하고 추천 번호를 제공하는 참고용 도구입니다. 당첨을 보장하지 않으며,
                                건전한 이용을 위해 과도한 몰입은 피하시기 바랍니다. 생성형 알고리즘 사용 사실을 함께 안내합니다.
                            </p>
                        </div>
                    </section>
                    </>
                    ) : (
                    <PensionPage
                        latestPensionDraw={latestPensionDraw}
                        pensionLoading={pensionLoading}
                        pensionError={pensionError}
                        pensionSyncLoading={pensionSyncLoading}
                        pensionGenerateLoading={pensionGenerateLoading}
                        pensionSearchInput={pensionSearchInput}
                        pensionRecommendation={pensionRecommendation}
                        pensionSearchResult={pensionSearchResult}
                        pensionSearchError={pensionSearchError}
                        onPensionSync={syncLatestPensionResults}
                        onPensionGenerate={generatePensionNumbers}
                        onPensionSearchInputChange={(value) => {
                            setPensionSearchInput(value);
                            setPensionSearchResult(null);
                            setPensionSearchError('');
                        }}
                        onPensionSearch={searchPensionDraw}
                    />
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
