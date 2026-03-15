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

type LottoSet = { numbers: number[]; label: string };
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

    return (
        <div className="recommend-card rounded-[28px] px-4 py-5 sm:px-6 sm:py-7">
            <div className="text-center">
                <div className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    추천 Set {index + 1}
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[28px]">
                    {set.label}
                </h3>
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

function PensionPage() {
    return (
        <div className="space-y-6 lg:space-y-8">
            <section className="panel rounded-[28px] px-5 py-6 sm:px-6 sm:py-7">
                <div className="max-w-3xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">연금복권720+</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                        연금복권720+ 화면을
                        <span className="block">별도 페이지로 분리했습니다.</span>
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                        지금은 기본 화면 전환 구조만 먼저 연결해두었습니다. 연금복권 전용 데이터 조회와 추천 로직은
                        다음 단계에서 이 페이지에 이어서 붙일 수 있습니다.
                    </p>
                </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <SectionCard title="현재 상태" eyebrow="페이지 안내" accent="soft">
                    <div className="space-y-3 text-sm text-slate-600">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                            연금복권720+ 메뉴 클릭 시 이 페이지로 전환됩니다.
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                            로또6/45 화면과 분리되어 이후 독립적인 UI와 API를 붙이기 쉬운 구조입니다.
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="다음에 붙일 기능" eyebrow="확장 예정">
                    <div className="space-y-2 text-sm text-slate-600">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">최근 추첨 결과 조회</div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">회차 검색</div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">번호/조합 분석</div>
                    </div>
                </SectionCard>
            </section>
        </div>
    );
}

function App() {
    const [activePage, setActivePage] = useState<PageKey>(() => getPageFromPath(window.location.pathname));
    const [sets, setSets] = useState<LottoSet[]>([]);
    const [loading, setLoading] = useState(false);

    const [results, setResults] = useState<DrawResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);

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

    useEffect(() => {
        loadResults();
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

        try {
            const res = await fetch(`${API_URL}/api/generate`, { method: 'POST' });
            if (!res.ok) throw new Error(`API ${res.status}`);
            const data = await res.json();
            setSets(data.sets);
        } catch {
            const fallback = FALLBACK_LABELS.map(label => {
                const s = new Set<number>();
                while (s.size < 6) s.add(Math.floor(Math.random() * 45) + 1);
                return { label, numbers: Array.from(s).sort((a, b) => a - b) };
            });
            setSets(fallback);
        } finally {
            setLoading(false);
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
                                전체 빈도와 최근 30회 빈도를 가중치로 반영하고, 합계/홀짝/연속수 조건을 통과한 조합만 추천합니다.
                            </p>

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
                    <PensionPage />
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
