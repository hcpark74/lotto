// 연금복권 자릿수 채움색 (십만→일 자리), 조 번호는 흰색
export const PENSION_DIGIT_COLORS = ['var(--color-coral)', 'var(--color-lemon)', 'var(--color-mint)', 'var(--color-sky)', 'var(--color-grape)', 'var(--color-ball-4)'];
export const PENSION_DIGIT_COLORS_WITH_BAND = ['var(--color-card)', ...PENSION_DIGIT_COLORS];
export const LAST_SYNC_STORAGE_KEY = 'lotto-last-synced-at';
export const LAST_SYNC_DRAW_STORAGE_KEY = 'lotto-last-synced-draw';
export const LOTTO_RULE_LABELS: Record<string, string> = {
    'odd-balance': '홀짝 균형형',
    'no-consecutive-pair': '연속 독립형',
    'stable-sum': '합계 안정형',
    'zone-distribution': '구간 분포형',
    'tail-balance': '끝수 균형형',
};
export const PENSION_RULE_LABELS: Record<string, string> = {
    'balanced-core': '균형형 추천',
    'odd-focus': '홀수 집중형 추천',
    'unique-focus': '고유수 확장형 추천',
    'low-sum-stable': '저합계 안정형 추천',
};
