import React, { useEffect, useMemo, useState } from 'react';
import {
    BadgeCheck,
    ChevronLeft,
    ChevronRight,
    Info,
    Search,
    Sparkles,
    TrendingUp,
    Trophy,
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
type HotNumber = { num: number; count: number };
type BallTheme = { base: string; mid: string; dark: string; text: string };
type SyncResponse = {
    success: boolean;
    syncedCount: number;
    nextDrwNo: number;
    latestDraw: number;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const PAGE_SIZE = 5;
const FALLBACK_LABELS = ['홀짝 균형형', '연속 독립형', '합계 안정형', '구간 분포형', '끝수 균형형'];
const LAST_SYNC_STORAGE_KEY = 'lotto-last-synced-at';
const LAST_SYNC_DRAW_STORAGE_KEY = 'lotto-last-synced-draw';

function getBallTheme(num: number): BallTheme {
    if (num <= 10) return { base: '#ffe030', mid: '#f5c800', dark: '#c89800', text: '#5c4200' };
    if (num <= 20) return { base: '#6aaef6', mid: '#2b7de0', dark: '#1457b0', text: '#ffffff' };
    if (num <= 30) return { base: '#f96b60', mid: '#e82b1e', dark: '#b01a10', text: '#ffffff' };
    if (num <= 40) return { base: '#c0c0c0', mid: '#909090', dark: '#606060', text: '#ffffff' };
    return { base: '#6fcc6f', mid: '#3aac3a', dark: '#1e7e1e', text: '#ffffff' };
}

function formatMoneyKRW(amount: number) {
    if (!amount) return '-';
    const eok = amount / 100000000;
    return `${eok.toFixed(eok >= 100 ? 0 : 1).replace(/\.0$/, '')}억 원`;
}

function formatCompactNumber(value: number) {
    if (value >= 100000000) {
        return `${(value / 100000000).toFixed(value >= 1000000000 ? 0 : 1).replace(/\.0$/, '')}억`;
    }
    return value.toLocaleString('ko-KR');
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

function Ball({ num, size = 'md', delay = 0 }: { num: number; size?: 'sm' | 'md'; delay?: number }) {
    const t = getBallTheme(num);
    const dimensions = size === 'sm'
        ? { width: 36, height: 36, fontSize: 12 }
        : { width: 48, height: 48, fontSize: 15 };

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
                background: [
                    'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.55) 18%, transparent 52%)',
                    'radial-gradient(circle at 68% 72%, rgba(0,0,0,0.20) 0%, transparent 45%)',
                    `radial-gradient(circle at 50% 50%, ${t.base} 0%, ${t.mid} 45%, ${t.dark} 100%)`,
                ].join(', '),
                boxShadow: '0 14px 26px rgba(15, 23, 42, 0.16), inset 0 -3px 5px rgba(0,0,0,0.18), inset 0 2px 3px rgba(255,255,255,0.48)',
                textShadow: num <= 10 ? '0 1px 1px rgba(0,0,0,0.18)' : '0 1px 2px rgba(0,0,0,0.36)',
            }}
        >
            {num}
        </div>
    );
}

function SectionCard({
    title,
    icon,
    eyebrow,
    children,
    accent = 'default',
}: {
    title: string;
    icon?: React.ReactNode;
    eyebrow?: string;
    children: React.ReactNode;
    accent?: 'default' | 'soft';
}) {
    return (
        <section className={`panel ${accent === 'soft' ? 'panel-soft' : ''}`}>
            <div className="flex items-start justify-between gap-3 border-b border-white/60 px-5 py-4 sm:px-6">
                <div>
                    {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>}
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
                </div>
                {icon && <div className="rounded-2xl bg-slate-900/5 p-2.5 text-slate-700">{icon}</div>}
            </div>
            <div className="px-5 py-5 sm:px-6">{children}</div>
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
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-white">B</span>
                </div>
            </div>
        </div>
    );
}

function App() {
    const [sets, setSets] = useState<LottoSet[]>([]);
    const [loading, setLoading] = useState(false);

    const [results, setResults] = useState<DrawResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);

    const [hotNumbers, setHotNumbers] = useState<HotNumber[]>([]);
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

    const loadHotNumbers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/stats/hot`);
            const data = res.ok ? await res.json() : [];
            setHotNumbers(Array.isArray(data) ? data : []);
        } catch {
            setHotNumbers([]);
        }
    };

    useEffect(() => {
        loadResults();
        loadHotNumbers();
    }, []);

    useEffect(() => {
        if (!syncMessage && !syncError) return;

        const timeout = window.setTimeout(() => {
            setSyncMessage('');
            setSyncError('');
        }, 3500);

        return () => window.clearTimeout(timeout);
    }, [syncMessage, syncError]);

    const latestDraw = results[0] ?? null;
    const totalPages = Math.ceil(Math.max(results.length - 1, 0) / PAGE_SIZE);
    const pagedResults = results.slice(1).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const overviewStats = useMemo(() => {
        const totalPrize = results.reduce((sum, draw) => sum + (draw.firstWinamnt || 0), 0);
        const avgPrize = results.length ? Math.round(totalPrize / results.length) : 0;

        return [
            {
                label: '분석 회차',
                value: results.length ? `${results.length}개` : '-',
                note: '최대 50회차 기준',
            },
            {
                label: '최근 회차',
                value: latestDraw ? `${latestDraw.drwNo}회` : '-',
                note: latestDraw?.drwNoDate ?? '데이터 대기 중',
            },
            {
                label: '평균 1등 금액',
                value: avgPrize ? formatCompactNumber(avgPrize) : '-',
                note: '최근 조회 결과 평균',
            },
        ];
    }, [latestDraw, results]);

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

            await Promise.all([loadResults(), loadHotNumbers()]);
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

                <div className="pointer-events-none absolute inset-0 opacity-90">
                    <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(56,189,248,0.2),_transparent_65%)]" />
                    <div className="absolute right-[-120px] top-[240px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.16),_transparent_68%)]" />
                    <div className="absolute left-[-120px] bottom-[80px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.14),_transparent_70%)]" />
                </div>

                <header className="relative border-b border-white/20 bg-[linear-gradient(180deg,rgba(2,18,48,0.88),rgba(7,28,69,0.78))] backdrop-blur-xl">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-100/75">공식 로또 안내</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <h1 className="text-xl font-semibold text-white sm:text-2xl">동행복권 로또 AI 분석기</h1>
                                <span className="rounded-full border border-fuchsia-300/35 bg-fuchsia-400/15 px-2.5 py-1 text-xs font-semibold text-fuchsia-100">
                                    회차 데이터 안내
                                </span>
                            </div>
                        </div>
                        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-slate-200 sm:flex">
                            <BadgeCheck className="h-4 w-4 text-[#ffd84d]" />
                            회차 정보와 추천 번호를 함께 확인
                        </div>
                    </div>
                </header>

                <main className="relative mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-10 lg:py-12">
                    <section className="hero-panel rounded-[32px] border border-white/50 p-5 sm:rounded-[36px] sm:p-8 lg:p-10">
                            <div className="hero-marquee mb-5 overflow-hidden rounded-2xl border border-white/60 py-3 sm:mb-6">
                            <div className="hero-marquee-track flex items-center gap-8 whitespace-nowrap px-4 text-[12px] font-semibold uppercase tracking-[0.35em] text-emerald-800/65">
                                <span>당첨 결과 안내</span>
                                <span>최신 회차</span>
                                <span>추천 번호</span>
                                <span>회차 통계</span>
                                <span>당첨 결과 안내</span>
                                <span>최신 회차</span>
                                <span>추천 번호</span>
                                <span>회차 통계</span>
                            </div>
                        </div>
                        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.95fr] lg:items-start lg:gap-10">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                                    <BadgeCheck className="h-4 w-4" />
                                    회차 기반 통계 안내
                                </div>
                                <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:mt-5 sm:text-5xl lg:text-6xl">
                                    최신 당첨 결과와 추천 번호를
                                    <span className="block text-emerald-800">한 화면에서 편하게 확인하세요.</span>
                                </h2>
                                <div className="hero-outline mt-4 text-[12vw] font-black leading-none text-[#033074]/[0.05] sm:text-[88px] lg:text-[112px]">
                                    LOTTO
                                </div>
                                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-5 sm:leading-7 sm:text-base">
                                    최근 회차 결과, 추천 번호, 자주 나온 번호, 회차 조회 기능을 한곳에 정리했습니다.
                                    필요한 정보를 빠르게 확인할 수 있도록 화면 흐름과 정보 우선순위를 서비스형으로 다듬었습니다.
                                </p>

                                <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row">
                                    <button
                                        onClick={generateNumbers}
                                        disabled={loading}
                                        className="btn-primary inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                                    >
                                        {loading ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        {loading ? '번호 생성 중...' : '추천 번호 생성'}
                                    </button>
                                    <button
                                        onClick={syncLatestResults}
                                        disabled={syncLoading}
                                        className="btn-secondary inline-flex min-w-[180px] items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60"
                                    >
                                        {syncLoading ? '동기화 중...' : '최신 결과 동기화'}
                                    </button>
                                </div>

                                <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                                    <span className="rounded-full border border-fuchsia-300/20 bg-white/70 px-3 py-1.5 text-fuchsia-800">최신 회차 기반</span>
                                    <span className="rounded-full border border-fuchsia-300/20 bg-white/70 px-3 py-1.5 text-fuchsia-800">핫 넘버 반영</span>
                                    <span className="rounded-full border border-fuchsia-300/20 bg-white/70 px-3 py-1.5 text-fuchsia-800">모바일 최적화</span>
                                </div>

                                <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3">
                                    <div className="hero-mini-card rounded-3xl px-4 py-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">빠른 안내</p>
                                        <p className="mt-2 text-lg font-semibold text-slate-950">주요 정보 우선</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">최신 회차와 추천 번호를 첫 화면에서 바로 확인할 수 있습니다.</p>
                                    </div>
                                    <div className="hero-mini-card rounded-3xl px-4 py-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">화면 구성</p>
                                        <p className="mt-2 text-lg font-semibold text-slate-950">읽기 쉬운 구성</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">제목, 카드, 통계를 분리해 필요한 정보를 빠르게 찾을 수 있게 했습니다.</p>
                                    </div>
                                    <div className="hero-mini-card rounded-3xl px-4 py-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">기기 대응</p>
                                        <p className="mt-2 text-lg font-semibold text-slate-950">반응형 최적화</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">모바일과 데스크톱 모두에서 같은 정보 흐름을 유지하도록 정리했습니다.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="panel-soft rounded-[26px] border border-white/70 p-4 shadow-[0_18px_50px_rgba(3,48,116,0.08)] sm:rounded-[30px] sm:p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">최신 결과</p>
                                        <h3 className="mt-1 text-xl font-semibold text-slate-950">최신 당첨 결과</h3>
                                    </div>
                                    <div className="rounded-2xl bg-slate-900/5 p-2.5 text-slate-700">
                                        <Trophy className="h-5 w-5" />
                                    </div>
                                </div>

                                <div className="latest-sync-card mt-4 rounded-2xl p-4">
                                    <p className="text-sm font-semibold text-slate-900">최신 회차 업데이트</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">마지막 동기화 {lastSyncedAt ? formatDateTime(lastSyncedAt) : '아직 실행 전'} · 최신 반영 {lastSyncedDraw ? `${lastSyncedDraw}회` : '정보 없음'}</p>
                                </div>

                                <div className="mt-4">
                                    {resultsLoading ? (
                                        <div className="rounded-2xl bg-slate-50 px-4 py-8 text-sm text-slate-500">데이터를 불러오는 중입니다...</div>
                                    ) : latestDraw ? (
                                        <div className="space-y-4">
                                            <div className="latest-draw-card rounded-[24px] px-4 py-4 sm:rounded-[28px] sm:px-5 sm:py-5">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <div className="latest-draw-chip text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-700">
                                                            최신 {latestDraw.drwNo}회
                                                        </div>
                                                        <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                                                            제 {latestDraw.drwNo}회 당첨 결과
                                                        </div>
                                                        <div className="mt-1 text-sm text-slate-500">추첨일 {latestDraw.drwNoDate}</div>
                                                    </div>
                                                    <div className="rounded-full bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700">
                                                        1등 {formatMoneyKRW(latestDraw.firstWinamnt)}
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                                                    {[latestDraw.drwtNo1, latestDraw.drwtNo2, latestDraw.drwtNo3, latestDraw.drwtNo4, latestDraw.drwtNo5, latestDraw.drwtNo6].map((num, i) => (
                                                        <Ball key={i} num={num} size="sm" delay={i * 20} />
                                                    ))}
                                                    <span className="mx-1 self-center text-sm font-semibold text-slate-300">+</span>
                                                    <div className="relative">
                                                        <Ball num={latestDraw.bnusNo} size="sm" />
                                                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-white">B</span>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-3">
                                                    <div className="latest-draw-stat rounded-2xl px-3 py-3">
                                                        <div className="text-[11px] font-medium text-slate-500">보너스 번호</div>
                                                        <div className="mt-1 text-lg font-semibold text-slate-900">{latestDraw.bnusNo}</div>
                                                    </div>
                                                    <div className="latest-draw-stat rounded-2xl px-3 py-3">
                                                        <div className="text-[11px] font-medium text-slate-500">번호 합계</div>
                                                        <div className="mt-1 text-lg font-semibold text-slate-900">
                                                            {latestDraw.drwtNo1 + latestDraw.drwtNo2 + latestDraw.drwtNo3 + latestDraw.drwtNo4 + latestDraw.drwtNo5 + latestDraw.drwtNo6}
                                                        </div>
                                                    </div>
                                                    <div className="latest-draw-stat rounded-2xl px-3 py-3">
                                                        <div className="text-[11px] font-medium text-slate-500">홀수 개수</div>
                                                        <div className="mt-1 text-lg font-semibold text-slate-900">
                                                            {[latestDraw.drwtNo1, latestDraw.drwtNo2, latestDraw.drwtNo3, latestDraw.drwtNo4, latestDraw.drwtNo5, latestDraw.drwtNo6].filter(num => num % 2 === 1).length}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl bg-slate-50 px-4 py-8 text-sm text-slate-500">데이터가 없습니다. 먼저 `/api/sync`를 실행해 주세요.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="mt-8 grid gap-4 sm:grid-cols-3 lg:mt-10">
                        {overviewStats.map(item => (
                            <div key={item.label} className="panel stat-card rounded-[24px] px-4 py-4 sm:px-5">
                                <p className="text-xs font-medium text-slate-500">{item.label}</p>
                                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p>
                                <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                            </div>
                        ))}
                    </section>

                    <section className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr_0.9fr] lg:mt-10">
                        <SectionCard title="추천 번호 세트" eyebrow="추천 번호" icon={<Sparkles className="h-5 w-5" />} accent="soft">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">조건을 반영한 추천 조합 5개</p>
                                        <p className="mt-1 text-xs text-slate-500">통계 조건을 반영해 비교하기 쉬운 형태로 제공합니다.</p>
                                    </div>
                                <div className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">5개 조합</div>
                            </div>

                            {sets.length > 0 ? (
                                <div className="space-y-4">
                                    {sets.map((set, si) => (
                                        <div key={si} className="recommend-card rounded-[28px] px-4 py-4 sm:px-5 sm:py-5">
                                            <div className="mb-4 flex items-start justify-between gap-3">
                                                <div>
                                                    <span className="recommend-badge text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-700">Set {si + 1}</span>
                                                    <div className="mt-2 text-base font-semibold text-slate-950">{set.label}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">구성</div>
                                                    <div className="mt-1 text-sm font-semibold text-slate-700">조건 반영</div>
                                                </div>
                                            </div>

                                            <div className="mb-4 flex flex-wrap gap-2">
                                                {set.numbers.map((num, i) => (
                                                    <Ball key={i} num={num} delay={si * 70 + i * 30} />
                                                ))}
                                            </div>

                                            <div className="grid gap-2 sm:grid-cols-3">
                                                <div className="recommend-stat rounded-2xl px-3 py-2.5">
                                                    <div className="text-[11px] font-medium text-slate-500">합계</div>
                                                    <div className="mt-1 text-sm font-semibold text-slate-900">
                                                        {set.numbers.reduce((sum, num) => sum + num, 0)}
                                                    </div>
                                                </div>
                                                <div className="recommend-stat rounded-2xl px-3 py-2.5">
                                                    <div className="text-[11px] font-medium text-slate-500">홀수 개수</div>
                                                    <div className="mt-1 text-sm font-semibold text-slate-900">
                                                        {set.numbers.filter(num => num % 2 === 1).length}
                                                    </div>
                                                </div>
                                                <div className="recommend-stat rounded-2xl px-3 py-2.5">
                                                    <div className="text-[11px] font-medium text-slate-500">최대 간격</div>
                                                    <div className="mt-1 text-sm font-semibold text-slate-900">
                                                        {Math.max(...set.numbers) - Math.min(...set.numbers)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
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

                        <SectionCard title="자주 나온 번호" eyebrow="통계 정보" icon={<TrendingUp className="h-5 w-5" />}>
                            {hotNumbers.length > 0 ? (
                                <>
                                    <div className="hot-summary mb-4 rounded-[22px] px-4 py-4 sm:rounded-[24px]">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">상위 번호</div>
                                        <div className="mt-2 flex items-end justify-between gap-3">
                                            <div>
                                                <div className="text-3xl font-semibold tracking-tight text-slate-950">No. {hotNumbers[0].num}</div>
                                                <div className="mt-1 text-sm text-slate-500">누적 데이터 기준 출현 빈도가 가장 높은 번호입니다.</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">출현 수</div>
                                                <div className="mt-1 text-2xl font-semibold text-fuchsia-700">{hotNumbers[0].count}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                    {hotNumbers.slice(0, 10).map((item, index) => (
                                        <div key={item.num} className="hot-card rounded-[22px] px-3 py-3 sm:rounded-[24px]">
                                            <div className="flex items-center gap-3">
                                                <div className="hot-rank">{index + 1}</div>
                                                <Ball num={item.num} size="sm" delay={index * 25} />
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold text-slate-900">번호 {item.num}</div>
                                                    <div className="text-xs text-slate-500">출현 {item.count}회</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">비율</div>
                                                    <div className="mt-1 text-sm font-semibold text-fuchsia-700">
                                                        {((item.count / (hotNumbers[0]?.count || 1)) * 100).toFixed(0)}%
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
                                                <div
                                                    className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed,#ff4ecd,#ff7a18)]"
                                                    style={{ width: `${(item.count / (hotNumbers[0]?.count || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-slate-500">핫 넘버 통계를 아직 불러오지 못했습니다.</p>
                            )}
                        </SectionCard>

                        <SectionCard title="회차 조회" eyebrow="회차 조회" icon={<Search className="h-5 w-5" />}>
                            <div className="flex flex-col gap-3">
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
                                    className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white"
                                />
                                <button
                                    onClick={searchDraw}
                                    className="btn-primary inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition"
                                >
                                    회차 조회
                                </button>
                            </div>

                                    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                {searchError ? (
                                    <p className="text-sm font-medium text-rose-600">{searchError}</p>
                                ) : searchResult ? (
                                    <div className="latest-draw-card rounded-[24px] px-4 py-4 sm:rounded-[28px] sm:px-5 sm:py-5">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <div className="latest-draw-chip text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-700">
                                                    조회 결과
                                                </div>
                                                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                                                    제 {searchResult.drwNo}회 당첨 결과
                                                </div>
                                                <div className="mt-1 text-sm text-slate-500">추첨일 {searchResult.drwNoDate}</div>
                                            </div>
                                            <div className="rounded-full bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700">
                                                1등 {formatMoneyKRW(searchResult.firstWinamnt)}
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                                            {[searchResult.drwtNo1, searchResult.drwtNo2, searchResult.drwtNo3, searchResult.drwtNo4, searchResult.drwtNo5, searchResult.drwtNo6].map((num, i) => (
                                                <Ball key={i} num={num} size="sm" delay={i * 20} />
                                            ))}
                                            <span className="mx-1 self-center text-sm font-semibold text-slate-300">+</span>
                                            <div className="relative">
                                                <Ball num={searchResult.bnusNo} size="sm" />
                                                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-white">B</span>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-3">
                                            <div className="latest-draw-stat rounded-2xl px-3 py-3">
                                                <div className="text-[11px] font-medium text-slate-500">보너스 번호</div>
                                                <div className="mt-1 text-lg font-semibold text-slate-900">{searchResult.bnusNo}</div>
                                            </div>
                                            <div className="latest-draw-stat rounded-2xl px-3 py-3">
                                                <div className="text-[11px] font-medium text-slate-500">번호 합계</div>
                                                <div className="mt-1 text-lg font-semibold text-slate-900">
                                                    {searchResult.drwtNo1 + searchResult.drwtNo2 + searchResult.drwtNo3 + searchResult.drwtNo4 + searchResult.drwtNo5 + searchResult.drwtNo6}
                                                </div>
                                            </div>
                                            <div className="latest-draw-stat rounded-2xl px-3 py-3">
                                                <div className="text-[11px] font-medium text-slate-500">홀수 개수</div>
                                                <div className="mt-1 text-lg font-semibold text-slate-900">
                                                    {[searchResult.drwtNo1, searchResult.drwtNo2, searchResult.drwtNo3, searchResult.drwtNo4, searchResult.drwtNo5, searchResult.drwtNo6].filter(num => num % 2 === 1).length}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">조회할 회차 번호를 입력해 주세요.</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">당첨 번호와 1등 당첨금을 함께 확인할 수 있으며 엔터 키로도 바로 조회됩니다.</p>
                                    </div>
                                )}
                            </div>
                        </SectionCard>
                    </section>

                    <section className="mt-8 grid gap-5 lg:mt-10 lg:grid-cols-[1.2fr_0.8fr]">
                        <SectionCard title="번호 색상 안내" eyebrow="번호 안내" icon={<Waves className="h-5 w-5" />}>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                {[1, 11, 21, 31, 41].map((n, i) => {
                                    const label = ['1-10', '11-20', '21-30', '31-40', '41-45'][i];
                                    return (
                                        <div key={label} className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-4 text-center">
                                            <div className="flex justify-center">
                                                <Ball num={n} size="sm" />
                                            </div>
                                            <div className="mt-3 text-xs font-medium text-slate-500">{label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </SectionCard>

                        <SectionCard title="최근 회차 히스토리" eyebrow="최근 회차" icon={<ChevronRight className="h-5 w-5" />}>
                            {results.length > 1 ? (
                                <>
                                    <div className="history-table rounded-[24px] p-3 sm:p-4">
                                        <div className="history-header hidden items-center gap-3 rounded-2xl px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:grid md:grid-cols-[88px_1fr_96px]">
                                            <span>회차</span>
                                            <span>당첨 번호</span>
                                            <span className="text-right">1등 금액</span>
                                        </div>

                                        <div className="space-y-2">
                                        {pagedResults.map(draw => (
                                            <div key={draw.drwNo} className="history-row rounded-[22px] px-4 py-4">
                                                <div className="flex flex-col gap-3 md:grid md:grid-cols-[88px_1fr_96px] md:items-center">
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
                                                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-white">B</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-left md:text-right">
                                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">당첨금</div>
                                                        <div className="mt-1 text-sm font-semibold text-fuchsia-700">{formatMoneyKRW(draw.firstWinamnt)}</div>
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

                    <section className="mt-8 lg:mt-10">
                        <div className="panel flex flex-col gap-3 rounded-[28px] px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-start sm:px-6">
                            <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                            <p className="leading-6">
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
