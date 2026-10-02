import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Ball, BonusBadge } from './Ball';
import { formatMoneyKRW } from '../format';
import type { DrawResult, LottoSet } from '../types';

export function DrawResultCard({
    draw,
    onOlder,
    onNewer,
    canGoOlder = false,
    canGoNewer = false,
}: {
    draw: DrawResult;
    onOlder?: () => void;
    onNewer?: () => void;
    canGoOlder?: boolean;
    canGoNewer?: boolean;
}) {
    const numbers = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];
    const oddCount = numbers.filter(num => num % 2 === 1).length;
    const sum = numbers.reduce((total, num) => total + num, 0);

    return (
            <div className="latest-feature-card px-5 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
                <div className="text-center">
                    <img
                        src="/images/img-mainLt645.svg"
                        alt="Lotto 6/45"
                        className="lotto-mark-image mx-auto"
                    />
                </div>

                {/* 좌: 과거(회차 −1), 우: 최신 방향(회차 +1). 양 끝에서는 비활성. */}
                <div className="latest-feature-heading mt-4 sm:mt-10">
                    <button
                        type="button"
                        onClick={onOlder}
                        disabled={!canGoOlder}
                        aria-label="이전 회차"
                        className="result-arrow-shell result-arrow-left"
                    >
                        <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} />
                    </button>
                    <div className="text-center">
                        <div className="text-3xl font-extrabold tracking-[-0.05em] text-ink sm:text-5xl">{draw.drwNo}회</div>
                        <div className="mt-1 text-sm font-medium text-ink-soft sm:text-xl">{draw.drwNoDate}</div>
                    </div>
                    <button
                        type="button"
                        onClick={onNewer}
                        disabled={!canGoNewer}
                        aria-label="다음 회차"
                        className="result-arrow-shell result-arrow-right"
                    >
                        <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} />
                    </button>
                </div>

                <div className="result-divider mt-5 sm:mt-10" />

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8 sm:gap-4 lg:gap-5">
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

                <div className="mt-7 text-center sm:mt-12">
                    <p className="text-base font-medium text-ink-soft sm:text-lg">1등 당첨금</p>
                    <p className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-ink sm:text-5xl">
                        {formatMoneyKRW(draw.firstWinamnt)}
                    </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft sm:mt-8 sm:text-base">
                    <span>보너스 {draw.bnusNo}</span>
                    <span className="text-ink-soft">/</span>
                    <span>번호 합계 {sum}</span>
                    <span className="text-ink-soft">/</span>
                    <span>홀수 {oddCount}개</span>
                </div>
            </div>
        );
}

export function RecommendationCard({
    set,
    index,
    onSave,
    saving = false,
    saved = false,
}: {
    set: LottoSet;
    index: number;
    onSave?: () => void;
    saving?: boolean;
    saved?: boolean;
}) {
    const sum = set.numbers.reduce((total, num) => total + num, 0);
    const oddCount = set.numbers.filter(num => num % 2 === 1).length;
    const spread = Math.max(...set.numbers) - Math.min(...set.numbers);
    // 규칙 기반 세트의 label 은 백엔드 규칙 이름 그대로다
    const ruleName = set.meta?.ruleId ? set.label : null;

    return (
        <div className={`recommend-card px-4 py-5 sm:px-6 sm:py-7 ${index === 0 ? 'is-featured' : ''}`}>
            <div className="text-center">
                <div className={`chip ${index === 0 ? 'chip-lemon' : ''}`}>
                    {index === 0 ? '가장 추천 · Set 1' : `추천 Set ${index + 1}`}
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-[-0.03em] text-ink sm:text-3xl">
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
                            <span className="chip">
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

            {onSave && (
                <div className="mt-5 flex justify-center">
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving || saved}
                        className="btn-secondary inline-flex min-h-11 items-center justify-center px-5 text-sm"
                    >
                        {saved ? '저장됨' : saving ? '저장 중...' : '다음 회차로 저장'}
                    </button>
                </div>
            )}
        </div>
    );
}
