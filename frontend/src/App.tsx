import React, { useState, useEffect } from 'react';
import { Sparkles, Search, ChevronLeft, ChevronRight, Info } from 'lucide-react';

type DrawResult = {
    drwNo: number;
    drwNoDate: string;
    drwtNo1: number; drwtNo2: number; drwtNo3: number;
    drwtNo4: number; drwtNo5: number; drwtNo6: number;
    bnusNo: number;
    firstWinamnt: number;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

type BallTheme = { base: string; mid: string; dark: string; text: string };

function getBallTheme(num: number): BallTheme {
    if (num <= 10) return { base: '#ffe030', mid: '#f5c800', dark: '#c89800', text: '#5c4200' };
    if (num <= 20) return { base: '#6aaef6', mid: '#2b7de0', dark: '#1457b0', text: '#ffffff' };
    if (num <= 30) return { base: '#f96b60', mid: '#e82b1e', dark: '#b01a10', text: '#ffffff' };
    if (num <= 40) return { base: '#c0c0c0', mid: '#909090', dark: '#606060', text: '#ffffff' };
    return { base: '#6fcc6f', mid: '#3aac3a', dark: '#1e7e1e', text: '#ffffff' };
}

function Ball({ num, delay = 0 }: { num: number; delay?: number }) {
    const t = getBallTheme(num);
    return (
        <div
            style={{
                animationDelay: `${delay}ms`,
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 14,
                color: t.text,
                flexShrink: 0,
                background: [
                    `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.55) 18%, transparent 52%)`,
                    `radial-gradient(circle at 65% 72%, rgba(0,0,0,0.18) 0%, transparent 45%)`,
                    `radial-gradient(circle at 50% 50%, ${t.base} 0%, ${t.mid} 45%, ${t.dark} 100%)`,
                ].join(', '),
                boxShadow: `0 3px 8px rgba(0,0,0,0.30), inset 0 -2px 4px rgba(0,0,0,0.20), inset 0 2px 3px rgba(255,255,255,0.55)`,
                textShadow: num <= 10 ? '0 1px 1px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.45)',
            }}
        >
            {num}
        </div>
    );
}

function DrawRow({ draw, highlight = false }: { draw: DrawResult; highlight?: boolean }) {
    const nums = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];
    const prize = draw.firstWinamnt ? `${Math.round(draw.firstWinamnt / 100000000)}억` : '-';
    return (
        <div className={`px-4 py-3 ${highlight ? 'bg-blue-50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold" style={{ color: '#033074' }}>{draw.drwNo}회</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{draw.drwNoDate}</span>
                    <span className="text-xs font-semibold" style={{ color: '#c0392b' }}>1등 {prize}</span>
                </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
                {nums.map((n, i) => <Ball key={i} num={n} />)}
                <span className="text-gray-300 font-light text-base mx-0.5">+</span>
                <div className="relative">
                    <Ball num={draw.bnusNo} />
                    <span className="absolute -top-1 -right-1 text-[9px] font-bold text-white bg-gray-500 rounded-full w-3.5 h-3.5 flex items-center justify-center">B</span>
                </div>
            </div>
        </div>
    );
}

type LottoSet = { numbers: number[]; label: string };

const FALLBACK_LABELS = ['홀짝 균형형', '연속 독립형', '합계 안정형', '구간 분포형', '끝수 균형형'];

function App() {
    const [sets, setSets] = useState<LottoSet[]>([]);
    const [loading, setLoading] = useState(false);

    const [results, setResults] = useState<DrawResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchResult, setSearchResult] = useState<DrawResult | null>(null);
    const [searchError, setSearchError] = useState('');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 5;

    useEffect(() => {
        setResultsLoading(true);
        fetch(`${API_URL}/api/results?limit=50`)
            .then(r => r.ok ? r.json() : [])
            .then(data => setResults(data))
            .catch(() => {})
            .finally(() => setResultsLoading(false));
    }, []);

    const searchDraw = async () => {
        const no = Number(searchInput);
        if (!no || no < 1) return;
        setSearchError('');
        setSearchResult(null);
        try {
            const res = await fetch(`${API_URL}/api/results?drwNo=${no}`);
            if (!res.ok) { setSearchError(`${no}회차 데이터가 없습니다.`); return; }
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

    return (
        <div className="min-h-screen bg-gray-100 text-gray-800" style={{ fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif' }}>

            {/* Navigation Bar */}
            <div className="sticky top-0 z-10" style={{ backgroundColor: '#033074' }}>
                <div className="max-w-lg mx-auto px-4 py-4">
                    <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-xl tracking-tight">동행복권</span>
                        <span className="text-white/60 text-sm font-normal">로또 AI 분석기</span>
                    </div>
                    {/* blue accent line */}
                    <div className="h-0.5 mt-3 -mx-4" style={{ backgroundColor: '#4486d4' }} />
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

                {/* Number Display Card */}
                <section>
                    <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                        {/* Card header */}
                        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: '#f0f4fb' }}>
                            <Sparkles className="w-4 h-4" style={{ color: '#033074' }} />
                            <span className="text-sm font-bold" style={{ color: '#033074' }}>AI 추천 번호</span>
                        </div>

                        {/* Ball area */}
                        <div className="px-4 py-4">
                            {sets.length > 0 ? (
                                <div className="space-y-3">
                                    {sets.map((set, si) => (
                                        <div key={si} className="flex items-center gap-2">
                                            <span className="text-xs font-semibold shrink-0 w-20 text-right" style={{ color: '#033074' }}>
                                                {set.label}
                                            </span>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {set.numbers.map((num, i) => (
                                                    <Ball key={i} num={num} delay={si * 60 + i * 30} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex justify-center items-center min-h-[44px]">
                                    <p className="text-gray-400 text-sm">
                                        {loading ? '번호 생성 중...' : '아래 버튼을 눌러 번호를 생성하세요'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Generate Button */}
                        <div className="px-4 pb-4">
                            <button
                                onClick={generateNumbers}
                                disabled={loading}
                                className="w-full py-3 rounded flex items-center justify-center gap-2 text-white font-bold text-sm transition-opacity disabled:opacity-50"
                                style={{ backgroundColor: '#033074' }}
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        번호 생성하기
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Ball Color Guide */}
                <section>
                    <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 border-b border-gray-100" style={{ backgroundColor: '#f0f4fb' }}>
                            <span className="text-sm font-bold" style={{ color: '#033074' }}>번호 색상 안내</span>
                        </div>
                        <div className="px-5 py-4 flex justify-between">
                            {[1, 11, 21, 31, 41].map((n, i) => {
                                const t = getBallTheme(n);
                                const label = ['1–10','11–20','21–30','31–40','41–45'][i];
                                return (
                                    <div key={label} className="flex flex-col items-center gap-1.5">
                                        <div style={{
                                            width: 16, height: 16, borderRadius: '50%',
                                            background: [
                                                `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85) 0%, transparent 55%)`,
                                                `radial-gradient(circle at 50% 50%, ${t.base} 0%, ${t.mid} 45%, ${t.dark} 100%)`,
                                            ].join(', '),
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                        }} />
                                        <span className="text-xs text-gray-500">{label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Latest Draw Result */}
                <section>
                    <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: '#f0f4fb' }}>
                            <span className="text-sm font-bold" style={{ color: '#033074' }}>최신 당첨결과</span>
                            {results.length > 0 && (
                                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: '#033074' }}>
                                    제{results[0].drwNo}회
                                </span>
                            )}
                        </div>
                        {resultsLoading ? (
                            <div className="px-4 py-4 text-sm text-gray-400">데이터 로딩 중...</div>
                        ) : results.length === 0 ? (
                            <div className="px-4 py-4 text-sm text-gray-400">데이터가 없습니다. /api/sync를 먼저 실행하세요.</div>
                        ) : (
                            <DrawRow draw={results[0]} highlight />
                        )}
                    </div>
                </section>

                {/* Previous Draw Search */}
                <section>
                    <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: '#f0f4fb' }}>
                            <Search className="w-4 h-4" style={{ color: '#033074' }} />
                            <span className="text-sm font-bold" style={{ color: '#033074' }}>이전 회차 조회</span>
                        </div>

                        {/* 회차 검색 */}
                        <div className="px-4 pt-3 pb-2 flex gap-2">
                            <input
                                type="number"
                                min={1}
                                value={searchInput}
                                onChange={e => { setSearchInput(e.target.value); setSearchResult(null); setSearchError(''); }}
                                onKeyDown={e => e.key === 'Enter' && searchDraw()}
                                placeholder="회차 번호 입력"
                                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                            />
                            <button
                                onClick={searchDraw}
                                className="px-4 py-2 rounded text-white text-sm font-semibold"
                                style={{ backgroundColor: '#033074' }}
                            >
                                조회
                            </button>
                        </div>

                        {/* 검색 결과 */}
                        {searchError && (
                            <div className="px-4 pb-3 text-sm text-red-500">{searchError}</div>
                        )}
                        {searchResult && (
                            <DrawRow draw={searchResult} highlight />
                        )}

                        {/* 이전 회차 목록 (최신 1개 제외) */}
                        {!searchResult && results.length > 1 && (
                            <>
                                <div className="divide-y divide-gray-100">
                                    {results.slice(1).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map(draw => (
                                        <DrawRow key={draw.drwNo} draw={draw} />
                                    ))}
                                </div>
                                {results.slice(1).length > PAGE_SIZE && (
                                    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
                                        <button
                                            onClick={() => setPage(p => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                            className="p-1 rounded disabled:opacity-30"
                                        >
                                            <ChevronLeft className="w-4 h-4 text-gray-500" />
                                        </button>
                                        <span className="text-xs text-gray-400">
                                            {page + 1} / {Math.ceil(results.slice(1).length / PAGE_SIZE)}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => Math.min(Math.ceil(results.slice(1).length / PAGE_SIZE) - 1, p + 1))}
                                            disabled={page >= Math.ceil(results.slice(1).length / PAGE_SIZE) - 1}
                                            className="p-1 rounded disabled:opacity-30"
                                        >
                                            <ChevronRight className="w-4 h-4 text-gray-500" />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>

                {/* Disclaimer */}
                <section>
                    <div className="bg-white rounded border border-gray-200 px-4 py-3 flex gap-2.5 shadow-sm">
                        <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-gray-400 leading-relaxed">
                            본 서비스는 통계적 분석일 뿐 당첨을 보장하지 않습니다. 과몰입에 주의하세요.
                            2026 AI 기본법을 준수하여 생성형 알고리즘이 사용되었음을 명시합니다.
                        </p>
                    </div>
                </section>

                <div className="h-4" />
            </div>
        </div>
    );
}

export default App;
