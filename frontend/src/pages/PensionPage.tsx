import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Search, Sparkles } from 'lucide-react';
import { PensionHonestyPanel } from '../components/diagnostics';
import { pensionBrowserApi, useDrawBrowser, WINDOW_SIZE } from '../hooks/useDrawBrowser';
import { FeaturedPensionRecommendationCard, PensionNumberStrip, PensionRecommendationCard, PensionResultCard } from '../components/pension';
import { SectionCard } from '../components/SectionCard';
import type { BacktestStatus } from '../hooks/useBacktest';
import type { PensionState } from '../hooks/usePension';
import type { TabKey } from '../routing';

const BACKTEST_EMPTY_TEXT: Record<BacktestStatus, string> = {
    idle: '연금복권 백테스트 진단을 준비하고 있습니다.',
    loading: '연금복권 백테스트 진단을 계산하고 있습니다.',
    failed: '연금복권 백테스트 진단 데이터를 불러오지 못했습니다.',
    done: '연금복권 백테스트 진단 데이터가 없습니다.',
};

export function PensionPage({ pension, tab }: { pension: PensionState; tab: TabKey }) {
    const {
        generateLoading: pensionGenerateLoading,
        generateError: pensionGenerateError,
        recommendations: pensionRecommendations,
        backtest: pensionBacktestDiagnostics,
        backtestStatus: pensionBacktestStatus,
        generate: onPensionGenerate,
        loadBacktest: onPensionBacktestRefresh,
        ensureBacktest,
    } = pension;

    // 하단 고지 패널에 쓸 백테스트는 추천 탭에 들어올 때만 불러온다
    useEffect(() => {
        if (tab === 'picks') ensureBacktest();
    }, [tab]);

    const featuredRecommendation = pensionRecommendations[0] ?? null;

    return (
        <div className="space-y-6 lg:space-y-8">
            {tab === 'results' && <PensionResultsTab />}

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

                    {featuredRecommendation && (
                        <div className="mb-4">
                            <FeaturedPensionRecommendationCard set={featuredRecommendation} />
                        </div>
                    )}

                    {pensionGenerateError ? (
                        <div className="panel bg-coral px-4 py-8 text-center text-sm font-medium">{pensionGenerateError}</div>
                    ) : pensionRecommendations.length > 0 ? (
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

                {pensionBacktestDiagnostics && <PensionHonestyPanel data={pensionBacktestDiagnostics} />}
            </section>
            )}

        </div>
    );
}

// 로또 결과 화면과 같은 구조: 뷰어 1개 + 그 회차를 따라 움직이는 목록 1개
function PensionResultsTab() {
    const {
        selectedDraw, windowRows, loading, windowError,
        latestDrawNo, selected, canGoOlder, canGoNewer, select, shiftWindow,
        searchInput, searchError, changeSearchInput, search,
    } = useDrawBrowser(pensionBrowserApi);

    const viewerRef = useRef<HTMLDivElement>(null);

    const selectAndReveal = (drawNo: number) => {
        select(drawNo);
        viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const oldest = windowRows.length > 0 ? windowRows[windowRows.length - 1].draw_no : null;

    return (
        <>
            <section ref={viewerRef}>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2 sm:mb-5">
                    <div>
                        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">연금복권720+</p>
                        <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-ink sm:text-3xl">회차별 당첨번호</h2>
                    </div>
                    <p className="text-xs font-medium text-ink-soft sm:text-sm">
                        {selected === latestDrawNo ? '최신 회차입니다. 당첨 결과는 매주 자동으로 갱신됩니다.' : `최신은 ${latestDrawNo}회입니다.`}
                    </p>
                </div>

                {loading ? (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">연금복권 데이터를 불러오는 중입니다...</div>
                ) : selectedDraw ? (
                    <PensionResultCard
                        draw={selectedDraw}
                        onOlder={() => select((selected ?? 0) - 1)}
                        onNewer={() => select((selected ?? 0) + 1)}
                        canGoOlder={canGoOlder}
                        canGoNewer={canGoNewer}
                    />
                ) : (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">
                        {windowError || '아직 연금복권 당첨 결과가 없습니다. 당첨 결과는 매주 자동으로 갱신됩니다.'}
                    </div>
                )}
            </section>

            <section className="mt-5 lg:mt-6">
                <SectionCard
                    title="회차 목록"
                    eyebrow="지난 회차"
                    icon={<Search className="h-5 w-5" />}
                    action={
                        <div className="flex w-full gap-2 sm:w-auto">
                            <input
                                type="number"
                                min={1}
                                max={latestDrawNo ?? undefined}
                                value={searchInput}
                                onChange={e => changeSearchInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && search()}
                                placeholder={latestDrawNo ? `예: ${latestDrawNo}` : '회차'}
                                aria-label="회차 검색"
                                className="input-brutal h-10 w-full px-3 text-sm sm:w-28"
                            />
                            <button onClick={search} className="btn-primary inline-flex h-10 shrink-0 items-center justify-center px-4 text-sm font-semibold transition">
                                이동
                            </button>
                        </div>
                    }
                >
                    {searchError && <p className="mb-3 border-2 border-ink bg-coral px-3 py-2 text-sm font-medium">{searchError}</p>}
                    {windowError && <p className="mb-3 text-sm text-ink-soft">{windowError}</p>}

                    {windowRows.length > 0 ? (
                        <>
                            <div className="history-table p-3 sm:p-4">
                                <div className="space-y-2">
                                {windowRows.map(draw => (
                                    <button
                                        type="button"
                                        key={draw.draw_no}
                                        onClick={() => selectAndReveal(draw.draw_no)}
                                        aria-current={draw.draw_no === selected ? 'true' : undefined}
                                        className={`history-row px-4 py-4 ${draw.draw_no === selected ? 'is-selected' : ''}`}
                                    >
                                        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[104px_1fr] lg:items-center">
                                            <div>
                                                <div className="text-sm font-semibold text-ink">
                                                    {draw.draw_no}회
                                                    {draw.draw_no === selected && <span className="ml-2 font-mono text-[10px] font-bold uppercase">보는 중</span>}
                                                </div>
                                                <div className="mt-1 text-xs text-ink-soft">{draw.draw_date}</div>
                                            </div>
                                            <PensionNumberStrip draw={draw} />
                                        </div>
                                    </button>
                                ))}
                                </div>
                            </div>

                            {/* 창은 보는 회차를 따라 움직인다. 좌=최신 방향, 우=과거 방향. */}
                            <div className="mt-4 flex items-center justify-between gap-3 border-2 border-ink bg-paper px-4 py-3">
                                <button
                                    onClick={() => shiftWindow(WINDOW_SIZE)}
                                    disabled={!canGoNewer}
                                    aria-label="최신 방향으로 이동"
                                    className="btn-icon"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="font-mono text-sm font-medium text-ink-soft">
                                    {selected}회 ~ {oldest}회
                                </span>
                                <button
                                    onClick={() => shiftWindow(-WINDOW_SIZE)}
                                    disabled={!canGoOlder}
                                    aria-label="과거 방향으로 이동"
                                    className="btn-icon"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-ink-soft">표시할 회차가 아직 없습니다.</p>
                    )}
                </SectionCard>
            </section>
        </>
    );
}
