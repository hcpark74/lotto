import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PENSION_DIGIT_COLORS, PENSION_DIGIT_COLORS_WITH_BAND, PENSION_RULE_LABELS } from '../constants';
import { formatDateTime } from '../format';
import type { PensionDrawResult, PensionRecommendationSet } from '../types';

export function PensionDigitBall({ value, color }: { value: string; color: string }) {
    return (
        <div
            className="flex h-[clamp(50px,8.6vw,72px)] w-[clamp(44px,7.6vw,64px)] items-center justify-center rounded-[4px] border-2 border-ink font-mono text-[clamp(22px,3.6vw,34px)] font-bold text-ink shadow-brutal-sm"
            style={{ background: color }}
        >
            {value}
        </div>
    );
}

export function PensionNumberRow({
    label,
    subtitle,
    number,
    band,
    showBand = true,
    prefixLabel,
}: {
    label: string;
    subtitle: string;
    number: string;
    band?: string;
    showBand?: boolean;
    prefixLabel?: string;
}) {
    const colors = PENSION_DIGIT_COLORS_WITH_BAND;
    const digits = number.padStart(6, '0').slice(-6).split('');

    return (
        <div className="grid gap-5 border-t-2 border-ink py-6 lg:grid-cols-[1.05fr_1.55fr] lg:items-center lg:gap-12">
            <div className="text-center lg:text-left">
                <div className="text-[24px] font-semibold tracking-[-0.04em] text-ink sm:text-[34px] lg:text-[38px]">
                    {label} <span className="mx-1.5 text-ink-soft">|</span> {subtitle}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                {showBand && band ? (
                    <div className="text-center">
                        <PensionDigitBall value={band} color={colors[0]} />
                        <div className="mt-2 text-sm font-medium text-ink-soft">조</div>
                    </div>
                ) : prefixLabel ? (
                    <div className="px-1 text-base font-medium text-ink-soft sm:text-lg">{prefixLabel}</div>
                ) : null}
                {digits.map((digit, index) => (
                    <PensionDigitBall
                        key={`${label}-${index}`}
                        value={digit}
                        color={colors[Math.min(index + (showBand ? 1 : 0), colors.length - 1)]}
                    />
                ))}
            </div>
        </div>
    );
}

export function PensionResultCard({ draw }: { draw: PensionDrawResult }) {
    return (
        <div className="latest-feature-card px-5 py-7 sm:px-8 sm:py-9 lg:px-12 lg:py-12">
            <div className="latest-feature-heading">
                <div className="result-arrow-shell result-arrow-left">
                    <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                    <h2 className="text-[30px] font-extrabold tracking-[-0.05em] text-ink sm:text-[48px] lg:text-[56px]">
                    제 <span className="bg-lemon px-2">{draw.draw_no}</span>회 추첨 결과
                    </h2>
                    <p className="mt-3 text-base font-medium text-ink-soft sm:text-[18px]">{draw.draw_date} 추첨</p>
                </div>
                <div className="result-arrow-shell result-arrow-right text-ink-soft">
                    <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                </div>
            </div>

            <div className="result-divider mt-8 sm:mt-10" />

            <div className="mt-8">
                <PensionNumberRow label="1등" subtitle="월 700만원 x 20년" band={draw.winning_band} number={draw.winning_number} />
                <PensionNumberRow label="보너스" subtitle="월 100만원 x 10년" number={draw.bonus_number} showBand={false} prefixLabel="각조" />
            </div>

            <div className="mt-8 text-center text-xs text-ink-soft sm:text-sm">
                최근 동기화 {formatDateTime(new Date(draw.synced_at))}
            </div>
        </div>
    );
}

export function PensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
    const ruleName = set.meta.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className="recommend-card px-4 py-5 sm:px-6 sm:py-7">
            <div className="text-center">
                <div className="chip chip-mint">
                    {set.label}
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-[-0.03em] text-ink sm:text-[28px]">
                    연금복권 추천번호
                </h3>
                {(set.meta.ruleWeight || ruleName) && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-soft sm:text-sm">
                        {set.meta.ruleWeight ? (
                            <span className="chip">
                                가중치 {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="chip chip-mint">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            <div className="result-divider mt-7" />

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                <div className="px-1 text-base font-medium text-ink-soft sm:text-lg">각조</div>
                {set.number.split('').map((digit, index) => {
                    const colors = PENSION_DIGIT_COLORS;
                    return <PensionDigitBall key={`${set.label}-${index}`} value={digit} color={colors[index]} />;
                })}
            </div>

            <div className="result-label-row mt-5">
                <span className="result-label-line" />
                <span className="result-label-text">추천번호</span>
                <span className="result-label-line" />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft sm:text-base">
                <span>합계 {set.meta.sum}</span>
                <span className="text-ink-soft">/</span>
                <span>홀수 {set.meta.oddCount}개</span>
                <span className="text-ink-soft">/</span>
                <span>고유숫자 {set.meta.uniqueDigitCount}개</span>
                <span className="text-ink-soft">/</span>
                <span>최대 중복 {set.meta.maxDuplicateCount}개</span>
            </div>
        </div>
    );
}

export function FeaturedPensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
    const ruleName = set.meta.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className="recommend-card is-featured px-5 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="chip chip-mint">
                        대표 추천 1세트
                    </div>
                    <h3 className="mt-4 text-2xl font-extrabold tracking-[-0.04em] text-ink sm:text-[32px]">
                        {set.label}
                    </h3>
                    <p className="mt-2 text-sm text-ink-soft sm:text-base">
                        현재 추천 성향 우선순위에서 가장 먼저 선택된 대표 조합입니다.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft sm:text-sm">
                        {set.meta.ruleWeight ? (
                            <span className="chip">
                                가중치 {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="chip chip-mint">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="border-2 border-ink bg-card px-4 py-4 shadow-brutal-sm sm:px-5">
                    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                        <div className="px-1 text-base font-medium text-ink-soft sm:text-lg">각조</div>
                        {set.number.split('').map((digit, index) => {
                            const colors = PENSION_DIGIT_COLORS;
                            return <PensionDigitBall key={`featured-${set.label}-${index}`} value={digit} color={colors[index]} />;
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div className="stat-tile">
                    <div className="text-xs text-ink-soft">합계</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{set.meta.sum}</div>
                </div>
                <div className="stat-tile">
                    <div className="text-xs text-ink-soft">홀수 개수</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{set.meta.oddCount}개</div>
                </div>
                <div className="stat-tile">
                    <div className="text-xs text-ink-soft">고유 숫자</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{set.meta.uniqueDigitCount}개</div>
                </div>
                <div className="stat-tile">
                    <div className="text-xs text-ink-soft">최대 중복</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{set.meta.maxDuplicateCount}개</div>
                </div>
            </div>
        </div>
    );
}
