import { Trash2 } from 'lucide-react';
import { Ball } from './Ball';
import { PENSION_DIGIT_COLORS } from '../constants';
import { PensionDigitBall } from './pension';
import type { PageLottery, SavedPick } from '../types';
import type { SavedPicksState } from '../hooks/useSavedPicks';

// 등위 이름. 연금 8 은 보너스 등위다 (추천은 조를 고르지 않아 1등은 판정하지 않는다).
function rankLabel(lottery: PageLottery, rankNo: number | null) {
    if (rankNo == null) return '낙첨';
    if (lottery === 'pension' && rankNo === 8) return '보너스 당첨';
    return `${rankNo}등`;
}

function ResultChip({ lottery, pick }: { lottery: PageLottery; pick: SavedPick }) {
    if (!pick.result) return <span className="chip">추첨 전</span>;

    const { matchedCount, rankNo, bonusMatched } = pick.result;
    const detail = lottery === 'lotto'
        ? `${matchedCount}개 일치${bonusMatched ? ' + 보너스' : ''}`
        : `끝 ${matchedCount}자리`;

    return (
        <span className={`chip ${rankNo == null ? '' : 'chip-mint'}`}>
            {detail} · {rankLabel(lottery, rankNo)}
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

function PickRow({ lottery, pick, onRemove }: { lottery: PageLottery; pick: SavedPick; onRemove: (id: string) => void }) {
    return (
        <div className="flex flex-col gap-3 border-2 border-ink bg-card px-4 py-4 lg:grid lg:grid-cols-[88px_1fr_auto_44px] lg:items-center">
            <div>
                <div className="text-sm font-semibold text-ink">{pick.drawNo}회</div>
                {pick.label && <div className="mt-1 text-xs text-ink-soft">{pick.label}</div>}
            </div>

            <PickNumbers lottery={lottery} numbers={pick.numbers} />

            <div className="lg:text-right">
                <ResultChip lottery={lottery} pick={pick} />
            </div>

            <button
                type="button"
                onClick={() => onRemove(pick.id)}
                aria-label={`${pick.drawNo}회 저장 번호 삭제`}
                className="btn-icon shrink-0 lg:justify-self-end"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
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

            <section>
                <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-ink">대기 중 {pending.length}건</h3>
                <div className="mt-2 grid gap-2">
                    {pending.length > 0
                        ? pending.map(p => <PickRow key={p.id} lottery={lottery} pick={p} onRemove={remove} />)
                        : <p className="text-sm text-ink-soft">추첨을 기다리는 번호가 없습니다.</p>}
                </div>
            </section>

            <section>
                <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-ink">지난 결과 {done.length}건</h3>
                <div className="mt-2 grid gap-2">
                    {done.length > 0
                        ? done.map(p => <PickRow key={p.id} lottery={lottery} pick={p} onRemove={remove} />)
                        : <p className="text-sm text-ink-soft">아직 채점된 번호가 없습니다.</p>}
                </div>
            </section>
        </div>
    );
}
