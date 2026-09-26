import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Info, Search, Sparkles, Waves } from 'lucide-react';
import { Ball, BonusBadge } from '../components/Ball';
import { LottoHonestyPanel } from '../components/diagnostics';
import { DrawResultCard, RecommendationCard } from '../components/lotto';
import { SectionCard } from '../components/SectionCard';
import { formatMoneyKRW } from '../format';
import type { BacktestStatus } from '../hooks/useBacktest';
import { lottoBrowserApi, useDrawBrowser, WINDOW_SIZE } from '../hooks/useDrawBrowser';
import type { LottoState } from '../hooks/useLotto';
import type { TabKey } from '../routing';


const BACKTEST_EMPTY_TEXT: Record<BacktestStatus, string> = {
    idle: '백테스트 진단을 준비하고 있습니다.',
    loading: '백테스트 진단을 계산하고 있습니다.',
    failed: '백테스트 진단 데이터를 불러오지 못했습니다.',
    done: '백테스트 진단 데이터가 없습니다.',
};

export function LottoPage({ lotto, tab }: { lotto: LottoState; tab: TabKey }) {
    if (tab === 'picks') return <LottoPicksTab lotto={lotto} />;
    return <LottoResultsTab />;
}

function LottoResultsTab() {
    const {
        selectedDraw, windowRows, loading, windowError,
        latestDrawNo, selected, canGoOlder, canGoNewer, select, shiftWindow,
        searchInput, searchError, changeSearchInput, search,
    } = useDrawBrowser(lottoBrowserApi);

    const viewerRef = useRef<HTMLDivElement>(null);

    // 목록에서 회차를 고르면 뷰어가 화면 밖일 수 있다. 뷰어로 올려준다.
    const selectAndReveal = (drwNo: number) => {
        select(drwNo);
        viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const oldest = windowRows.length > 0 ? windowRows[windowRows.length - 1].drwNo : null;

    return (
        <>
            <section ref={viewerRef}>
                {loading ? (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">데이터를 불러오는 중입니다...</div>
                ) : selectedDraw ? (
                    <DrawResultCard
                        draw={selectedDraw}
                        chipLabel={selectedDraw.drwNo === latestDrawNo ? `최신 ${selectedDraw.drwNo}회` : `${selectedDraw.drwNo}회`}
                        variant="latest"
                        statusText={
                            selectedDraw.drwNo === latestDrawNo
                                ? '최신 회차입니다. 당첨 결과는 매주 자동으로 갱신됩니다.'
                                : `최신은 ${latestDrawNo}회입니다.`
                        }
                        onOlder={() => select((selected ?? 0) - 1)}
                        onNewer={() => select((selected ?? 0) + 1)}
                        canGoOlder={canGoOlder}
                        canGoNewer={canGoNewer}
                    />
                ) : (
                    <div className="panel px-4 py-8 text-sm text-ink-soft">
                        {windowError || '아직 당첨 결과가 없습니다. 당첨 결과는 매주 자동으로 갱신됩니다.'}
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
                                        key={draw.drwNo}
                                        onClick={() => selectAndReveal(draw.drwNo)}
                                        aria-current={draw.drwNo === selected ? 'true' : undefined}
                                        className={`history-row px-4 py-4 ${draw.drwNo === selected ? 'is-selected' : ''}`}
                                    >
                                        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[104px_1fr_96px] lg:items-center">
                                            <div>
                                                <div className="text-sm font-semibold text-ink">
                                                    {draw.drwNo}회
                                                    {draw.drwNo === selected && <span className="ml-2 font-mono text-[10px] font-bold uppercase">보는 중</span>}
                                                </div>
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
                                                <div className="chip">{formatMoneyKRW(draw.firstWinamnt)}</div>
                                            </div>
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
    const {
        sets,
        generateError,
        generating: loading,
        generate: generateNumbers,
        backtest,
        ensureBacktest,
    } = lotto;

    // 하단 고지 패널에 쓸 백테스트는 추천 탭에 들어올 때만 불러온다
    useEffect(() => {
        ensureBacktest();
    }, []);

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

            {backtest && <LottoHonestyPanel data={backtest} />}
        </section>
    );
}
