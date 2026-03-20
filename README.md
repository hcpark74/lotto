# AI 로또 분석기

동행복권 역대 당첨 데이터를 기반으로 최신 회차, 추천 번호, 자주 나온 번호를 확인하는 서비스입니다.

- `frontend`: React + Vite + TypeScript + Tailwind CSS
- `backend`: Hono + Cloudflare Workers + Cloudflare D1
- 배포 구조: Cloudflare Pages(프론트) + Cloudflare Workers(백엔드)

---

## 현재 화면 구성

### `/lotto`
- 최신 당첨 결과 카드
- 추천 번호 5세트 생성
- 회차 탐색
- 최근 회차 히스토리
- 번호 색상 안내

### `/pension`
- 최신 연금복권 회차 결과 카드
- 최신 결과 동기화
- 추천번호 1세트 생성
- 지난 회차 검색

헤더 메뉴를 통해 `/lotto`, `/pension` 화면을 전환할 수 있습니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 19 + Vite + TypeScript + Tailwind CSS |
| 백엔드 | Cloudflare Workers + Hono |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 배포 | Cloudflare Pages + Cloudflare Workers |

---

## 로컬 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 백엔드 실행

```bash
cd backend
npm run dev
```

- 기본 포트: `8787`

### 3. 프론트엔드 실행

```bash
cd frontend
npm run dev
```

- 기본 포트: `5173`
- 브라우저 접속: `http://localhost:5173/lotto`

---

## 데이터베이스 초기화

최초 1회:

```bash
cd backend
npm run init-db
```

최신 당첨 데이터 동기화:

```bash
# 로컬
curl -X POST http://localhost:8787/api/sync

# 운영
curl -X POST https://lotto-analysis-backend.kbaysin.workers.dev/api/sync
```

참고:
- 한 번에 최대 10회차씩 저장됩니다.
- 1회부터 최신 회차까지 모두 채우려면 여러 번 호출해야 합니다.

---

## 추천 번호 알고리즘

현재 추천 로직은 백엔드 `backend/src/algorithms/lotto.ts`, `backend/src/algorithms/pension.ts`에서 동작합니다.

백엔드 레이어 구조 설명은 `backend/src/ARCHITECTURE.md`를 참고하세요.

### 적용 알고리즘 요약

- 로또: 베이즈식 번호 가중치, 최근 출현 반영, 콜드/과열 패널티, 규칙 가중치 동적 조정, 단계별 폴백
- 연금복권: 6자리 무작위 생성, 합계/홀짝/고유 숫자/연속수/중복 필터, 랜덤 폴백
- 백테스트: 평균 일치 수, 최고 일치 수, 폴백 비율, 규칙별 성과 진단

### 로또 (`v3.2`)

#### 기본 흐름
1. 전체 당첨 이력과 최근 당첨 이력을 함께 사용해 번호별 점수를 계산합니다.
2. 전체 빈도에는 균등 prior를 더한 베이즈식 posterior를 만들고, 최근 출현 점수와 `50:50`으로 섞습니다.
3. 최근 `15`회에 한 번도 나오지 않은 번호는 콜드 패널티로 가중치를 `50%` 낮춥니다.
4. 최근 `10`회 안에서 `3회 이상` 나온 과열 번호는 가중치를 `30%` 낮춥니다.
5. 가중치 기반 랜덤 추출로 중복 없는 6개 번호를 생성합니다.
6. 최근 당첨 번호가 어떤 규칙을 더 자주 만족했는지 계산해 세트 규칙 우선순위를 동적으로 조정합니다.
7. 세트 규칙까지 통과하지 못하면 공통 규칙만 만족하는 완화 폴백을 다시 시도하고, 그래도 실패하면 랜덤 폴백 세트를 반환합니다.

#### 사용 구간
- 최근 출현 가중치 계산: 최근 `50`회
- 콜드 판정: 최근 `15`회
- 과열 판정: 최근 `10`회
- 규칙 가중치 분석: 최근 `24`회
- 세트별 최대 시도 횟수: `300`

#### 공통 규칙
- 합계: `110 ~ 170`
- 홀수 개수: `2 ~ 4`
- 최대 연속 길이: `2` 이하 (`3연속 금지`)
- 9단위 구간 개수: `3`개 이상

#### 생성 세트
| 세트 | 조건 |
|------|------|
| 홀짝 균형형 | 공통 필터 + 홀수 정확히 3개 |
| 연속 독립형 | 공통 필터 + 연속번호 0개 |
| 합계 안정형 | 공통 필터 + 합계 110 ~ 155 |
| 구간 분포형 | 10단위 구간 4개 이상 분산 |
| 끝수 균형형 | 공통 필터 + 끝자리 모두 다름 |

#### 규칙 가중치 동적 조정
- 최근 `24`회 당첨 번호가 각 규칙을 얼마나 자주 만족했는지 계산합니다.
- `공통 규칙 + 세트 규칙` 동시 만족 비율과 `세트 규칙` 자체 만족 비율을 합쳐 규칙 점수를 만듭니다.
- 점수가 높은 규칙부터 먼저 세트를 생성합니다.
- 생성 응답과 백테스트 응답에 규칙별 가중치 진단값이 포함됩니다.

#### 폴백 단계
- 1차: 공통 규칙 + 세트 규칙
- 2차: 공통 규칙만 만족하는 완화 폴백
- 3차: 완전 랜덤 폴백 (`fallback-random`)

### 연금복권 (`pension-multi-set-v2`)

- 0~9 숫자 6자리를 생성합니다.
- 조건:
  - 합계 `22 ~ 34`
  - 홀수 개수 `2 ~ 4`
  - 고유 숫자 `4개 이상`
  - `3연속` 오름차순/내림차순 금지
  - 동일 숫자 최대 `2개`
- 공통 규칙을 통과한 뒤 아래 성향별 규칙 세트로 나눠 추천합니다.
- 성향별 규칙을 못 맞추면 공통 규칙만 맞춘 완화 폴백을 다시 시도합니다.
- 최대 `300`번 시도 후 실패하면 완전 랜덤 6자리 폴백을 반환합니다.
- 현재 생성 세트:
  - `균형형 추천`: 홀수 3개
  - `홀수 집중형 추천`: 홀수 4개
  - `고유수 확장형 추천`: 고유 숫자 5개 이상
  - `저합계 안정형 추천`: 합계 22~28

### 미적용 / 다음 단계

- 로또
  - `P1` 통계적 폴백 강화: 마지막 랜덤 폴백 대신 가중치 상위 번호와 분포 규칙을 약하게 유지하는 폴백 추가
  - `P2` 성과 반영 규칙 가중치 고도화: 최근 패턴 적합도에 백테스트 평균 일치 수와 폴백 비율을 함께 반영
  - `P3` 앙상블 생성: 베이즈+최근출현형, 균형형, 과열회피형 등 복수 전략 결과를 조합
  - `P4` 시계열 특징 공학: 이동 평균, 미출현 길이, 재출현 간격, 변동성 feature 추가
- 연금복권
  - `P2` 통계 기반 폴백 개선: 완전 랜덤 대신 합계/홀짝/중복 안정성을 유지하는 폴백 추가
  - `P3` 규칙 가중치 동적 조정: 로또처럼 최근 당첨 패턴 기준으로 세트 우선순위 조정
- 공통
  - `P3` 클러스터링: 유사한 패턴의 회차/번호군을 묶어 가중치 보정
  - `P4` 마르코프 체인: 연속 출현 흐름을 상태 전이 관점에서 반영
  - `P4` 몬테카를로 / Kelly 기준: 전략 수익 분포와 보수적 추천 강도 분석
  - `P5` LSTM / GRU: 충분한 feature와 검증 체계가 준비된 뒤 실험
  - `P5` 유전 알고리즘: 다목적 최적화가 필요해질 때 후보 조합 탐색기로 도입

#### 실행 순서 제안

- 1단계: 로또 `P1` 통계적 폴백 강화
- 2단계: 로또 `P2` 성과 반영 규칙 가중치 고도화
- 3단계: 연금복권 `P1` 규칙 세트 분리
- 4단계: 연금복권 `P2` 통계 기반 폴백 개선
- 5단계: 로또 `P3` 앙상블 생성
- 6단계 이후: 공통 `P3~P5` 실험 항목 순차 도입

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/sync` | 최신 당첨 결과 동기화 |
| `POST` | `/api/pension/sync` | 연금복권720+ 지난 회차/최신 회차 동기화 |
| `POST` | `/api/pension/generate` | 연금복권720+ 추천번호 1세트 생성 |
| `GET` | `/api/pension/results` | 연금복권720+ 회차 조회 (`?limit=`, `?drawNo=`) |
| `GET` | `/api/results` | 최근 회차 조회 (`?limit=`, `?drwNo=`) |
| `GET` | `/api/stats/hot` | 자주 나온 번호 Top 10 조회 |
| `POST` | `/api/generate` | 추천 번호 5세트 생성 |
| `GET` | `/api/generate/backtest` | 추천 로직 백테스트 |

`/api/generate/backtest` 응답에는 아래 품질 지표가 포함됩니다.

- `generationQuality.commonRulePassRate`
- `generationQuality.relaxedFallbackRate`
- `generationQuality.randomFallbackRate`

이 값으로 공통 필터가 얼마나 안정적으로 통과되는지, 세트 조건 완화나 랜덤 fallback이 얼마나 자주 발생하는지 확인할 수 있습니다.

연금복권 동기화 예시:

```bash
# 누락 회차 전체 저장
curl -X POST "http://localhost:8787/api/pension/sync"

# 누락 회차 중 10개만 저장
curl -X POST "http://localhost:8787/api/pension/sync?limit=10"

# 최신 연금복권 1건 조회
curl "http://localhost:8787/api/pension/results?limit=1"

# 특정 회차 상세 조회
curl "http://localhost:8787/api/pension/results?drawNo=306"
```

---

## 경로 전환

프론트는 현재 pathname 기반으로 화면을 전환합니다.

- `/lotto`
- `/pension`

배포 환경에서는 위 경로 직접 진입/새로고침 시 SPA fallback 설정이 필요할 수 있습니다.

---

## 배포

### 백엔드 배포

```bash
cd backend
npm run deploy
```

### 프론트엔드 배포

`frontend/.env.production` 예시:

```env
VITE_API_URL=https://lotto-analysis-backend.kbaysin.workers.dev
CLOUDFLARE_API_TOKEN=<Cloudflare API Token>
```

```bash
cd frontend
npm run deploy
```

---

## 자동 동기화

매주 토요일 기준 자동 동기화는 Workers 스케줄에서 관리합니다.

- 설정 파일: `backend/wrangler.toml`

---

## 주의사항

- 본 서비스는 통계적 참고 도구이며 당첨을 보장하지 않습니다.
- 생성형 알고리즘 사용 사실을 명시합니다.
- 실제 운영 시 `/lotto`, `/pension` 경로에 대한 Pages 라우팅 fallback 설정을 확인해야 합니다.
