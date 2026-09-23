import { useEffect } from 'react';
import { ChevronRight, Info, Search, Sparkles } from 'lucide-react';
import { PensionRulePerformanceCard, RuleWeightCard } from '../components/diagnostics';
import { FeaturedPensionRecommendationCard, PensionRecommendationCard, PensionResultCard } from '../components/pension';
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
        latestDraw: latestPensionDraw,
        loading: pensionLoading,
        error: pensionError,
        generateLoading: pensionGenerateLoading,
        generateError: pensionGenerateError,
        searchInput: pensionSearchInput,
        recommendations: pensionRecommendations,
        ruleWeights: pensionRuleWeights,
        backtest: pensionBacktestDiagnostics,
        backtestStatus: pensionBacktestStatus,
        searchResult: pensionSearchResult,
        searchError: pensionSearchError,
        generate: onPensionGenerate,
        loadBacktest: onPensionBacktestRefresh,
        ensureBacktest,
        changeSearchInput: onPensionSearchInputChange,
        search: onPensionSearch,
    } = pension;

    // 백테스트는 진단 탭에 처음 들어갈 때만 불러온다
    useEffect(() => {
        if (tab === 'backtest') ensureBacktest();
    }, [tab]);

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

                <p className="mb-3 text-right text-xs font-medium text-ink-soft sm:text-sm">당첨 결과는 매주 자동으로 갱신됩니다.</p>
                {pensionLoading ? (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">연금복권 데이터를 불러오는 중입니다...</div>
                ) : pensionError ? (
                    <div className="panel bg-coral px-4 py-8 text-sm">{pensionError}</div>
                ) : latestPensionDraw ? (
                    <PensionResultCard draw={latestPensionDraw} />
                ) : (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">아직 연금복권 당첨 결과가 없습니다. 당첨 결과는 매주 자동으로 갱신됩니다.</div>
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
                                    <RuleWeightCard key={`pension-${item.ruleId}`} item={item} index={index} />
                                ))}
                            </div>
                        </div>
                    )}

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
                            disabled={pensionBacktestStatus === 'loading'}
                            className="btn-secondary inline-flex h-10 items-center justify-center px-4 text-sm"
                        >
                            {pensionBacktestStatus === 'loading' ? '분석 중...' : '진단 새로고침'}
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
                                        <RuleWeightCard key={`pension-backtest-${item.ruleId}`} item={item} index={index} />
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
                            {BACKTEST_EMPTY_TEXT[pensionBacktestStatus]}
                        </div>
                    )}
                </SectionCard>
            </section>
            )}
        </div>
    );
}
