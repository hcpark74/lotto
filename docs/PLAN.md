# 로또 추천 알고리즘 v4.0 계획

작성일: 2026-09-13
기준 버전: `v3.2` ([backend/src/algorithms/lotto.ts](../backend/src/algorithms/lotto.ts))

## 전제

로또 추첨은 회차 간 독립·번호 균등이다. 어떤 생성 방식을 써도 세트당 기대 일치 수는
`6×6/45 = 0.8`개로 같고, 이를 넘기는 알고리즘은 없다.

따라서 이 계획의 목표는 두 가지다.

1. 전략을 알고리즘별로 분리해 각 전략이 랜덤 대비 유의한지 **같은 화면에서 측정**한다.
2. 확률이 아니라 **기대 배당**을 올린다 — 대중이 많이 고르는 조합을 회피하는 모델을 학습한다.
   이것이 로또에서 실제 데이터로 검증 가능한 유일한 학습 루프다.

동행복권 API(`selectPstLt645InfoNew.do`) 응답에 `rnk1WnNope`~`rnk5WnNope`(등수별 당첨자 수),
`rlvtEpsdSumNtslAmt`(회차 판매액)가 포함되는 것을 확인했다(2026-09-13, 1180~1184회 응답).
3등(5개 일치) 약 3,000명, 4등 약 155,000명이라 1등보다 노이즈가 훨씬 작다.

---

## Phase 0 — 측정 기반 ✅ 2026-09-13 완료

**목표**: 어떤 전략이든 "랜덤 대비 유의한가"를 백테스트가 자동 판정한다.
이 단계 없이는 이후 단계를 평가할 수 없다.

1. [lotto-backtest.ts](../backend/src/services/lotto-backtest.ts)에 `baseline` 섹션 추가
   - 이론값: 초기하분포 `P(k) = C(6,k)·C(39,6−k)/C(45,6)`
     → 기대 일치 수 0.8, 표준편차 ≈ 0.784, 기대 `hitDistribution`
   - 경험값: 각 target 회차마다 순수 랜덤 세트 5개를 같이 생성해 관측 평균
   - 전략별 `averageMatches`에 `z = (mean − 0.8) / (0.784/√n)`과 95% CI 첨부
2. [summaries.ts](../backend/src/types/lotto/summaries.ts) `LottoBacktestSummary`에
   `baseline`, `performance[].zScore`, `performance[].ci95` 필드 추가
3. 백엔드에 vitest 추가. `algorithms/*`는 순수 함수라 D1 없이 테스트 가능.
   - 초기하 확률 합 = 1
   - `countMatches` 고정 케이스
   - 공통 규칙 통과율 고정 케이스
4. 프론트 백테스트 카드에 0.8 기준선 표시

**완료 내역**
- `backend/src/algorithms/lotto-baseline.ts`: 조합·초기하분포·`summarizeSignificance`·`buildRandomNumbers`
- `lotto-backtest.ts`: `baseline.{theoretical, randomControl, overall}`, `performance[].zScore/ci95`
- vitest 도입 (`npm test`), `backend/test/` 27건
- 프론트: 세트 평균 타일에 랜덤 기대값, "랜덤 대비 유의성" 패널, 규칙 카드에 z·CI 뱃지
- 로컬 D1 120회 실행 결과: 전체 z ≈ −0.2 ~ +1.3, 대조군 0.76 ~ 0.89. 규칙별 |z| ≥ 1.96 은
  4회 실행 중 1회(끝수 균형형 3.73) 나왔고 재실행에서 사라짐 — 다중 비교·재생성 노이즈의 전형.

---

## Phase 1 — 데이터 확장 (당첨자 수·판매액 수집)

1. `schema.sql`: `lotto_history`에 컬럼 추가 (`ALTER TABLE ... ADD COLUMN`, D1 지원)
   - `rnk1WnNope` … `rnk5WnNope`
   - `rnk1SumWnAmt` … `rnk3SumWnAmt`
   - `salesAmount` (← `rlvtEpsdSumNtslAmt`)
   - `winType1`, `winType2`, `winType3` (자동/수동/반자동 1등 수)
2. [results.ts](../backend/src/clients/lotto/results.ts) `fetchLottoResult` 매핑 확장,
   `LottoHistoryItem` / `LottoResultRecord` 타입 갱신, `insertLottoResult`를 `INSERT OR REPLACE`로
3. 백필: `POST /api/sync/prizes?limit=` — 신규 컬럼이 NULL인 회차를 재조회.
   API가 한 호출에 5회차씩 반환하므로 `srchDir` / cursor 파라미터로 페이지 크기를 확인한 뒤
   호출 수를 최소화한다.
4. 검증 쿼리: `rnk3WnNope / (salesAmount/1000)` 회차별 분포 확인.
   이 비율이 회차마다 2배 이상 흔들리면 인기 신호가 실재한다는 첫 증거.

---

## Phase 1.5 — 세트 간 번호 분산 ✅ 2026-09-26 완료

`LOTTO_ALGORITHM_VERSION = 'v3.3'`.

**문제**: `buildGeneratedSets` 가 5개 config 를 각각 독립으로 `pickSet` 했는데 전부
**같은 `weights`** 를 써서 같은 번호로 몰렸다. 5세트 30칸 중 서로 다른 번호가
**22.3개**뿐이라, 티켓 5장을 사고도 4장 값어치만 커버했다. 순수 랜덤 5세트(23.0)보다도 낮다.

**왜 이것만 고칠 수 있나**: 세트 1개의 기대 일치 수는 어떤 선택 규칙이든 정확히
`6×6/45 = 0.8` 이다(고정·연속·홀수만 등 극단 규칙으로 100만 회 시뮬레이션 확인, ±0.0015).
따라서 `performance[].averageMatches` 는 원리상 개선 불가다. 반면 **5세트 중 최고 일치**는
세트 간 중복에 따라 실제로 움직인다 — 확률을 이기는 게 아니라 커버리지 문제라서다.

**구현**: 가중치 높은 규칙부터 순차 생성하고, 앞 세트가 쓴 번호의 가중치에
`CROSS_SET_PENALTY` 를 곱한다. 완전히 빼지 않는 이유는 세트 규칙(끝수 균형·구간 분포)을
만족할 후보가 남아야 하기 때문이다.

**튜닝** (실데이터 1,213회 중 최근 240회 × 시드 24개 = 회차 5,760건, 최고일치 SE 0.009):

| 페널티 | 서로 다른 번호 | 회차 최고 일치 | 5장 중 3개+ | 세트 평균 일치 |
|---|---|---|---|---|
| 1 (기존) | 22.32 | 1.722 | 11.41% | 0.806 |
| 0.5 | 24.81 | 1.764 | 12.26% | 0.795 |
| 0.25 | 26.70 | 1.793 | 11.72% | 0.805 |
| 0.15 | 27.77 | 1.796 | 11.28% | 0.799 |
| **0.05** | **29.12** | **1.834** | 12.14% | 0.802 |
| 0 | 29.92 | 1.826 | 11.39% | 0.801 |
| 순수 랜덤 | 23.01 | 1.740 | 11.70% | 0.802 |

`0.05` 채택. 회차 최고 일치가 이론 상한(겹치지 않는 5세트 = 1.835)에 닿고 더 낮춰도
나아지지 않는다. `1 → 0.05` 는 +0.112 로 12.4 SE — 노이즈가 아니다.
세트 평균 일치는 전 구간 0.80 근처에 머문다(움직이면 안 되는 값이므로 정상).
공통 규칙 통과율 100%, 폴백 0% 로 열화 없음.

**주의**: 단일 시드 240회로는 최고 일치 SE 가 0.044 라 페널티 간 차이가 노이즈에 묻힌다.
실제로 시드 하나만 돌렸을 때는 순서가 뒤집혀 보였다. 이 항목은 반드시 다중 시드로 잰다.

**남은 것**: 3개+ 적중률 11.41% → 12.14% 는 +0.73%p (SE 0.41%p) 로 1.8 SE. 방향은
이론 예측(+0.56%p)과 맞지만 단독으로는 유의하지 않다. 커버리지(22.3→29.1)가 결정적 근거다.

---

## Phase 2 — 전략 분리 (5세트 = 5알고리즘)

`LOTTO_ALGORITHM_VERSION = 'v4.0'`.
`SET_CONFIGS`(패턴 규칙 5개)를 전략 5개로 교체한다. 공통 규칙은 그대로 최종 필터로 유지.

```
backend/src/algorithms/lotto/
  index.ts          buildGeneratedSets, countMatches, 공통 규칙, 초기하 유틸
  strategies/
    hot-cold.ts     현 buildWeights 이식 (콜드 0.5 / 과열 0.7 그대로)
    markov.ts       T[a][b] += 1 (a∈회차 t, b∈회차 t+1), 라플라스 평활 +1
                    weight[b] = Σ_{a∈직전회차} T[a][b] / rowSum(a)
                    진단: 행렬 균등성 카이제곱 통계량을 meta에 포함
    distribution-center.ts
                    공통 규칙 통과 후보 2,000개 샘플
                    → 특징(합·홀수·구간수·끝수고유·범위·연속쌍)
                    → z-score 벡터의 L2 노름 최소 후보 선택
    genetic.ts      개체 60, 30세대
                    적합도 = 공통규칙 + 다른 4세트와의 겹침 페널티 (+ Phase 3 인기 페널티)
                    교차 = 합집합에서 6개 추출, 변이 = 1개 교체
    random-control.ts
                    Math.random + 공통 필터만. label '기준 대조군'
```

- 전략 인터페이스: `{ id, label, generate(ctx: { draws, otherSets }) => GeneratedSet }`.
  유전형은 `otherSets`가 필요하므로 마지막에 실행.
- `meta.ruleId` → `meta.strategyId`로 이름 변경. 백테스트 `performance`가 전략별 표가 되도록.
- 규칙 가중치 동적 조정(`buildRuleWeights`, 24회 lookback)은 **제거**.
  노이즈 학습이며 전략 순서를 바꿀 근거가 없다. 프론트의 규칙 가중치 시각화는 전략별 z-score 표로 대체.
- Workers CPU 제한: 유전형 + 분포 중심형 샘플링을 합쳐 1회 생성이 수십 ms 이내인지
  `wrangler dev`에서 측정. 백테스트는 회차당 5전략을 실행하므로 `lookback` 상한을 두거나
  백테스트 모드에서 유전형 세대 수를 줄인다.

---

## Phase 3 — 인기 조합 회피 모델

**목표 변수** (회차별 인기 지수):

```
pop = log( rnk3WnNope / (salesAmount/1000 × P(5개 일치)) )
```

4등(`rnk4WnNope`)도 같은 방식으로 만들어 평균한다.
0이면 대중이 균등하게 골랐다는 뜻, 양수면 그 조합이 인기 조합.

**특징** (당첨 조합에서 추출, 후보 조합에도 동일하게 적용):

- 합
- 홀수 개수
- `≤31` 개수 (생일)
- 연속쌍 수
- 끝수 중복 수
- `max − min`
- 10단위 구간 수
- 직전 회차와 겹침 수
- 등차수열 여부
- 같은 십의 자리 3개 이상 여부

**학습** (순수 TS 함수 `popularity-train.ts`, 두 곳에서 호출):

1. `fitPopularityModel(rows) → { coefficients, featureMean, featureStd, trainedRange, r2WalkForward }`
   릿지 회귀, 정규방정식, 외부 의존성 없음.
2. 탐색·검증 — `backend/scripts/train-popularity.mjs`
   - 운영 `/api/results` 또는 `wrangler d1 export --remote`로 데이터 수집
   - walk-forward: 앞 800회로 학습, 뒤 회차 예측 R². 귀무(평균 예측) 대비 개선이 없으면
     이 Phase를 중단하고 보고한다.
   - 계수 부호 점검: `≤31` 개수는 양수여야 정상.
   - 이 단계에서 게이트 임계치(R² 하한 등)를 정한다.
3. 운영 — `POST /api/train` + cron 주 1회
   - D1 테이블 `lotto_model(id, version, coefficients TEXT, feature_stats TEXT,
     trained_from INTEGER, trained_to INTEGER, r2 REAL, accepted INTEGER, reject_reason TEXT, trained_at TEXT)`
   - 자동 승인 게이트 — 하나라도 걸리면 `accepted = 0`으로 기록만 하고 직전 승인 모델 유지:
     - walk-forward R² < 임계치
     - R²가 직전 승인 모델보다 낮음
     - `≤31` 개수 계수 ≤ 0 (데이터 오염·버그 신호)
     - 학습 표본 수 < 직전 모델 표본 수 (sync 누락 신호)
   - 응답에 승인 여부·사유·R²를 포함. 게이트 통과 이력은 테이블에 남긴다.
4. 런타임: `popularity.ts`가 `lotto_model`에서 `accepted = 1` 최신 행을 읽어 후보 세트에
   `popularityScore` 부여. 승인 모델이 없으면 페널티 0으로 동작.

**적용**:

- 각 전략의 rejection loop에서 공통 규칙 통과 후보 중 `popularityScore`가 낮은 쪽을 선택
  (후보 k개 중 최소값). 유전형은 적합도 항으로 직접 포함.
- `meta.popularityScore`, `meta.expectedShareMultiplier = exp(−pop)`를 응답에 포함
  → 프론트 뱃지 "예상 분배 인원 평균 대비 0.7배"

---

## Phase 4 — 프론트·문서

- 세트 카드에 전략 라벨과 인기 지수 뱃지. 대조군은 구분 표시.
- 백테스트 화면: 전략별 평균·CI·z-score 표, 0.8 기준선.
- README `추천 번호 알고리즘` 절을 v4.0 기준으로 갱신.
  `미적용/다음 단계`에서 마르코프·몬테카를로·유전 알고리즘을 완료로 이동,
  LSTM은 "신호 부재로 보류" 명시.

---

## 순서와 의존성

```
Phase 0 ──▶ Phase 1.5 ──▶ Phase 2 ──▶ Phase 4
Phase 1 ──────────▶ Phase 3 ──┘
```

- Phase 0과 1은 독립이라 병행 가능.
- Phase 2는 Phase 0의 측정이 있어야 결과를 해석할 수 있다.
- Phase 3은 Phase 1 데이터 백필이 끝나야 학습 가능. 운영 cron 활성화는 Node 스크립트 검증이 끝난 뒤.
- 연금복권은 이번 범위 밖. `pension720_prize_counts`에 등수별 인원이 이미 있어
  같은 방식을 적용할 수 있으나 별도 계획으로 다룬다.

---

## 결정 사항 (2026-09-13 확정)

1. 기존 패턴 규칙 5종(홀짝 균형형 등)은 **버린다**.
   전략의 후보 필터 옵션으로도 남기지 않는다. 남기면 전략×규칙 조합이 25개가 되어
   백테스트 표가 해석 불가.
2. Phase 3 학습은 **Workers cron + 자동 승인 게이트**로 운영한다. Node 스크립트는 탐색·검증용.
   - 학습 함수는 `algorithms/lotto/popularity-train.ts`에 순수 TS 한 벌로 구현.
     Node 스크립트와 Workers 엔드포인트가 같은 함수를 호출한다.
   - 규모: 표본 ~1,200행 × 특징 ~11개. `XᵀX`(11×11) 역행렬 한 번이라 CPU 1ms 미만.
     D1 1,200행 읽기는 I/O라 무료 플랜 CPU 제한(10ms)에 걸리지 않는다.
   - 운영: `POST /api/train` + `wrangler.toml` `[triggers] crons` 주 1회(추첨·sync 이후).
     결과는 D1 `lotto_model` 테이블에 저장. `/api/generate`는 최신 승인 모델을 읽어 적용, 없으면 페널티 0.
   - 이점: 재배포 없이 모델 갱신.
   - 대가: 사람이 보기 전에 모델이 운영에 들어간다 → 자동 승인 게이트 필수 (Phase 3 참조).

---

## 알고리즘별 판단 근거 (요약)

| 기법 | 실제로 하는 일 | 로또 데이터에서의 문제 | 이 계획에서의 위치 |
|---|---|---|---|
| 몬테카를로 | 무작위 표본으로 통계량 분포 추정 | 예측 도구가 아님. 전체 조합 8,145,060개는 전수 열거 가능 | "분포 중심형" 세트 생성기로 재정의 |
| 마르코프 체인 | 회차 t → t+1 전이 확률 | 참 전이행렬은 균등. 45×45셀을 ~43k 관측으로 추정하면 셀당 ~21건이라 노이즈를 패턴으로 오인 | 전략 1개로 포함, 카이제곱 진단 동반 |
| 유전 알고리즘 | 적합도 기준 후보 탐색 | 적합도를 "과거 당첨과의 일치"로 두면 과적합 | 제약 만족 + 세트 간 다양성 탐색기로만 사용 |
| RNN / LSTM | 시계열 자기상관 학습 | 자기상관 없음. 표본 ~1,200개로 45클래스 학습 불가. Workers 런타임 부적합 | 제외. 대신 순수 랜덤 대조군 |
| 통계적 필터링 | 극단 조합 제거 | 당첨 확률은 불변. 유일한 근거는 배당(분배 인원) | 공통 규칙으로 유지 + Phase 3 인기 회피로 확장 |
| 콜드/핫 | 최근 빈도 가중 | 도박사의 오류. 현 v3.2는 콜드 억제(흐름 지속)와 과열 억제(평균 회귀)를 동시 적용 | 전략 1개로 포함, 대조군과 비교 |
