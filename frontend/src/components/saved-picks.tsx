import { Trash2, Undo2 } from 'lucide-react';
import { Ball, BonusBadge } from './Ball';
import { PENSION_BAND_COLOR, PENSION_DIGIT_COLORS } from '../constants';
import { describeDaysUntil, daysUntil, formatDrawDate } from '../format';
import { PensionDigitBall } from './pension';
import type { PageLottery, SavedPick } from '../types';
import type { SavedPicksState } from '../hooks/useSavedPicks';

// 연금복권720+ 는 조(1~5) + 6자리다. 같은 6자리가 다섯 조에 모두 있어서
// 1등은 조까지 맞아야 하고, 나머지 네 조는 2등이 된다.
// (동행복권 pt720/intro: "1등 당첨번호 2조 123456 일때 2등은 1조·3조·4조·5조 123456")
const PENSION_BANDS = ['1', '2', '3', '4', '5'];
const PENSION_DIGIT_COUNT = 6;
// 연금 보너스 등위. 보너스 번호와 6자리가 모두 맞은 경우다.
const PENSION_BONUS_RANK = 8;

type Winning = NonNullable<NonNullable<SavedPick['result']>['winning']>;

// 등위 이름. 연금 8 은 보너스 등위다.
function rankLabel(lottery: PageLottery, rankNo: number | null) {
    if (rankNo == null) return '낙첨';
    if (lottery === 'pension' && rankNo === PENSION_BONUS_RANK) return '보너스 당첨';
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

// 로또 한 세트. 채점됐고 당첨번호를 알면 맞은 공만 또렷이 두고 나머지를 흐린다 —
// "3개 일치" 만으로는 어느 셋인지 알 수 없다. 보너스 번호에 걸린 공에는 B 를 단다.
// (흐림은 공을 감싼 칸에 건다. 공 자체는 등장 애니메이션이 opacity 를 쥐고 있다.)
function LottoPickNumbers({ numbers, winning }: { numbers: string; winning: Winning | null }) {
    const hits = winning ? new Set(winning.numbers.split(',').map(Number)) : null;
    const bonus = winning?.bonus != null ? Number(winning.bonus) : null;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {numbers.split(',').map((raw, i) => {
                const n = Number(raw);
                const isHit = hits?.has(n) ?? false;
                const isBonus = bonus === n;

                return (
                    <span key={i} className={`relative ${hits && !isHit && !isBonus ? 'pick-miss' : ''}`}>
                        <Ball num={n} size="sm" delay={i * 15} />
                        {isBonus && <BonusBadge compact />}
                        {isHit && <span className="sr-only">맞음</span>}
                        {isBonus && <span className="sr-only">보너스 번호</span>}
                    </span>
                );
            })}
        </div>
    );
}

// 연금은 끝자리부터 이어서 맞은 자리만 당첨에 든다. 보너스 등위는 6자리가 모두 맞은 것이다.
function pensionHitCount(pick: SavedPick) {
    if (!pick.result) return null;
    return pick.result.rankNo === PENSION_BONUS_RANK ? PENSION_DIGIT_COUNT : pick.result.matchedCount;
}

// 저장한 6자리를 조마다 한 줄씩 펼친다. 전 조를 사면 번호가 맞았을 때
// 1등 1매 + 2등 4매가 함께 나오므로, 어느 조가 1등인지 보이는 편이 낫다.
function PensionBandRows({ pick }: { pick: SavedPick }) {
    const result = pick.result;
    const digitsHit = result != null && result.matchedCount === PENSION_DIGIT_COUNT;
    const winningBand = result?.winningBand ?? null;
    // 채점됐으면 맞은 끝자리만 또렷이 둔다
    const hitCount = pensionHitCount(pick);
    const firstHitIndex = hitCount == null ? 0 : PENSION_DIGIT_COUNT - hitCount;

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
                                <span key={i} className={i < firstHitIndex ? 'pick-miss' : ''}>
                                    <PensionDigitBall value={d} color={PENSION_DIGIT_COLORS[i]} compact />
                                </span>
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

// 그 회차의 당첨번호. 저장한 번호와 눈으로 맞대어 볼 수 있게 묶음 머리글 아래에 둔다.
function WinningNumbers({ lottery, winning, band }: { lottery: PageLottery; winning: Winning; band: string | null }) {
    if (lottery === 'lotto') {
        return (
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                {winning.numbers.split(',').map((n, i) => <Ball key={i} num={Number(n)} size="xs" />)}
                {/* "+" 와 보너스 공은 한 덩어리로 줄바꿈한다. 따로 두면 "+" 만 줄 끝에 남는다. */}
                {winning.bonus != null && (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5">
                        <span className="text-sm font-semibold text-ink-soft">+</span>
                        <span className="relative">
                            <Ball num={Number(winning.bonus)} size="xs" />
                            <BonusBadge compact />
                        </span>
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-1">
                {band != null && (
                    <>
                        <PensionDigitBall value={band} color={PENSION_BAND_COLOR} compact />
                        <span className="pr-0.5 text-xs font-medium text-ink-soft">조</span>
                    </>
                )}
                {winning.numbers.split('').map((d, i) => (
                    <PensionDigitBall key={i} value={d} color={PENSION_DIGIT_COLORS[i]} compact />
                ))}
            </div>
            {winning.bonus != null && (
                <span className="font-mono text-xs font-medium text-ink-soft">보너스 각조 {winning.bonus}</span>
            )}
        </div>
    );
}

function PickRow({ lottery, pick, removing, onRemove, onUndo }: {
    lottery: PageLottery;
    pick: SavedPick;
    removing: boolean;
    onRemove: (id: string) => void;
    onUndo: (id: string) => void;
}) {
    // 회차는 묶음 머리글이 이미 말한다. 여기서는 어떤 전략으로 뽑은 세트인지를 낸다.
    const label = pick.label ?? '저장 번호';
    // 연금은 같은 번호를 다섯 조로 펼쳐 보여주므로 번호를 머리 줄에 끼워 넣지 않는다
    const isPension = lottery === 'pension';
    const hasResult = pick.result != null;
    // 삭제를 누른 줄은 되돌릴 시간 동안 흐려진 채 제자리에 남는다. 줄이 바로 사라지면
    // 아래 줄들이 올라와 방금 뭘 지웠는지 알 수 없고, 되돌릴 버튼이 손에서 멀어진다.
    const fade = removing ? 'opacity-40' : '';

    // 배치는 index.css 의 .pick-row 가 칸 이름으로 정한다. DOM 은 넓은 화면의 순서
    // (전략·번호·결과·삭제) 그대로라 포커스·낭독 순서가 보이는 순서와 어긋나지 않는다.
    return (
        <div className={`border-2 border-ink px-4 py-4 ${removing ? 'border-dashed bg-paper' : 'bg-card'}`}>
            <div className={`pick-row gap-x-3 ${isPension ? 'gap-y-2' : 'has-numbers gap-y-3'} ${hasResult ? 'has-result' : ''}`}>
                <div className="pick-row-label text-sm font-semibold text-ink">
                    <span className={removing ? 'text-ink-soft line-through' : ''}>{label}</span>
                    {removing && <span className="ml-2 font-mono text-2xs font-bold text-ink">삭제됨</span>}
                </div>
                {!isPension && (
                    <div className={`pick-row-numbers ${fade}`}>
                        <LottoPickNumbers numbers={pick.numbers} winning={pick.result?.winning ?? null} />
                    </div>
                )}
                {hasResult && (
                    <div className={`pick-row-result ${fade}`}>
                        <ResultChip lottery={lottery} pick={pick} />
                    </div>
                )}
                {/* 두 버튼은 같은 자리의 같은 <button> 이라 바뀌어도 포커스가 남는다 */}
                {removing ? (
                    <button
                        type="button"
                        onClick={() => onUndo(pick.id)}
                        aria-label={`${pick.drawNo}회 ${label} 삭제 취소`}
                        className="btn-secondary pick-row-remove inline-flex items-center gap-1.5 px-3 text-sm"
                    >
                        <Undo2 className="h-4 w-4" />
                        실행 취소
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => onRemove(pick.id)}
                        aria-label={`${pick.drawNo}회 ${label} 삭제`}
                        className="btn-icon pick-row-remove"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
            {isPension && <div className={fade}><PensionBandRows pick={pick} /></div>}
        </div>
    );
}

// 로또는 한 번에 다섯 세트가 저장된다. 회차로 묶지 않으면 같은 "1246회" 머리가 다섯 번
// 반복되고, 그 주에 어떻게 됐는지는 다섯 줄을 눈으로 훑어야 알 수 있다.
function DrawGroup({ lottery, drawNo, picks, state }: {
    lottery: PageLottery;
    drawNo: number;
    picks: SavedPick[];
    state: SavedPicksState;
}) {
    // 세트 수와 요약은 지우는 중인 줄을 빼고 센다
    const kept = picks.filter(p => !state.removingIds.has(p.id));
    const graded = picks.find(p => p.result != null)?.result ?? null;
    const drawDate = picks.find(p => p.drawDate != null)?.drawDate ?? null;
    const dateText = formatDrawDate(drawDate);
    // 추첨 전이면 며칠 남았는지도 같이 말한다
    const whenText = graded ? dateText : [dateText, describeDaysUntil(daysUntil(drawDate))].filter(Boolean).join(' · ');

    return (
        <div className="border-2 border-ink bg-paper">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b-2 border-ink px-3 py-2">
                <span className="font-mono text-sm font-bold text-ink">{drawNo}회</span>
                {whenText && <span className="text-xs text-ink-soft">{whenText}</span>}
                {kept.length > 1 && <span className="text-xs text-ink-soft">{kept.length}세트</span>}
                {kept.length > 0 && <span className="ml-auto"><GroupSummary lottery={lottery} picks={kept} /></span>}
            </div>
            {graded?.winning && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b-2 border-ink px-3 py-2.5">
                    <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-ink-soft">당첨번호</span>
                    <WinningNumbers lottery={lottery} winning={graded.winning} band={graded.winningBand} />
                </div>
            )}
            <div className="grid gap-2 p-2 sm:p-3">
                {picks.map(p => (
                    <PickRow
                        key={p.id}
                        lottery={lottery}
                        pick={p}
                        removing={state.removingIds.has(p.id)}
                        onRemove={state.remove}
                        onUndo={state.undoRemove}
                    />
                ))}
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

function PickSection({ lottery, title, picks, emptyText, state }: {
    lottery: PageLottery;
    title: string;
    picks: SavedPick[];
    emptyText: string;
    state: SavedPicksState;
}) {
    const keptCount = picks.filter(p => !state.removingIds.has(p.id)).length;

    return (
        <section>
            <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-ink">{title} {keptCount}건</h3>
            <div className="mt-2 grid gap-3">
                {picks.length > 0
                    ? groupByDraw(picks).map(([drawNo, group]) => (
                        <DrawGroup key={drawNo} lottery={lottery} drawNo={drawNo} picks={group} state={state} />
                    ))
                    : <p className="text-sm text-ink-soft">{emptyText}</p>}
            </div>
        </section>
    );
}

export function SavedPicksList({ lottery, state }: { lottery: PageLottery; state: SavedPicksState }) {
    const { picks, loading, error, removingIds } = state;

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

            {/* 줄이 "삭제됨" 으로 바뀐 것을 화면을 보지 않는 사람에게도 알린다 */}
            <p role="status" className="sr-only">
                {removingIds.size > 0 ? `${removingIds.size}건을 삭제했습니다. 잠시 동안 실행 취소할 수 있습니다.` : ''}
            </p>

            <PickSection
                lottery={lottery}
                title="대기 중"
                picks={pending}
                emptyText="추첨을 기다리는 번호가 없습니다."
                state={state}
            />

            <PickSection
                lottery={lottery}
                title="지난 결과"
                picks={done}
                emptyText="아직 채점된 번호가 없습니다."
                state={state}
            />
        </div>
    );
}
