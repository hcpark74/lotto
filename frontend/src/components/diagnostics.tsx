import { PENSION_RULE_LABELS } from '../constants';
import type { LottoRulePerformance, LottoRuleWeight, PensionRulePerformance } from '../types';

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

// |z| >= 1.96 이면 5% 유의수준에서 랜덤(0.8)과 다르다. 그 외는 노이즈 범위.
export function ZScoreBadge({ zScore }: { zScore: number }) {
    const significant = Math.abs(zScore) >= 1.96;
    const tone = !significant ? '' : zScore > 0 ? 'chip-mint' : 'chip-coral';
    const mark = !significant ? '＝' : zScore > 0 ? '▲' : '▼';
    return (
        <span className={`chip ${tone}`}>
            {mark} z {zScore > 0 ? '+' : ''}{zScore.toFixed(2)} · {significant ? '유의' : '랜덤 범위'}
        </span>
    );
}

export function RulePerformanceCard({ item }: { item: LottoRulePerformance }) {
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
                    <ZScoreBadge zScore={item.zScore} />
                    <div className="text-[11px] text-ink-soft">95% CI {item.ci95[0].toFixed(3)} ~ {item.ci95[1].toFixed(3)}</div>
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

export function PensionRulePerformanceCard({ item }: { item: PensionRulePerformance }) {
    return (
        <div className="border-2 border-ink bg-card px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-semibold text-ink">{PENSION_RULE_LABELS[item.ruleId] ?? item.label}</div>
                    <div className="mt-1 text-xs text-ink-soft">생성 {item.generatedCount}회</div>
                </div>
                <div className="chip chip-sky">
                    평균 정확 일치 {item.averageExactMatches.toFixed(3)}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-ink-soft sm:text-sm">
                <div className="stat-tile">
                    <div>3자리 이상 일치</div>
                    <div className="mt-1 font-semibold text-ink">{item.exactMatch3PlusRate.toFixed(1)}%</div>
                </div>
                <div className="stat-tile">
                    <div>4자리 이상 일치</div>
                    <div className="mt-1 font-semibold text-ink">{item.exactMatch4PlusRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}
