import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Search, Sparkles, Waves } from 'lucide-react';
import { Ball, BonusBadge } from '../components/Ball';
import { MultipleComparisonNote, RulePerformanceCard, RuleWeightCard, SignificancePanel } from '../components/diagnostics';
import { DrawResultCard, RecommendationCard } from '../components/lotto';
import { SectionCard } from '../components/SectionCard';
import { formatMoneyKRW } from '../format';
import type { BacktestStatus } from '../hooks/useBacktest';
import type { LottoState } from '../hooks/useLotto';
import type { TabKey } from '../routing';
import { bonferroniZ } from '../stats';

const PAGE_SIZE = 5;
const BACKTEST_EMPTY_TEXT: Record<BacktestStatus, string> = {
    idle: '백테스트 진단을 준비하고 있습니다.',
    loading: '백테스트 진단을 계산하고 있습니다.',
    failed: '백테스트 진단 데이터를 불러오지 못했습니다.',
    done: '백테스트 진단 데이터가 없습니다.',
};

export function LottoPage({ lotto, tab }: { lotto: LottoState; tab: TabKey }) {
    if (tab === 'picks') return <LottoPicksTab lotto={lotto} />;
    if (tab === 'backtest') return <LottoBacktestTab lotto={lotto} />;
    return <LottoResultsTab lotto={lotto} />;
}

function LottoResultsTab({ lotto }: { lotto: LottoState }) {
    const {
        results,
        resultsLoading,
        searchInput,
        searchResult,
        searchError,
        changeSearchInput,
        search: searchDraw,
    } = lotto;
    const [page, setPage] = useState(0);

    const latestDraw = results[0] ?? null;
    const totalPages = Math.ceil(Math.max(results.length - 1, 0) / PAGE_SIZE);
    const pagedResults = results.slice(1).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const scrollToLookupSection = () => {
        document.getElementById('lookup-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <>
            <section>
                {resultsLoading ? (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">데이터를 불러오는 중입니다...</div>
                ) : latestDraw ? (
                    <DrawResultCard
                        draw={latestDraw}
                        chipLabel={`최신 ${latestDraw.drwNo}회`}
                        variant="latest"
                        onDetailAction={scrollToLookupSection}
                        statusText="당첨 결과는 매주 자동으로 갱신됩니다."
                    />
                ) : (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">아직 당첨 결과가 없습니다. 당첨 결과는 매주 자동으로 갱신됩니다.</div>
                )}
            </section>

            <section id="lookup-section" className="mt-5 grid items-start gap-5 lg:mt-6 lg:grid-cols-[0.85fr_1.15fr]">
                <SectionCard title="회차 탐색" eyebrow="회차 조회" icon={<Search className="h-5 w-5" />}>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            type="number"
                            min={1}
                            value={searchInput}
                            onChange={e => changeSearchInput(e.target.value)}
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
                                                <div className="chip">
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

            <section className="mt-4 lg:mt-5">
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
    );
}

function LottoPicksTab({ lotto }: { lotto: LottoState }) {
    const { sets, ruleWeights, generateError, generating: loading, generate: generateNumbers } = lotto;

    return (
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
                <p className="mb-3 text-sm text-ink-soft">
                    전체 이력과 최근 출현 흐름을 함께 반영하고, 최근 당첨 패턴에 맞는 규칙을 더 먼저 시도합니다.
                    한 번에 <span className="font-semibold text-ink">5개 조합</span>을 만듭니다.
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

                {generateError ? (
                    <div className="panel bg-coral px-4 py-8 text-center text-sm font-medium">{generateError}</div>
                ) : sets.length > 0 ? (
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
    );
}

function LottoBacktestTab({ lotto }: { lotto: LottoState }) {
    const {
        backtest: backtestDiagnostics,
        backtestStatus,
        loadBacktest: loadBacktestDiagnostics,
        ensureBacktest,
    } = lotto;

    useEffect(() => {
        ensureBacktest();
    }, []);

    // 규칙별 z 는 규칙 수만큼 동시에 검정하므로 Bonferroni 기준을 쓴다
    const ruleCount = backtestDiagnostics?.ruleDiagnostics.performance.length ?? 0;
    const ruleZThreshold = bonferroniZ(ruleCount);

    return (
        <section>
            <SectionCard
                title="백테스트 규칙 진단"
                eyebrow="알고리즘 진단"
                icon={<Info className="h-5 w-5" />}
                action={
                    <button
                        onClick={loadBacktestDiagnostics}
                        disabled={backtestStatus === 'loading'}
                        className="btn-secondary inline-flex h-10 items-center justify-center px-4 text-sm"
                    >
                        {backtestStatus === 'loading' ? '분석 중...' : '진단 새로고침'}
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

                        <SignificancePanel data={backtestDiagnostics} description="6/45 초기하분포 기대값 0.8" digits={3} />

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
                            <MultipleComparisonNote count={ruleCount} threshold={ruleZThreshold} />
                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                {backtestDiagnostics.ruleDiagnostics.performance.map((item) => (
                                    <RulePerformanceCard
                                        key={item.ruleId}
                                        item={item}
                                        baseline={backtestDiagnostics.baseline.theoretical.expectedMatchPerSet}
                                        threshold={ruleZThreshold}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="empty-state px-4 py-10 text-center text-sm text-ink-soft">
                        {BACKTEST_EMPTY_TEXT[backtestStatus]}
                    </div>
                )}
            </SectionCard>
        </section>
    );
}
