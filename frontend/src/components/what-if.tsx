import { useEffect, useRef, useState } from 'react';
import { Eraser, History, Shuffle } from 'lucide-react';
import { ApiError, fetchLottoWhatIf } from '../api';
import { formatWon } from '../format';
import type { LottoSet, LottoWhatIfResult } from '../types';
import { Ball, getBallBand } from './Ball';
import { SectionCard } from './SectionCard';

const PICK_COUNT = 6;
const ALL_NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1);
const MATCH_LABEL: Record<number, string> = { 1: '6개', 2: '5개 + 보너스', 3: '5개', 4: '4개', 5: '3개' };

function randomPick() {
    const pool = ALL_NUMBERS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, PICK_COUNT).sort((a, b) => a - b);
}

// 숫자가 0 에서 올라가며 멈춘다. 금액이 "쌓이는" 느낌을 주려는 것이고, 움직임을
// 줄이라고 한 사용자에게는 바로 최종값을 낸다.
function useCountUp(target: number, durationMs = 700) {
    const [value, setValue] = useState(target);
    const shown = useRef(target);

    useEffect(() => {
        const from = shown.current;
        if (from === target) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            shown.current = target;
            setValue(target);
            return;
        }

        let frame = 0;
        const startedAt = performance.now();
        const step = (now: number) => {
            const progress = Math.min(1, (now - startedAt) / durationMs);
            // 끝에서 느려진다
            const eased = 1 - (1 - progress) ** 3;
            shown.current = Math.round(from + (target - from) * eased);
            setValue(shown.current);
            if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);

        return () => cancelAnimationFrame(frame);
    }, [target, durationMs]);

    return value;
}

function MoneyTile({ label, amount, note }: { label: string; amount: number; note?: string }) {
    const shown = useCountUp(amount);

    return (
        <div className="stat-tile">
            <div className="text-xs text-ink-soft">{label}</div>
            <div className="mt-1 text-lg font-extrabold tabular-nums text-ink">{formatWon(shown)}</div>
            {note && <div className="mt-0.5 text-2xs text-ink-soft">{note}</div>}
        </div>
    );
}

function WhatIfResult({ result }: { result: LottoWhatIfResult }) {
    const { drawCount, spent, won, ranks, topWins, estimatedWins, unknownWins } = result;
    const winCount = ranks.reduce((total, rank) => total + rank.count, 0);
    const returnRate = spent > 0 ? (won / spent) * 100 : 0;
    const best = topWins[0] ?? null;
    const years = Math.round(drawCount / 52);

    return (
        <div>
            <h3 className="text-xl font-extrabold tracking-[-0.03em] text-ink">
                {drawCount.toLocaleString('ko-KR')}회를 전부 샀다면
            </h3>
            <p className="mt-1 text-xs text-ink-soft">
                {result.firstDrawNo}회({result.firstDrawDate})부터 {result.latestDrawNo}회까지, 매주 한 게임씩 약 {years}년.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MoneyTile label="쓴 돈" amount={spent} />
                <MoneyTile label="받은 돈 (세전)" amount={won} note={`당첨 ${winCount}번`} />
                <div className={`stat-tile ${won >= spent ? 'bg-mint' : ''}`}>
                    <div className="text-xs text-ink-soft">돌려받은 비율</div>
                    <div className="mt-1 text-lg font-extrabold tabular-nums text-ink">{returnRate.toFixed(1)}%</div>
                    <div className="mt-0.5 text-2xs text-ink-soft">
                        {won >= spent ? `${formatWon(won - spent)} 남음` : `${formatWon(spent - won)} 손해`}
                    </div>
                </div>
            </div>

            {/* 내 번호의 횟수 옆에 무작위 번호의 기대 횟수를 둔다. 이 옆자리가 없으면
                "5등 23번" 이 많은 건지 적은 건지 알 수 없다. */}
            <div className="mt-4 border-2 border-ink">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b-2 border-ink bg-paper px-3 py-2 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-ink-soft">
                    <span>등위</span>
                    <span className="text-right">내 번호</span>
                    <span className="w-[4.5rem] text-right">무작위 기대</span>
                </div>
                {ranks.map(rank => (
                    <div
                        key={rank.rankNo}
                        className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b-2 border-ink px-3 py-2 last:border-b-0 ${rank.count > 0 ? 'bg-card' : 'bg-paper'}`}
                    >
                        <div className="min-w-0">
                            <span className={`chip ${rank.count > 0 ? 'chip-mint' : ''}`}>{rank.rankNo}등</span>
                            <span className="ml-2 text-xs text-ink-soft">{MATCH_LABEL[rank.rankNo]}</span>
                            {rank.won > 0 && <div className="mt-1 text-xs tabular-nums text-ink">{formatWon(rank.won)}</div>}
                        </div>
                        <span className={`text-right font-mono text-sm tabular-nums ${rank.count > 0 ? 'font-bold text-ink' : 'text-ink-soft'}`}>
                            {rank.count}번
                        </span>
                        <span className="w-[4.5rem] text-right font-mono text-xs tabular-nums text-ink-soft">
                            {rank.expected >= 10 ? rank.expected.toFixed(1) : rank.expected >= 0.01 ? rank.expected.toFixed(2) : rank.expected.toFixed(4)}번
                        </span>
                    </div>
                ))}
            </div>

            <p className="mt-3 text-sm text-ink">
                {best
                    ? <>가장 크게 맞은 건 <span className="font-semibold">{best.drawNo}회</span>({best.drawDate}) {best.rankNo}등, <span className="font-semibold">{formatWon(best.prize)}</span>입니다.</>
                    : '한 번도 당첨되지 않았습니다. 3개 이상 맞은 회차가 없습니다.'}
            </p>

            <p className="mt-3 text-2xs leading-relaxed text-ink-soft">
                어떤 번호를 넣어도 횟수는 무작위 기대 근처에 머뭅니다. 추첨이 균등하기 때문입니다.
                1게임은 87회까지 2,000원, 그 뒤로 1,000원으로 셌습니다. 1~3등 금액은 당첨자가 한 명
                늘었다고 보고 다시 나눈 값입니다.
                {estimatedWins > 0 && ` 당첨 ${estimatedWins}건은 지급액 기록이 없는 초기 회차라 판매액에서 역산한 추정입니다.`}
                {unknownWins > 0 && ` 당첨 ${unknownWins}건은 금액을 알 수 없어 0원으로 셌습니다.`}
            </p>
        </div>
    );
}

// "이 번호를 역대 회차에 전부 샀다면". 번호를 직접 골라 볼 수 있게 한 유일한 화면이다 —
// 생일이든 1·2·3·4·5·6 이든 넣어 보면, 무엇을 넣어도 결과가 비슷하다는 걸 직접 보게 된다.
export function LottoWhatIf({ sets }: { sets: LottoSet[] }) {
    const [selected, setSelected] = useState<number[]>([]);
    const [result, setResult] = useState<LottoWhatIfResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const full = selected.length === PICK_COUNT;
    const key = selected.join(',');

    // 여섯 개가 차면 바로 계산한다. 번호를 빠르게 바꾸면 늦게 온 옛 응답이 새 결과를
    // 덮을 수 있어, 응답이 왔을 때 아직 그 번호를 보고 있는지 확인한다.
    useEffect(() => {
        if (!full) {
            setLoading(false);
            return;
        }

        let stale = false;
        setLoading(true);
        setError('');

        fetchLottoWhatIf(selected)
            .then(data => { if (!stale) setResult(data); })
            .catch(err => {
                if (stale) return;
                setResult(null);
                setError(err instanceof ApiError && err.message ? err.message : '계산하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
            })
            .finally(() => { if (!stale) setLoading(false); });

        return () => { stale = true; };
    }, [key]);

    const toggle = (n: number) => {
        setSelected(prev => {
            if (prev.includes(n)) return prev.filter(x => x !== n);
            if (prev.length >= PICK_COUNT) return prev;
            return [...prev, n].sort((a, b) => a - b);
        });
    };

    return (
        <SectionCard title="만약에" eyebrow="역대 회차에 대입" icon={<History className="h-5 w-5" />}>
            <p className="mb-4 text-sm text-ink-soft">
                번호 여섯 개를 고르면, 그 번호로 1회부터 지금까지 매주 한 게임씩 샀을 때 어떻게 됐을지 보여 줍니다.
                생일이든 추천 번호든 넣어 보세요.
            </p>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-start">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setSelected(randomPick())} className="btn-secondary inline-flex items-center gap-1.5 px-3 text-sm">
                            <Shuffle className="h-4 w-4" />
                            무작위
                        </button>
                        <button
                            type="button"
                            onClick={() => { setSelected([]); setResult(null); setError(''); }}
                            disabled={selected.length === 0}
                            className="btn-secondary inline-flex items-center gap-1.5 px-3 text-sm"
                        >
                            <Eraser className="h-4 w-4" />
                            지우기
                        </button>
                        {sets.map((set, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setSelected(set.numbers.slice().sort((a, b) => a - b))}
                                className="btn-secondary inline-flex items-center px-3 text-sm"
                                aria-label={`추천 ${i + 1}번 세트 넣기`}
                            >
                                추천 {i + 1}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-9" role="group" aria-label="번호 고르기">
                        {ALL_NUMBERS.map(n => {
                            const on = selected.includes(n);
                            const band = getBallBand(n);
                            // 여섯 개가 찼으면 나머지는 눌러도 반응하지 않는다. disabled 로 두면
                            // 포커스 순서에서 빠져 키보드로 훑을 때 건너뛰므로 aria-disabled 만 건다.
                            const blocked = full && !on;

                            return (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => toggle(n)}
                                    aria-pressed={on}
                                    aria-disabled={blocked || undefined}
                                    aria-label={`${n}번`}
                                    className={`number-toggle ${on ? 'is-on' : ''} ${blocked ? 'is-blocked' : ''}`}
                                    style={on ? { background: band.bg, color: band.fg } : undefined}
                                >
                                    {n}
                                </button>
                            );
                        })}
                    </div>

                    <p className="mt-3 text-xs text-ink-soft" role="status">
                        {full
                            ? '여섯 개를 모두 골랐습니다. 바꾸려면 고른 번호를 다시 누르세요.'
                            : `${selected.length}/${PICK_COUNT}개 골랐습니다. 여섯 개가 차면 바로 계산합니다.`}
                    </p>
                </div>

                <div aria-live="polite" aria-busy={loading}>
                    {error ? (
                        <p className="border-2 border-ink bg-coral px-3 py-2 text-sm font-medium">{error}</p>
                    ) : result && full ? (
                        <div className={loading ? 'opacity-50' : ''}>
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                {result.numbers.map((n, i) => <Ball key={n} num={n} size="sm" delay={i * 15} />)}
                            </div>
                            <WhatIfResult result={result} />
                        </div>
                    ) : (
                        <div className="empty-state px-4 py-10 text-center text-sm text-ink-soft">
                            {loading ? '역대 회차에 대입하고 있습니다...' : '번호 여섯 개를 고르면 결과가 여기에 나옵니다.'}
                        </div>
                    )}
                </div>
            </div>
        </SectionCard>
    );
}
