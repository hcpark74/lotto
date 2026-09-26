import { useEffect } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { PensionHonestyPanel } from '../components/diagnostics';
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

    // 하단 고지 패널에 쓸 백테스트는 추천 탭에 들어올 때만 불러온다
    useEffect(() => {
        if (tab === 'picks') ensureBacktest();
    }, [tab]);

    const featuredRecommendation = pensionRecommendations[0] ?? null;

    return (
        <div className="space-y-6 lg:space-y-8">
            {tab === 'results' && (
            <>
            <section>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2 sm:mb-5">
                    <div>
                        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">연금복권720+</p>
                        <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-ink sm:text-3xl">회차별 당첨번호</h2>
                    </div>
                    <p className="text-xs font-medium text-ink-soft sm:text-sm">당첨 결과는 매주 자동으로 갱신됩니다.</p>
                </div>
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
