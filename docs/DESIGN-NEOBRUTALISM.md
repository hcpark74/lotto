# 네오브루탈리즘 디자인 적용 방안

작성일: 2026-09-21 · **적용 완료 2026-09-21** (Phase 0–4 를 한 커밋에 적용)
대상: `frontend/` (React 19 + Vite 7 + Tailwind CSS 4.2)

적용 결과 요약: `index.css` 를 `@import "tailwindcss"` + `@theme` + `@layer components` 로 전면
재작성, `tailwind.config.js` 삭제, `App.tsx` className 전수 치환(`slate-`·`emerald-`·`rounded-2xl`·
`shadow-[…]`·`backdrop-blur`·투명도 서픽스 0건). 빌드 CSS 13.7 kB → 27.7 kB (테마 유틸리티가
처음으로 포함됨). 아래 §0~§7 은 적용 전 계획 원문.
현재 기준: [frontend/src/index.css](../frontend/src/index.css), [frontend/src/App.tsx](../frontend/src/App.tsx) (1,817줄, 단일 파일)

---

## 0. 전제 — 지금 Tailwind 테마 유틸리티가 빌드에 안 나온다

`vite build` 결과 `dist/assets/index-*.css`(13.7 kB)를 확인한 결과:

| 클래스 | 출력 여부 | 이유 |
|---|---|---|
| `flex`, `hidden`, `grid-cols-2` | ○ | 테마 값 불필요 |
| `rounded-[22px]`, `rounded-full` | ○ | 임의값 / 상수 |
| `px-5`, `gap-3`, `mt-1`, `max-w-6xl` | × | `--spacing` 없음 |
| `text-sm`, `font-semibold` | × | `--text-*`, `--font-weight-*` 없음 |
| `rounded-2xl`, `text-slate-500`, `bg-emerald-50`, `border-slate-200` | × | `--radius-*`, `--color-*` 없음 |

원인: `index.css` 가 v3 문법(`@tailwind base/components/utilities`)만 쓰고
`@import "tailwindcss"` 가 없어서 **기본 테마가 로드되지 않는다**. `tailwind.config.js` 도
v4 에서는 `@config` 지시어 없이는 읽히지 않는다(정의된 `lotto.*` 색상은 어차피 미사용).

즉 App.tsx 의 spacing·색상·타이포 유틸리티 대부분이 **지금까지 한 번도 적용된 적이 없고**,
현재 화면은 `index.css` 의 커스텀 클래스 + 인라인 스타일 + 임의값 유틸리티로만 그려지고 있다.

→ 파이프라인을 고치는 순간 화면이 크게 바뀌므로, **디자인 교체와 파이프라인 수정을 한
번에** 하는 편이 낫다. App.tsx 의 className 은 어차피 전수 재검토 대상이다.

---

## 1. 디자인 원칙 (이 프로젝트에 맞춘 네오브루탈리즘)

| 요소 | 규칙 |
|---|---|
| 테두리 | 잉크색 실선. 카드 3px, 컨트롤·칩 2px, 공 2px |
| 그림자 | 블러 0 의 오프셋 그림자. `4px 4px 0 ink` 기본, hover 시 `6px 6px`, 눌림 시 `0` + translate |
| 모서리 | 카드 0, 버튼·칩·입력 4px, 공만 원형. `rounded-2xl/3xl/[28px]` 전부 제거 |
| 색 | 그라디언트·반투명·blur 금지. 종이색 배경 위에 채도 높은 평면색 3–5개 |
| 타이포 | SUIT 유지, 제목은 800. 숫자·eyebrow 는 모노스페이스, 대문자 + letter-spacing |
| 상태 | 색이 아니라 **형태**로도 구분(테두리 두께·채움·기울인 스티커). 유의성 배지는 채움색 + 테두리 |
| 모션 | `ball-pop` 유지(0.3s 이내). hover/active 는 translate 만. `prefers-reduced-motion` 존중 |
| 공 | 광택 그라디언트 제거 → 평면색 + 잉크 테두리 + 오프셋 그림자. 동행복권 5구간 색은 유지 |

로또 공이 이 서비스의 정체성이므로 **볼드함은 공과 CTA 에만** 쓰고 나머지는 흑백에 가깝게
둔다. 배경·카드는 종이색/흰색, 강조는 lemon(CTA)·sky(연금)·coral(당첨금) 세 가지로 제한.

---

## 2. 토큰 (`@theme`)

```css
/* index.css — 기존 @tailwind 3줄을 이걸로 교체 */
@import url('https://fonts.googleapis.com/css2?family=SUIT:wght@400;600;800&family=IBM+Plex+Mono:wght@500;700&display=swap');
@import "tailwindcss";

@theme {
  /* 종이 · 잉크 */
  --color-paper: #f4f1e8;
  --color-card: #ffffff;
  --color-ink: #141414;
  --color-ink-soft: #4a4a4a;
  --color-rule: #141414;          /* 테두리는 항상 잉크 */

  /* 강조 3색 + 상태 */
  --color-lemon: #ffd93d;         /* 주 CTA, 로또 */
  --color-sky: #7cc5ff;           /* 연금복권 */
  --color-coral: #ff6b6b;         /* 당첨금, 오류 */
  --color-mint: #8ce99a;          /* 동기화 성공, 유의(+) */
  --color-grape: #c3a6ff;         /* 보조 강조(백테스트) */

  /* 로또 공 5구간 — 동행복권 색 유지, 평면화 */
  --color-ball-1: #ffd93d;
  --color-ball-2: #5dadec;
  --color-ball-3: #ff6b6b;
  --color-ball-4: #b0b8c1;
  --color-ball-5: #7cd67c;

  /* 형태 */
  --radius-none: 0;
  --radius-ctl: 4px;
  --shadow-brutal-sm: 2px 2px 0 0 var(--color-ink);
  --shadow-brutal: 4px 4px 0 0 var(--color-ink);
  --shadow-brutal-lg: 6px 6px 0 0 var(--color-ink);

  --font-sans: 'SUIT', 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'Cascadia Mono', monospace;
}
```

`--color-*` 를 정의하면 `bg-lemon`, `border-ink`, `text-ink-soft` 유틸리티가 자동 생성된다.
`slate-*`, `emerald-*` 등 기본 팔레트는 남겨두되 App.tsx 에서는 쓰지 않는 방향.

공 텍스트는 5구간 모두 **잉크색**으로 통일(현재는 흰색 + text-shadow). 명도 대비:
lemon 13.4:1, sky(#5dadec) 7.6:1, coral 6.6:1, gray 9.2:1, green 10.3:1 — 전부 AA(4.5:1) 통과.
칩 채움색(sky 9.9, mint 12.5, grape 9.0)과 `ink-soft`/paper 7.8 도 통과.

---

## 3. 컴포넌트 클래스 (`@layer components`)

App.tsx 가 이미 `.panel`, `.btn-primary`, `.recommend-card`, `.header-nav-link` 같은 시맨틱
클래스를 쓰고 있으므로 **클래스 이름은 유지하고 정의만 교체**한다. 그래야 App.tsx 변경량이
줄고 컴포넌트 분리는 다음 단계로 미룰 수 있다.

```css
@layer components {
  .panel {
    background: var(--color-card);
    border: 3px solid var(--color-ink);
    box-shadow: var(--shadow-brutal);
    border-radius: 0;
  }
  .panel > header, .panel-head {            /* SectionCard 헤더 */
    border-bottom: 3px solid var(--color-ink);
  }

  .btn-primary, .btn-secondary, .latest-feature-primary, .latest-feature-secondary {
    border: 2px solid var(--color-ink);
    border-radius: var(--radius-ctl);
    box-shadow: var(--shadow-brutal);
    color: var(--color-ink);
    font-weight: 800;
    transition: transform 80ms ease, box-shadow 80ms ease;
  }
  .btn-primary, .latest-feature-primary   { background: var(--color-lemon); }
  .btn-secondary, .latest-feature-secondary { background: var(--color-card); }
  .btn-primary:hover, .btn-secondary:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-brutal-lg); }
  .btn-primary:active, .btn-secondary:active { transform: translate(4px, 4px); box-shadow: none; }
  .btn-primary:disabled { background: var(--color-paper); color: var(--color-ink-soft); box-shadow: none; transform: none; }

  .chip {                                   /* recommend-badge, latest-draw-chip, 상태 배지 통합 */
    display: inline-flex; align-items: center; gap: 4px;
    border: 2px solid var(--color-ink);
    border-radius: var(--radius-ctl);
    padding: 2px 8px;
    font: 700 11px/1.6 var(--font-mono);
    letter-spacing: 0.08em; text-transform: uppercase;
    background: var(--color-card);
  }
  .chip-lemon { background: var(--color-lemon); }
  .chip-sky   { background: var(--color-sky); }
  .chip-coral { background: var(--color-coral); }
  .chip-mint  { background: var(--color-mint); }

  .header-nav { border: 2px solid var(--color-ink); border-radius: 0; padding: 0; background: var(--color-card); gap: 0; }
  .header-nav-link { border-radius: 0; color: var(--color-ink); }
  .header-nav-link + .header-nav-link { border-left: 2px solid var(--color-ink); }
  .header-nav-link.is-active { background: var(--color-ink); color: var(--color-card); box-shadow: none; }
  .tab-nav { gap: 8px; border-bottom: 3px solid var(--color-ink); padding: 0; }
  .tab-nav-link { border: 2px solid transparent; border-bottom: 0; color: var(--color-ink-soft); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; }
  .tab-nav-link.is-active { border-color: var(--color-ink); background: var(--color-lemon); color: var(--color-ink); }

  .stat-tile {                              /* bg-slate-50 rounded-2xl 계열 통합 */
    border: 2px solid var(--color-ink);
    background: var(--color-paper);
    padding: 8px 12px;
  }
  .meter { height: 12px; border: 2px solid var(--color-ink); background: var(--color-card); }
  .meter > div { height: 100%; background: var(--color-lemon); border-right: 2px solid var(--color-ink); }

  input[type="text"], input[type="number"] {
    border: 2px solid var(--color-ink); border-radius: var(--radius-ctl);
    background: var(--color-card); box-shadow: var(--shadow-brutal-sm);
  }
  :focus-visible { outline: 3px solid var(--color-ink); outline-offset: 2px; }
}

@media (prefers-reduced-motion: reduce) {
  .ball-pop, .btn-primary, .btn-secondary { animation: none; transition: none; }
}
```

### `Ball` 컴포넌트 (App.tsx:197)

인라인 그라디언트·boxShadow·textShadow 를 제거하고 아래로 교체:

```tsx
style={{
  width, height, fontSize,
  borderRadius: '999px',
  background: `var(--color-ball-${band})`,   // band = 1..5
  color: 'var(--color-ink)',
  border: '2px solid var(--color-ink)',
  boxShadow: size === 'sm' ? 'var(--shadow-brutal-sm)' : '3px 3px 0 0 var(--color-ink)',
  fontFamily: 'var(--font-mono)', fontWeight: 700,
}}
```

`getBallTheme` 는 `{ base, mid, dark, text }` 대신 구간 인덱스만 돌려주면 된다.
`BonusBadge` 는 원형 → 정사각형 4px 라운드, `bg-ink text-card`, 잉크 테두리.
`PensionDigitBall` 은 4px 색 테두리 → 잉크 2px 테두리 + 자리별 **채움색**.

---

## 4. App.tsx 치환 표

| 현재 (횟수) | 변경 |
|---|---|
| `rounded-2xl` (36), `rounded-3xl`, `rounded-[22/24/28/30px]` | `rounded-none` (카드) / `rounded-[4px]` (컨트롤) |
| `rounded-full` (28) | 공·보너스 표시만 유지, 칩은 `chip` 클래스로 |
| `border-slate-200` 계열 (39+) | `border-2 border-ink` 또는 컴포넌트 클래스로 흡수 |
| `bg-slate-50 rounded-2xl px-3 py-2` (통계 타일 십수 곳) | `stat-tile` |
| `text-slate-500` (71) | `text-ink-soft` |
| `text-slate-900/950` (50) | `text-ink` |
| `bg-emerald-50 text-emerald-700 rounded-full` 배지 | `chip chip-mint` |
| `bg-sky-50 text-sky-700` 배지 | `chip chip-sky` |
| `bg-rose-50 text-rose-600` (1등 당첨금) | `chip chip-coral` |
| `shadow-[0_20px_50px_…]`, `backdrop-blur-xl` (토스트) | `border-2 border-ink shadow-brutal` + `bg-mint` / `bg-coral` |
| `bg-white/70`, `/80`, `/95` 반투명 | `bg-card` |
| `text-[11px] uppercase tracking-[0.2em]` eyebrow | `font-mono` 추가, 색은 `text-ink` |
| `ZScoreBadge` tone | 유의(+) `chip-mint`, 유의(−) `chip-coral`, 랜덤 범위 `chip` (흰 배경) |
| `h-2 rounded-full bg-slate-100` 진행바 | `meter` |

`index.css` 의 `.latest-draw-card::after` (radial 장식), `.result-divider` 그라디언트,
`.latest-sync-card` 그라디언트, hover 시 `box-shadow` 변경 규칙은 삭제.

---

## 5. 단계

### Phase 0 — 파이프라인 + 토큰 (App.tsx 무수정)

1. `index.css`: `@tailwind` 3줄 → `@import "tailwindcss"` + `@theme` (§2)
2. `tailwind.config.js` 삭제 (v4 미사용, `content` 는 자동 감지)
3. `npm run build` 후 `dist/assets/*.css` 에 `.px-5`, `.rounded-2xl`, `.text-ink` 생성 확인
4. 화면이 깨져 보이는 건 정상 — 이 단계에서는 커밋만 하고 배포하지 않음

### Phase 1 — 셸 (헤더·배경·패널·버튼·토스트)

- `.panel`, `.btn-*`, `.header-nav*`, `.tab-nav*`(2차 탭, 2026-09-21 추가), 토스트를 §3 정의로 교체
- `body` 배경 `--color-paper`, `:root` radial/linear 그라디언트 제거
- `SectionCard` 헤더의 `border-white/60` → 잉크 3px, 아이콘 박스 `rounded-2xl` → 정사각 잉크 테두리
- `main` 상단 여백·gutter 확인 (spacing 유틸리티가 처음 적용되므로 `py-4 sm:py-5 lg:py-6`, `gap-*` 값 재조정 필요)

### Phase 2 — 도메인 요소 (공·배지·회차 행·추천 카드)

- `Ball`, `BonusBadge`, `PensionDigitBall` 교체 (§3)
- `DrawRow`, `DrawResultCard`, `RecommendationCard`, `FeaturedPensionRecommendationCard`: 치환 표 적용
- "가장 추천할 1세트" 카드는 `bg-lemon` 채움 + `shadow-brutal-lg` 로 위계 차별화 — 다른 카드는 흰색 유지
- 회차 탐색 화살표(`.result-arrow-shell`) 원형 → 정사각 잉크 테두리 버튼

### Phase 3 — 백테스트 진단 (RuleWeightCard / RulePerformanceCard / ZScoreBadge)

- 진행바 → `meter`, 통계 타일 → `stat-tile`
- 0.8 랜덤 기준선을 `meter` 위에 2px 점선 세로선으로 표시 (현재는 텍스트만)
- `ZScoreBadge` 는 색만이 아니라 `chip` 채움 + 부호 기호(`▲ / ▼ / ＝`)로 상태 구분

### Phase 4 — 마무리

- `@media (prefers-reduced-motion)`, `:focus-visible` 확인
- 모바일(360/390px)에서 `shadow-brutal` 이 우측·하단 gutter 를 넘지 않는지 — 카드 컨테이너에 `pr-1 pb-1` 또는 `mr-[4px]` 여유
- 명도 대비: 칩 채움색 위 잉크 텍스트, 공 5색 위 잉크 텍스트 AA 확인
- `README.md` 화면 구성 절에 디자인 토큰 위치 추가

Phase 1 이후부터는 매 단계 배포 가능. 예상 변경량: `index.css` 전면 재작성(~400줄 → ~250줄),
`App.tsx` className 약 300곳.

---

## 6. 하지 않는 것

- 컴포넌트 파일 분리(`src/components/`) — 디자인 교체와 섞으면 diff 검토가 불가능. 완료 후 별도 작업
- 다크 모드 — 네오브루탈리즘은 종이/잉크 반전이 자연스럽지만 현재 다크 모드가 없으므로 범위 밖
- 동행복권 로고(`logo_dong.svg`) 변경 — 외부 브랜드. 잉크 테두리 박스에 넣는 정도로만 처리
- 폰트 교체 — SUIT 는 한글 무게 800 까지 있어 네오브루탈리즘 제목에 충분. 모노만 추가

---

## 7. 검수 기준

1. `dist/assets/*.css` 에 `.px-5`, `.text-ink`, `.rounded-\[4px\]` 존재
2. `App.tsx` 에 `slate-`, `emerald-`, `sky-`, `rose-`, `rounded-2xl`, `backdrop-blur`, `/70`·`/80`·`/95` 투명도 서픽스 0건
3. `index.css` 에 `gradient(`, `blur(`, `rgba(` 0건 (공 그라디언트 포함)
4. 360px 폭에서 가로 스크롤 없음
5. Lighthouse 접근성 명도 대비 경고 0건
