import type { ConfidenceInterval95, LottoRulePerformance, LottoRuleWeight, PensionRankHits, PensionRulePerformance } from '../types';

// 정규근사라 하한이 음수로 나올 수 있다. 일치 수는 음수가 될 수 없으므로 0 으로 자른다.
function formatCi([low, high]: ConfidenceInterval95, digits: number) {
    return `${Math.max(low, 0).toFixed(digits)} ~ ${high.toFixed(digits)}`;
}

export function RuleWeightCard({ item, index }: { item: LottoRuleWeight; index: number }) {
    return (
        <div className="border-2 border-ink bg-card px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">우선순위 {index + 1}</div>
                    <div className="mt-2 text-base font-semibold text-ink">{item.label}</div>
                </div>
                <div className="chip chip-mint">
                    가중치 {item.weight.toFixed(3)}
                </div>
            </div>

            <div className="mt-4 space-y-2">
                <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
                        <span>규칙 점수</span>
                        <span>{(item.score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="meter">
                        <div className="meter-fill" style={{ width: `${Math.max(item.score * 100, 6)}%` }} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-ink-soft sm:text-sm">
                    <div className="stat-tile">
                        <div>공통+세트 통과</div>
                        <div className="mt-1 font-semibold text-ink">{(item.passRate * 100).toFixed(1)}%</div>
                    </div>
                    <div className="stat-tile">
                        <div>세트 규칙 일치</div>
                        <div className="mt-1 font-semibold text-ink">{(item.recentMatchRate * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 검정이 하나면 |z| >= 1.96 (양측 5%). 규칙 여러 개를 동시에 볼 때는 threshold 에 Bonferroni 값을 넘긴다.
// significant 를 넘기면 그 판정을 그대로 쓴다 (백엔드가 계산한 값).
export function ZScoreBadge({ zScore, threshold = 1.96, significant: given }: { zScore: number; threshold?: number; significant?: boolean }) {
    const significant = given ?? Math.abs(zScore) >= threshold;
    const tone = !significant ? '' : zScore > 0 ? 'chip-mint' : 'chip-coral';
    const mark = !significant ? '＝' : zScore > 0 ? '▲' : '▼';
    return (
        <span className={`chip ${tone}`}>
            {mark} z {zScore > 0 ? '+' : ''}{zScore.toFixed(2)} · {significant ? '유의' : '랜덤 범위'}
        </span>
    );
}

export function RulePerformanceCard({ item, threshold }: { item: LottoRulePerformance; threshold: number }) {
    return (
        <div className="border-2 border-ink bg-card px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-semibold text-ink">{item.label}</div>
                    <div className="mt-1 text-xs text-ink-soft">생성 {item.generatedCount}회</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="chip chip-sky">
                        평균 일치 {item.averageMatches.toFixed(3)}
                    </div>
                    <ZScoreBadge zScore={item.zScore} threshold={threshold} />
                    <div className="text-[11px] text-ink-soft">95% CI {formatCi(item.ci95, 3)}</div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-ink-soft sm:text-sm">
                <div className="stat-tile">
                    <div>공통 규칙</div>
                    <div className="mt-1 font-semibold text-ink">{item.commonRulePassRate.toFixed(1)}%</div>
                </div>
                <div className="stat-tile">
                    <div>완화 폴백</div>
                    <div className="mt-1 font-semibold text-ink">{item.relaxedFallbackRate.toFixed(1)}%</div>
                </div>
                <div className="stat-tile">
                    <div>랜덤 폴백</div>
                    <div className="mt-1 font-semibold text-ink">{item.randomFallbackRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}

export function PensionRulePerformanceCard({ item, threshold }: { item: PensionRulePerformance; threshold: number }) {
    return (
        <div className="border-2 border-ink bg-card px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-semibold text-ink">{item.label}</div>
                    <div className="mt-1 text-xs text-ink-soft">생성 {item.generatedCount}회</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="chip chip-sky">
                        평균 일치 {item.averageMatches.toFixed(4)}
                    </div>
                    <ZScoreBadge zScore={item.zScore} threshold={threshold} />
                    <div className="text-[11px] text-ink-soft">95% CI {formatCi(item.ci95, 4)}</div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-ink-soft sm:text-sm">
                <div className="stat-tile">
                    <div>5등 이상 (끝 3자리+)</div>
                    <div className="mt-1 font-semibold text-ink">{item.match3PlusRate.toFixed(1)}%</div>
                </div>
                <div className="stat-tile">
                    <div>4등 이상 (끝 4자리+)</div>
                    <div className="mt-1 font-semibold text-ink">{item.match4PlusRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}

type Significance = {
    averageMatchPerSet: number;
    baseline: {
        theoretical: { expectedMatchPerSet: number; matchStdPerSet: number };
        randomControl: { totalSets: number; averageMatchPerSet: number; zScore: number; ci95: ConfidenceInterval95 };
        overall: { zScore: number; ci95: ConfidenceInterval95; significant: boolean };
    };
};

// 추천 알고리즘 전체와 순수 랜덤 대조군을 무작위 기준선과 비교한다 (로또·연금 공통)
export function SignificancePanel({ data, description, digits }: { data: Significance; description: string; digits: number }) {
    const { theoretical, overall, randomControl } = data.baseline;

    return (
        <div className="mt-5 border-2 border-ink bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">랜덤 대비 유의성</p>
                    <h3 className="mt-1 text-lg font-extrabold text-ink">기준선 {theoretical.expectedMatchPerSet.toFixed(digits)} 비교</h3>
                </div>
                <p className="text-xs text-ink-soft sm:text-sm">{description}, 표준편차 {theoretical.matchStdPerSet.toFixed(digits)}. |z| ≥ 1.96 이면 유의.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="stat-tile px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">추천 알고리즘 전체</div>
                        <ZScoreBadge zScore={overall.zScore} significant={overall.significant} />
                    </div>
                    <div className="mt-2 text-xs text-ink-soft">
                        평균 {data.averageMatchPerSet.toFixed(digits)} · 95% CI {formatCi(overall.ci95, digits)}
                    </div>
                </div>
                <div className="stat-tile px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">순수 랜덤 대조군</div>
                        <ZScoreBadge zScore={randomControl.zScore} />
                    </div>
                    <div className="mt-2 text-xs text-ink-soft">
                        평균 {randomControl.averageMatchPerSet.toFixed(digits)} · 95% CI {formatCi(randomControl.ci95, digits)} · {randomControl.totalSets}세트
                    </div>
                </div>
            </div>
        </div>
    );
}

// 등위 ↔ 끝자리 연속 일치 수. 추천 번호는 조를 고르지 않아 6자리 일치는 2등으로 센다.
const PENSION_RANKS: { key: keyof PensionRankHits; label: string; matches: number }[] = [
    { key: 'rank2', label: '2등', matches: 6 },
    { key: 'rank3', label: '3등', matches: 5 },
    { key: 'rank4', label: '4등', matches: 4 },
    { key: 'rank5', label: '5등', matches: 3 },
    { key: 'rank6', label: '6등', matches: 2 },
    { key: 'rank7', label: '7등', matches: 1 },
];

// expectedHitDistribution 은 끝자리 일치 수별 무작위 기대 세트 수. 보너스(6자리 일치) 확률은 6자리와 같다.
export function PensionRankHitsPanel({ rankHits, expected, totalSets }: { rankHits: PensionRankHits; expected: Record<number, number>; totalSets: number }) {
    const tiles = [
        ...PENSION_RANKS.map(rank => ({ label: `${rank.label} · 끝 ${rank.matches}자리`, hits: rankHits[rank.key], expected: expected[rank.matches] })),
        { label: '보너스 · 6자리', hits: rankHits.bonus, expected: expected[6] },
    ];

    return (
        <div className="mt-5 border-2 border-ink bg-paper p-4 sm:p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">등위별 적중</p>
                    <h3 className="mt-1 text-lg font-extrabold text-ink">추천 {totalSets}세트의 등위별 적중 수</h3>
                </div>
                <p className="text-xs text-ink-soft sm:text-sm">1등(조+6자리)은 조를 고르지 않아 판정하지 않습니다.</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-ink-soft sm:grid-cols-4 sm:text-sm">
                {tiles.map(tile => (
                    <div key={tile.label} className="stat-tile">
                        <div>{tile.label}</div>
                        <div className="mt-1 text-lg font-semibold text-ink">{tile.hits}세트</div>
                        <div className="mt-1 text-[11px] text-ink-soft">랜덤 기대 {tile.expected?.toFixed(2) ?? '-'}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// 규칙별 z 는 여러 개를 동시에 검정하므로 우연히 하나쯤 |z| ≥ 1.96 이 나오기 쉽다.
export function MultipleComparisonNote({ count, threshold }: { count: number; threshold: number }) {
    return (
        <p className="mt-3 text-xs text-ink-soft sm:text-sm">
            규칙 {count}개를 동시에 비교하므로 |z| ≥ {threshold.toFixed(2)} 일 때만 유의로 표시합니다.
            로또·연금 추첨은 독립·균등이라, 유의 표시가 나와도 우연일 가능성을 먼저 의심해야 합니다.
        </p>
    );
}
