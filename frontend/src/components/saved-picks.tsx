import { Trash2 } from 'lucide-react';
import { Ball } from './Ball';
import { PENSION_DIGIT_COLORS } from '../constants';
import { PensionDigitBall } from './pension';
import type { PageLottery, SavedPick } from '../types';
import type { SavedPicksState } from '../hooks/useSavedPicks';

// 연금복권720+ 는 조(1~5) + 6자리다. 같은 6자리가 다섯 조에 모두 있어서
// 1등은 조까지 맞아야 하고, 나머지 네 조는 2등이 된다.
// (동행복권 pt720/intro: "1등 당첨번호 2조 123456 일때 2등은 1조·3조·4조·5조 123456")
const PENSION_BANDS = ['1', '2', '3', '4', '5'];
const PENSION_DIGIT_COUNT = 6;

// 등위 이름. 연금 8 은 보너스 등위다.
function rankLabel(lottery: PageLottery, rankNo: number | null) {
    if (rankNo == null) return '낙첨';
    if (lottery === 'pension' && rankNo === 8) return '보너스 당첨';
    return `${rankNo}등`;
}

// 채점된 줄에만 붙는다. 추첨 전이라는 말은 묶음 머리글(GroupSummary)이 맡는다.
function ResultChip({ lottery, pick }: { lottery: PageLottery; pick: SavedPick }) {
    if (!pick.result) return null;

    const { matchedCount, rankNo, bonusMatched } = pick.result;
    const detail = lottery === 'lotto'
        ? `${matchedCount}개 일치${bonusMatched ? ' + 보너스' : ''}`
        : `끝 ${matchedCount}자리`;

    // 연금은 6자리가 맞으면 조에 따라 1등과 2등이 갈린다. 저장분은 번호만 담으므로
    // 어느 쪽이라고 단정할 수 없다 — 조별 등위는 아래 다섯 줄이 보여준다.
    const bandSplit = lottery === 'pension' && matchedCount === PENSION_DIGIT_COUNT;

    return (
        <span className={`chip ${rankNo == null ? '' : bandSplit ? 'chip-lemon' : 'chip-mint'}`}>
            {detail} · {bandSplit ? '조에 따라 1·2등' : rankLabel(lottery, rankNo)}
        </span>
    );
}

function PickNumbers({ lottery, numbers }: { lottery: PageLottery; numbers: string }) {
    if (lottery === 'lotto') {
        return (
            <div className="flex flex-wrap items-center gap-2">
                {numbers.split(',').map((n, i) => <Ball key={i} num={Number(n)} size="sm" delay={i * 15} />)}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5">
            <span className="shrink-0 pr-0.5 text-sm font-medium text-ink-soft">각조</span>
            {numbers.split('').map((d, i) => <PensionDigitBall key={i} value={d} color={PENSION_DIGIT_COLORS[i]} compact />)}
        </div>
    );
}

// 저장한 6자리를 조마다 한 줄씩 펼친다. 전 조를 사면 번호가 맞았을 때
// 1등 1매 + 2등 4매가 함께 나오므로, 어느 조가 1등인지 보이는 편이 낫다.
function PensionBandRows({ pick }: { pick: SavedPick }) {
    const result = pick.result;
    const digitsHit = result != null && result.matchedCount === 6;
    const winningBand = result?.winningBand ?? null;

    return (
        <div className="mt-3 grid gap-1.5">
            {PENSION_BANDS.map(band => {
                // 번호가 맞았을 때만 조가 등위를 가른다. 그 전에는 다섯 줄이 모두 같은 번호다.
                const isFirst = digitsHit && winningBand === band;
                const rank = !digitsHit ? null : winningBand == null ? null : isFirst ? 1 : 2;

                return (
                    <div
                        key={band}
                        // 360px 에서 조 라벨 + 숫자 6개 + 등위 칩이 한 줄에 들어가지 않는다.
                        // 칩을 다음 줄로 흘려보낸다 (숫자 줄은 그대로 유지된다).
                        className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-2 border-ink px-2 py-2 ${isFirst ? 'bg-lemon' : 'bg-paper'}`}
                    >
                        <div className="flex items-center gap-1">
                            <span className="shrink-0 pr-0.5 font-mono text-2xs font-bold text-ink">{band}조</span>
                            {pick.numbers.split('').map((d, i) => (
                                <PensionDigitBall key={i} value={d} color={PENSION_DIGIT_COLORS[i]} compact />
                            ))}
                        </div>
                        {rank != null && (
                            <span className={`chip shrink-0 ${rank === 1 ? 'chip-lemon' : 'chip-mint'}`}>{rank}등</span>
                        )}
                    </div>
                );
            })}
            <p className="mt-1 text-2xs leading-relaxed text-ink-soft">
                {digitsHit && winningBand != null
                    ? `${winningBand}조 추첨. 다섯 조를 모두 샀다면 1등 1매 + 2등 4매입니다.`
                    : '같은 번호가 다섯 조에 모두 있습니다. 전 조(5,000원)를 사면 번호가 맞았을 때 1등을 반드시 받습니다.'}
            </p>
        </div>
    );
}

// 회차 머리글은 그 회차의 가장 좋은 결과를 요약한다. 등위는 숫자가 작을수록 좋고,
// 연금의 8 은 보너스 등위라 가장 뒤다 — 그대로 최솟값을 고르면 된다.
function bestRank(picks: SavedPick[]) {
    const ranks = picks.map(p => p.result?.rankNo).filter((r): r is number => r != null);
    return ranks.length > 0 ? Math.min(...ranks) : null;
}

function GroupSummary({ lottery, picks }: { lottery: PageLottery; picks: SavedPick[] }) {
    const graded = picks.filter(p => p.result != null);
    if (graded.length === 0) return <span className="chip">추첨 전</span>;

    const best = bestRank(graded);
    if (best == null) return <span className="chip">낙첨</span>;

    // 연금은 6자리가 맞아도 조에 따라 1·2등이 갈린다. 저장분만으로는 단정할 수 없다.
    const bandSplit = lottery === 'pension'
        && graded.some(p => p.result?.rankNo === best && p.result.matchedCount === PENSION_DIGIT_COUNT);

    return (
        <span className={`chip ${bandSplit ? 'chip-lemon' : 'chip-mint'}`}>
            {bandSplit ? '조에 따라 1·2등' : `최고 ${rankLabel(lottery, best)}`}
        </span>
    );
}

function PickRow({ lottery, pick, onRemove }: { lottery: PageLottery; pick: SavedPick; onRemove: (id: string) => void }) {
    // 회차는 묶음 머리글이 이미 말한다. 여기서는 어떤 전략으로 뽑은 세트인지를 낸다.
    const label = pick.label ?? '저장 번호';

    const removeButton = (
        <button
            type="button"
            onClick={() => onRemove(pick.id)}
            aria-label={`${pick.drawNo}회 ${label} 삭제`}
            className="btn-icon order-2 ml-auto shrink-0 lg:order-4 lg:ml-0"
        >
            <Trash2 className="h-4 w-4" />
        </button>
    );

    // 연금은 같은 번호를 다섯 조로 펼쳐 보여주므로 번호를 한 줄에 끼워 넣지 않는다
    if (lottery === 'pension') {
        return (
            <div className="border-2 border-ink bg-card px-4 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="text-sm font-semibold text-ink">{label}</div>
                    {removeButton}
                    {pick.result != null && (
                        <div className="order-3 w-full lg:order-1 lg:ml-auto lg:w-auto">
                            <ResultChip lottery={lottery} pick={pick} />
                        </div>
                    )}
                </div>
                <PensionBandRows pick={pick} />
            </div>
        );
    }

    // 좁은 화면에서는 전략 이름과 삭제 버튼이 한 줄을 함께 쓰고, 번호와 결과가 아래로 쌓인다.
    // 넓은 화면에서는 order 로 되돌려 전략·번호·결과·삭제 순서의 한 줄이 된다.
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-2 border-ink bg-card px-4 py-4 lg:flex-nowrap">
            <div className="order-1 text-sm font-semibold text-ink lg:w-[140px] lg:shrink-0">{label}</div>
            {removeButton}
            <div className="order-3 w-full lg:order-2 lg:w-auto lg:flex-1">
                <PickNumbers lottery={lottery} numbers={pick.numbers} />
            </div>
            {pick.result != null && (
                <div className="order-4 w-full lg:order-3 lg:w-auto lg:text-right">
                    <ResultChip lottery={lottery} pick={pick} />
                </div>
            )}
        </div>
    );
}

// 로또는 한 번에 다섯 세트가 저장된다. 회차로 묶지 않으면 같은 "1246회" 머리가 다섯 번
// 반복되고, 그 주에 어떻게 됐는지는 다섯 줄을 눈으로 훑어야 알 수 있다.
function DrawGroup({ lottery, drawNo, picks, onRemove }: {
    lottery: PageLottery;
    drawNo: number;
    picks: SavedPick[];
    onRemove: (id: string) => void;
}) {
    return (
        <div className="border-2 border-ink bg-paper">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b-2 border-ink px-3 py-2">
                <span className="font-mono text-sm font-bold text-ink">{drawNo}회</span>
                {picks.length > 1 && <span className="text-xs text-ink-soft">{picks.length}세트</span>}
                <span className="ml-auto"><GroupSummary lottery={lottery} picks={picks} /></span>
            </div>
            <div className="grid gap-2 p-2 sm:p-3">
                {picks.map(p => <PickRow key={p.id} lottery={lottery} pick={p} onRemove={onRemove} />)}
            </div>
        </div>
    );
}

// 회차 내림차순. picks 는 서버가 이미 그 순서로 주지만, 묶음 순서를 거기에 기대지 않는다.
function groupByDraw(picks: SavedPick[]) {
    const groups = new Map<number, SavedPick[]>();
    for (const pick of picks) {
        const bucket = groups.get(pick.drawNo);
        if (bucket) bucket.push(pick);
        else groups.set(pick.drawNo, [pick]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

function PickSection({ lottery, title, picks, emptyText, onRemove }: {
    lottery: PageLottery;
    title: string;
    picks: SavedPick[];
    emptyText: string;
    onRemove: (id: string) => void;
}) {
    return (
        <section>
            <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-ink">{title} {picks.length}건</h3>
            <div className="mt-2 grid gap-3">
                {picks.length > 0
                    ? groupByDraw(picks).map(([drawNo, group]) => (
                        <DrawGroup key={drawNo} lottery={lottery} drawNo={drawNo} picks={group} onRemove={onRemove} />
                    ))
                    : <p className="text-sm text-ink-soft">{emptyText}</p>}
            </div>
        </section>
    );
}

export function SavedPicksList({ lottery, state }: { lottery: PageLottery; state: SavedPicksState }) {
    const { picks, loading, error, remove } = state;

    // 추첨 전과 지난 결과를 나눈다. 둘 다 회차 내림차순이다.
    const pending = picks.filter(p => p.result == null);
    const done = picks.filter(p => p.result != null);

    if (loading && picks.length === 0) {
        return <div className="panel px-4 py-8 text-sm text-ink-soft">저장한 번호를 불러오는 중입니다...</div>;
    }

    if (picks.length === 0) {
        return (
            <div className="empty-state px-4 py-10 text-center">
                {error
                    ? <p className="text-sm font-medium text-ink">{error}</p>
                    : <p className="text-sm text-ink-soft">추천 탭에서 번호를 저장하면 여기에 모입니다. 추첨 후 자동으로 채점됩니다.</p>}
            </div>
        );
    }

    return (
        <div className="grid gap-5">
            {error && <p className="border-2 border-ink bg-coral px-3 py-2 text-sm font-medium">{error}</p>}

            <PickSection
                lottery={lottery}
                title="대기 중"
                picks={pending}
                emptyText="추첨을 기다리는 번호가 없습니다."
                onRemove={remove}
            />

            <PickSection
                lottery={lottery}
                title="지난 결과"
                picks={done}
                emptyText="아직 채점된 번호가 없습니다."
                onRemove={remove}
            />
        </div>
    );
}
