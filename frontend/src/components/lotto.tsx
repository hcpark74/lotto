import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Ball, BonusBadge } from './Ball';
import { LOTTO_RULE_LABELS } from '../constants';
import { formatMoneyKRW } from '../format';
import type { DrawResult, LottoSet } from '../types';

export function DrawResultCard({
    draw,
    chipLabel,
    variant = 'default',
    onPrimaryAction,
    onSecondaryAction,
    primaryActionLabel,
    secondaryActionLabel,
    primaryDisabled = false,
    statusText,
}: {
    draw: DrawResult;
    chipLabel: string;
    variant?: 'default' | 'latest';
    onPrimaryAction?: () => void;
    onSecondaryAction?: () => void;
    primaryActionLabel?: string;
    secondaryActionLabel?: string;
    primaryDisabled?: boolean;
    statusText?: string;
}) {
    const numbers = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];
    const oddCount = numbers.filter(num => num % 2 === 1).length;
    const sum = numbers.reduce((total, num) => total + num, 0);

    if (variant === 'latest') {
        return (
            <div className="latest-feature-card px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
                {statusText && (
                    <div className="latest-feature-status mb-5 px-4 py-3 text-center sm:mb-7">
                        <p className="text-xs font-medium tracking-[-0.01em] text-ink-soft sm:text-sm">{statusText}</p>
                    </div>
                )}

                <div className="text-center">
                    <img
                        src="/images/img-mainLt645.svg"
                        alt="Lotto 6/45"
                        className="lotto-mark-image mx-auto"
                    />
                </div>

                <div className="latest-feature-heading mt-8 sm:mt-10">
                    <div className="result-arrow-shell result-arrow-left">
                        <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                        <div className="text-[42px] font-extrabold tracking-[-0.05em] text-ink sm:text-[56px]">{draw.drwNo}회</div>
                        <div className="mt-1 text-[18px] font-medium text-ink-soft sm:text-[20px]">{draw.drwNoDate}</div>
                    </div>
                    <div className="result-arrow-shell result-arrow-right text-ink-soft">
                        <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                    </div>
                </div>

                <div className="result-divider mt-8 sm:mt-10" />

                <div className="mt-9 flex flex-wrap items-center justify-center gap-2 sm:gap-4 lg:gap-5">
                    {numbers.map((num, i) => (
                        <Ball key={i} num={num} size="responsive" delay={i * 20} />
                    ))}
                    <div className="flex items-center gap-2 sm:gap-4 lg:gap-5">
                        <span className="font-mono text-3xl font-bold text-ink sm:text-4xl">+</span>
                        <div className="relative">
                            <Ball num={draw.bnusNo} size="responsive" />
                            <BonusBadge />
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-[16px] font-medium text-ink-soft sm:text-[18px]">1등 당첨금</p>
                    <p className="mt-3 text-[36px] font-extrabold tracking-[-0.05em] text-ink sm:text-[54px]">
                        {formatMoneyKRW(draw.firstWinamnt)}
                    </p>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4">
                    <button
                        type="button"
                        onClick={onSecondaryAction}
                        className="latest-feature-secondary inline-flex min-h-14 items-center justify-center px-3 text-[15px] font-semibold tracking-[-0.02em] transition sm:px-5 sm:text-lg"
                    >
                        {secondaryActionLabel ?? '회차 상세 보기'}
                    </button>
                    <button
                        type="button"
                        onClick={onPrimaryAction}
                        disabled={primaryDisabled}
                        className="latest-feature-primary inline-flex min-h-14 items-center justify-center px-3 text-[15px] font-semibold tracking-[-0.02em] transition sm:px-5 sm:text-lg"
                    >
                        {primaryActionLabel ?? '최신 결과 동기화'}
                    </button>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft sm:mt-8 sm:text-base">
                    <span>보너스 {draw.bnusNo}</span>
                    <span className="text-ink-soft">/</span>
                    <span>번호 합계 {sum}</span>
                    <span className="text-ink-soft">/</span>
                    <span>홀수 {oddCount}개</span>
                </div>
            </div>
        );
    }

    return (
        <div className="latest-draw-card px-5 py-6 sm:px-8 sm:py-9 lg:px-12 lg:py-10">
            <div className="relative text-center">
                <div className="pointer-events-none absolute left-0 top-1/2 hidden -translate-y-1/2 lg:flex">
                    <div className="result-arrow-shell">
                        <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 lg:flex">
                    <div className="result-arrow-shell">
                        <ChevronRight className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="chip chip-mint">
                    {chipLabel}
                </div>
                <h3 className="mt-4 text-[28px] font-extrabold tracking-[-0.04em] text-ink sm:text-[42px]">
                    제 <span className="bg-lemon px-2">{draw.drwNo}</span>회 추첨 결과
                </h3>
                <p className="mt-3 text-base font-medium text-ink-soft sm:text-[18px]">{draw.drwNoDate} 추첨</p>
                <div className="chip chip-coral mt-5 text-sm">
                    1등 당첨금 {formatMoneyKRW(draw.firstWinamnt)}
                </div>
            </div>

            <div className="result-divider mt-8" />

            <div className="mt-8 flex flex-col items-center gap-5 lg:flex-row lg:items-end lg:justify-center lg:gap-10">
                <div className="result-number-group">
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                        {numbers.map((num, i) => (
                            <Ball key={i} num={num} size="md" delay={i * 20} />
                        ))}
                    </div>
                    <div className="result-label-row mt-5">
                        <span className="result-label-line" />
                        <span className="result-label-text">당첨번호</span>
                        <span className="result-label-line" />
                    </div>
                </div>

                <div className="flex items-center justify-center gap-4 lg:gap-8">
                    <span className="font-mono text-3xl font-bold text-ink sm:text-4xl">+</span>
                    <div className="result-number-group">
                        <div className="flex justify-center">
                            <div className="relative">
                                <Ball num={draw.bnusNo} size="md" />
                                <BonusBadge />
                            </div>
                        </div>
                        <div className="result-label-row mt-5">
                            <span className="result-label-line short" />
                            <span className="result-label-text">보너스번호</span>
                            <span className="result-label-line short" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 grid gap-2 sm:grid-cols-3">
                <div className="latest-draw-stat px-3 py-3">
                    <div className="text-[11px] font-medium text-ink-soft">보너스 번호</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{draw.bnusNo}</div>
                </div>
                <div className="latest-draw-stat px-3 py-3">
                    <div className="text-[11px] font-medium text-ink-soft">번호 합계</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{sum}</div>
                </div>
                <div className="latest-draw-stat px-3 py-3">
                    <div className="text-[11px] font-medium text-ink-soft">홀수 개수</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{oddCount}</div>
                </div>
            </div>
        </div>
    );
}

export function RecommendationCard({
    set,
    index,
}: {
    set: LottoSet;
    index: number;
}) {
    const sum = set.numbers.reduce((total, num) => total + num, 0);
    const oddCount = set.numbers.filter(num => num % 2 === 1).length;
    const spread = Math.max(...set.numbers) - Math.min(...set.numbers);
    const ruleName = set.meta?.ruleId ? (LOTTO_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className={`recommend-card px-4 py-5 sm:px-6 sm:py-7 ${index === 0 ? 'is-featured' : ''}`}>
            <div className="text-center">
                <div className={`chip ${index === 0 ? 'chip-lemon' : ''}`}>
                    {index === 0 ? '가장 추천 · Set 1' : `추천 Set ${index + 1}`}
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-[-0.03em] text-ink sm:text-[28px]">
                    {set.label}
                </h3>
                {(set.meta?.ruleWeight || ruleName) && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-soft sm:text-sm">
                        {set.meta?.ruleWeight ? (
                            <span className="chip">
                                weight {set.meta.ruleWeight.toFixed(3)}
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

            <div className="mt-7">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                    {set.numbers.map((num, i) => (
                        <Ball key={i} num={num} size="responsive" delay={index * 70 + i * 30} />
                    ))}
                </div>
                <div className="result-label-row mt-5">
                    <span className="result-label-line" />
                    <span className="result-label-text">추천번호</span>
                    <span className="result-label-line" />
                </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft sm:mt-8 sm:text-base">
                <span>번호 합계 {sum}</span>
                <span className="text-ink-soft">/</span>
                <span>홀수 {oddCount}개</span>
                <span className="text-ink-soft">/</span>
                <span>최대 간격 {spread}</span>
            </div>
        </div>
    );
}
