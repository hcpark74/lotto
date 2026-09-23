// 연금복권 자릿수 채움색 (십만→일 자리), 조 번호는 흰색
export const PENSION_DIGIT_COLORS = ['var(--color-coral)', 'var(--color-lemon)', 'var(--color-mint)', 'var(--color-sky)', 'var(--color-grape)', 'var(--color-ball-4)'];
export const PENSION_DIGIT_COLORS_WITH_BAND = ['var(--color-card)', ...PENSION_DIGIT_COLORS];
// 진단 백테스트 회차 수. 120회는 표본이 작아 z 부호가 시드에 따라 흔들렸다.
// 백엔드 상한은 로또 300, 연금 240.
export const BACKTEST_DRAWS = 240;
