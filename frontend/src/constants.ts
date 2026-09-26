// 연금복권 자릿수 색 (십만→일 자리) — 동행복권 공식색. 조 번호는 자릿수가 아니라 회색.
export const PENSION_DIGIT_COLORS = [
    'var(--color-wf-1)',
    'var(--color-wf-2)',
    'var(--color-wf-3)',
    'var(--color-wf-4)',
    'var(--color-wf-5)',
    'var(--color-wf-6)',
];
export const PENSION_BAND_COLOR = 'var(--color-wf-band)';

// 진단 백테스트 회차 수. 120회는 표본이 작아 z 부호가 시드에 따라 흔들렸다.
// 백엔드 상한은 로또 300, 연금 240.
export const BACKTEST_DRAWS = 240;
