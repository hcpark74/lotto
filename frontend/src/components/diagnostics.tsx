import type { ReactNode } from 'react';
import type { LottoBacktestDiagnostics, PensionBacktestDiagnostics } from '../types';

// 값이 "랜덤"과 "도달 가능한 상한" 사이 어디쯤인지 보여주는 자.
// 두 끝의 차이가 6% 남짓이라 0 부터 그리면 눈금이 붙어버린다. 구간만 확대해 그린다.
function RangeMeter({ value, low, high, format }: { value: number; low: number; high: number; format: (v: number) => string }) {
    const span = high - low;
    const clamped = span > 0 ? Math.min(Math.max((value - low) / span, 0), 1) : 0;

    return (
        <div className="grid gap-1">
            <div className="meter">
                <div className="meter-fill" style={{ width: `${Math.max(clamped * 100, 2)}%` }} />
            </div>
            <div className="flex justify-between font-mono text-2xs text-ink-soft">
                <span>랜덤 {format(low)}</span>
                <span>상한 {format(high)}</span>
            </div>
        </div>
    );
}

// 오를 수 없는 값 전용. 기준선을 한가운데(50%)에 두고 막대가 거기 머무는 걸 보여준다.
function BaselineMeter({ value, baseline }: { value: number; baseline: number }) {
    const width = Math.min((value / (baseline * 2)) * 100, 100);

    return (
        <div className="meter">
            <div className="meter-fill" style={{ width: `${Math.max(width, 2)}%` }} />
            <div className="meter-baseline" style={{ left: '50%' }} />
        </div>
    );
}

function Row({ label, value, note, children }: { label: string; value: string; note: string; children?: ReactNode }) {
    return (
        <div className="grid gap-1.5 border-2 border-ink bg-card px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-ink">{label}</span>
                <span className="font-mono text-lg font-bold text-ink">{value}</span>
            </div>
            {children}
            <p className="text-2xs leading-4 text-ink-soft sm:text-xs">{note}</p>
        </div>
    );
}

function PanelHead({ draws, note }: { draws: number; note: string }) {
    return (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-ink">이 추천이 실제로 하는 일</p>
                <h3 className="mt-1 text-lg font-extrabold text-ink">최근 {draws}회 백테스트</h3>
            </div>
            <p className="text-xs text-ink-soft sm:text-sm">{note}</p>
        </div>
    );
}

// 추천 탭 하단 고지. 올릴 수 있는 값과 올릴 수 없는 값을 나눠 보여준다.
// 기준선과의 차이가 우연 범위인지 한 줄로 알려준다. |z| < 1.96 이면 노이즈다.
function verdictOf(zScore: number) {
    const sign = zScore > 0 ? '+' : '';
    return Math.abs(zScore) >= 1.96
        ? `z ${sign}${zScore.toFixed(2)} · 랜덤과 다름`
        : `z ${sign}${zScore.toFixed(2)} · 랜덤 범위(우연)`;
}

export function LottoHonestyPanel({ data }: { data: LottoBacktestDiagnostics }) {
    const { coverage, drawHitRate, baseline } = data;
    const { randomControl, disjointControl, theoretical, overall } = baseline;

    return (
        <div className="mt-5 border-2 border-ink bg-paper p-4 sm:p-5 lg:mt-6">
            <PanelHead draws={data.evaluatedDraws} note="같은 회차를 순수 랜덤 5세트와 나란히 채점한 결과입니다." />

            <div className="mt-4 grid gap-2 lg:grid-cols-2">
                <Row
                    label="번호 커버리지"
                    value={`${coverage.averageDistinctNumbers} / ${coverage.maxDistinctNumbers}`}
                    note="5세트가 서로 다른 번호를 몇 개 덮는지. 겹칠수록 5장을 사고도 덜 덮습니다."
                >
                    <RangeMeter
                        value={coverage.averageDistinctNumbers}
                        low={randomControl.averageDistinctNumbers}
                        high={coverage.maxDistinctNumbers}
                        format={(v) => v.toFixed(1)}
                    />
                </Row>

                <Row
                    label="회차 최고 일치"
                    value={data.averageBestMatchPerDraw.toFixed(3)}
                    note={`5세트 중 가장 잘 맞은 세트의 일치 수. 상한은 번호가 하나도 겹치지 않을 때의 값(${disjointControl.averageBestMatchPerDraw.toFixed(3)})입니다. ${data.evaluatedDraws}회 표본이라 ±0.09 정도 흔들립니다.`}
                >
                    <RangeMeter
                        value={data.averageBestMatchPerDraw}
                        low={randomControl.averageBestMatchPerDraw}
                        high={disjointControl.averageBestMatchPerDraw}
                        format={(v) => v.toFixed(3)}
                    />
                </Row>

                <Row
                    label="5장 중 3개 이상"
                    value={`${drawHitRate.best3Plus.toFixed(1)}%`}
                    note={`5등(3개 일치) 이상이 한 장이라도 나온 회차 비율. 순수 랜덤은 ${randomControl.best3PlusRate.toFixed(1)}% 인데, ${data.evaluatedDraws}회 표본으로는 이 차이가 우연과 구분되지 않습니다.`}
                />

                <Row
                    label="세트 평균 일치"
                    value={data.averageMatchPerSet.toFixed(3)}
                    note={`기준선 ${theoretical.expectedMatchPerSet.toFixed(3)} (= 6×6/45), ${verdictOf(overall.zScore)}. 6개를 고르는 어떤 방식으로도 이 값은 오르지 않습니다 — 추천이 당첨 확률을 높이지는 못합니다.`}
                >
                    <BaselineMeter value={data.averageMatchPerSet} baseline={theoretical.expectedMatchPerSet} />
                </Row>
            </div>

            <PayoutSection popularity={data.popularity} />
        </div>
    );
}

// 위 지표는 모두 "확률은 못 올린다"로 끝난다. 실제로 움직이는 건 배당 하나뿐이라
// 근거 수치를 여기 모아 둔다 (backend/src/algorithms/popularity.ts).
function PayoutSection({ popularity }: { popularity: LottoBacktestDiagnostics['popularity'] }) {
    return (
        <div className="mt-5 border-t-2 border-ink pt-4">
            <p className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-ink">확률이 아니라 배당</p>
            <h4 className="mt-1 text-base font-extrabold text-ink">덜 고르는 조합을 고르면 나눌 사람이 줄어듭니다</h4>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                1·2·3등은 당첨금을 당첨자끼리 나눕니다(4·5등은 50,000원·5,000원 고정액).
                추첨은 조합을 균등하게 뽑으므로, 회차별 당첨자 수가 곧 그 조합의 인기입니다.
                1,243회차 당첨자 수로 인기 예측 모델을 만들어 적합에 쓰지 않은 200회차에 적용한 결과입니다.
            </p>

            <div className="mt-4 grid gap-2 lg:grid-cols-2">
                <Row
                    label="이번 추천이 받은 점수"
                    value={`백분위 ${popularity.averagePercentile}`}
                    note={`무작위로 고르면 ${popularity.randomPercentile} 입니다. 규칙을 통과한 후보 24개 중 가장 덜 고르는 조합을 골라 내려간 값입니다.`}
                >
                    <RangeMeter
                        value={popularity.randomPercentile - popularity.averagePercentile}
                        low={0}
                        high={popularity.randomPercentile}
                        format={(v) => `${(popularity.randomPercentile - v).toFixed(0)}`}
                    />
                </Row>

                <Row
                    label="2등 1인당 당첨금"
                    value="1.140배"
                    note="점수 최하위 20% 조합 기준. 부트스트랩 2,000회로 z = 4.26, Bonferroni 임계 2.39를 넘습니다."
                />
                <Row
                    label="3등 1인당 당첨금"
                    value="1.077배"
                    note="같은 기준에서 z = 4.48. 2·3등은 당첨자가 많아 측정 노이즈가 작습니다."
                />
                <Row
                    label="1등 1인당 당첨금"
                    value="구분 불가"
                    note="1.033배, z = 0.37. 1등 당첨자 중 번호를 직접 고른 사람(수동)은 30%뿐이고 나머지는 자동 구매(균등 무작위)라 선택 편향이 희석됩니다. 이 비율은 20년간 안정적입니다."
                />
                <Row
                    label="1게임 기대값"
                    value="520원 → 529원"
                    note="1,000원 1게임 기준 환급률 52.0% → 52.9%. 올라가는 건 +0.9%p 입니다. 여전히 사는 쪽이 손해입니다."
                />
            </div>
        </div>
    );
}

// 연금복권은 자릿수 구조라 커버리지 개념이 없다. 기준선 비교만 보여준다.
export function PensionHonestyPanel({ data }: { data: PensionBacktestDiagnostics }) {
    const { theoretical, randomControl } = data.baseline;

    return (
        <div className="mt-5 border-2 border-ink bg-paper p-4 sm:p-5 lg:mt-6">
            <PanelHead draws={data.evaluatedDraws} note="같은 회차를 순수 랜덤 세트와 나란히 채점한 결과입니다." />

            <div className="mt-4">
                <Row
                    label="세트 평균 일치"
                    value={data.averageMatchPerSet.toFixed(4)}
                    note={`기준선 ${theoretical.expectedMatchPerSet.toFixed(4)}, 순수 랜덤 대조군 ${randomControl.averageMatchPerSet.toFixed(4)}, ${verdictOf(data.baseline.overall.zScore)}. 끝자리부터 연속으로 맞은 자리 수 기준이며, 어떤 추천 방식으로도 이 값은 오르지 않습니다.`}
                >
                    <BaselineMeter value={data.averageMatchPerSet} baseline={theoretical.expectedMatchPerSet} />
                </Row>
            </div>
        </div>
    );
}
